/**
 * tools/simulate.mjs — headless balance simulator (development tool, not needed to play).
 *
 * Loads the game's plain scripts into a Node `vm` sandbox, then plays many seeded journeys with
 * different bot policies (GDD section 14.2) and prints win rates, days, scores and metrics.
 *
 * Usage:   node tools/simulate.mjs [runsPerArchetype=40] [policyName]
 * Needs only Node 18+. No packages.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_FILES = ['config.js', 'world.js', 'content.js', 'state.js', 'engine.js', 'events.js'];
const MAXIMUM_STEPS_PER_RUN = 6000;

/** Loads the game scripts into a fresh sandbox and returns the Karvanyan namespace. */
export function loadGame() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  SCRIPT_FILES.forEach((fileName) => {
    const filePath = path.join(projectRoot, 'js', fileName);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });
  return sandbox.Karvanyan;
}

const Game = loadGame();
const { State, Engine, Events, Config, World } = Game;

// ---------------------------------------------------------------------------
// Bot building blocks
// ---------------------------------------------------------------------------

const TONE_RANK = { safe: 0, risky: 1, danger: 2 };

function chooseSafest(state) {
  const view = Events.getView(state);
  const available = view.choices.filter((choice) => !choice.reason);
  available.sort((first, second) => TONE_RANK[first.tone] - TONE_RANK[second.tone]);
  return (available[0] || view.choices[0]).id;
}

function chooseRandomly(state, random) {
  const view = Events.getView(state);
  const available = view.choices.filter((choice) => !choice.reason);
  return random.pick(available.length > 0 ? available : view.choices).id;
}

function treatAll(state, random) {
  let next = state;
  next.party.forEach((member) => {
    if (member.isAlive && member.illness && next.supplies.medicine > 0) next = State.treatMember(next, member.id, random).state;
  });
  return next;
}

/** Replaces dead animals where there is an animal market (a careful caravan keeps its capacity). */
function restockAnimals(state, targetCount) {
  let next = state;
  const node = World.findNode(next.nodeId);
  if (!node.hasAnimalMarket) return next;
  for (let guard = 0; guard < 6 && next.animals.length < targetCount; guard += 1) {
    const pool = State.ensurePool(next, next.nodeId).pools[next.nodeId];
    const options = pool.animals.filter((listing) => listing.hp >= 65 && Engine.getAnimalPrice(next, listing) <= next.money * 0.35);
    if (options.length === 0) break;
    options.sort((first, second) => (Config.ANIMALS[second.type].capacity * second.quality / Engine.getAnimalPrice(next, second)) - (Config.ANIMALS[first.type].capacity * first.quality / Engine.getAnimalPrice(next, first)));
    const bought = Engine.buyAnimal(next, options[0].id);
    if (bought.reason) break;
    next = bought.state;
  }
  return next;
}

/** Buys rations and feeds to cover the next leg with a margin, up to carrying capacity. */
function stockUp(state, marginDays) {
  let next = state;
  const edge = World.getOutgoingEdges(next.nodeId)[0];
  if (!edge || World.findNode(next.nodeId).tier === 'none') return next;
  for (let guard = 0; guard < 60; guard += 1) {
    const forecast = Engine.computeSupplyForecast(next, edge);
    const target = forecast.legDays + marginDays;
    let purchased = false;
    if (forecast.rationDays < target) { const result = Engine.buySupply(next, 'rations'); if (!result.reason) { next = result.state; purchased = true; } }
    if (forecast.feedDays < target) { const result = Engine.buySupply(next, 'feeds'); if (!result.reason) { next = result.state; purchased = true; } }
    if (!purchased) break;
  }
  return next;
}

function sellForNeeds(state, mode) {
  let next = state;
  const node = World.findNode(next.nodeId);
  if (node.tier === 'none' || !next.cargo || next.cargo.units <= 0) return next;
  const edge = World.getOutgoingEdges(next.nodeId)[0];
  if (!edge) return next;
  if (mode === 'sellAllFirst') return node.tier === 'large' || node.tier === 'great' ? State.sellCargoLot(next, 1) : next;
  if (mode === 'dhakaOnly') return next;
  const needed = Engine.estimateLegDays(next, edge) * 24 + 180;
  for (let guard = 0; guard < 6 && next.money < needed && next.cargo.units > 0; guard += 1) next = State.sellCargoLot(next, 0.25);
  if (node.tier === 'great' && mode !== 'sparse' && next.cargo.units > 0) next = State.sellCargoLot(next, 0.25);
  return next;
}

/** @typedef {{label:string, saraiPolicy?:string, guide?:boolean, hireAll?:boolean, provisionSpam?:boolean, sell?:string, waitDays?:number, idleHeavy?:boolean, random?:boolean}} Policy */

/** @type {Object<string, Policy>} */
const POLICIES = {
  careful: { label: 'careful' },
  carefulGuide: { label: 'careful + guide', guide: true },
  hireAll: { label: 'hire-all', hireAll: true, guide: true },
  saraiAlways: { label: 'sarai-always', saraiPolicy: 'always' },
  campAlways: { label: 'camp-always', saraiPolicy: 'never' },
  provisionSpam: { label: 'provision-spam', provisionSpam: true },
  waitWinter: { label: 'wait-winter', waitDays: 90 },
  idleHeavy: { label: 'idle-heavy', idleHeavy: true },
  sellAllFirst: { label: 'sell-all-first', sell: 'sellAllFirst' },
  sellAllAtDhaka: { label: 'sell-all-at-dhaka', sell: 'dhakaOnly' },
  random: { label: 'random', random: true },
};

function buildSetup(archetypeId, seed, monthIndex, policy) {
  const archetype = Config.ARCHETYPES.find((item) => item.id === archetypeId);
  const subplots = ['book', 'spy', 'lover', 'government'];
  return {
    archetypeId, leaderName: archetype.names[0], cargoShare: policy.random ? 0.5 : 0.35,
    candidateIds: policy.random ? ['naseer', 'gul_zaman', 'karim'] : ['hakim_jafar', 'sher_dil', 'naseer'],
    rationPacks: 9, feedPacks: 9, startMonthIndex: monthIndex, subplotId: subplots[seed % 4], worldSeed: seed, scout: true,
  };
}

function nightChoiceFor(state, policy, random) {
  if (policy.random) return random.chance(0.5) ? 'sarai' : 'camp';
  const bad = ['rain', 'monsoon', 'snow', 'cold', 'extreme', 'fog'].includes(state.weather.today);
  return bad || State.getSickCount(state) > 0 ? 'sarai' : 'camp';
}

function handleStop(state, random, policy) {
  let next = state;
  next = State.ensurePool(next, next.nodeId);
  if (policy.random) {
    next = { ...next, pace: random.pick(Object.keys(Config.PACES)), rationLevel: random.pick(Object.keys(Config.RATIONS)) };
    if (random.chance(0.5)) next = Engine.buySupply(next, random.pick(['rations', 'feeds', 'medicine'])).state;
    if (random.chance(0.2)) next = State.sellCargoLot(next, 0.25);
    return next;
  }
  next = treatAll(next, random);
  const needsRest = () => next.party.some((member) => member.isAlive && (member.illness || member.hp < 45));
  const weakHp = needsRest();
  const restLimit = policy.idleHeavy ? 4 : 3;
  for (let rest = 0; rest < restLimit && (weakHp || policy.idleHeavy) && next.phase === 'stop' && !next.pending; rest += 1) {
    next = Engine.restDay(next, random, { saraiPolicy: 'never' });
    while (next.pending && next.pending.kind === 'provision') next = Engine.resolveProvision(next, random, policy.provisionSpam ? 0.55 : null, { saraiPolicy: 'never' });
    next = treatAll(next, random);
    if (!needsRest() && !policy.idleHeavy) break;
  }
  if (next.phase !== 'stop' || next.pending) return next;
  if (policy.provisionSpam) {
    next = Engine.restDay(next, random, { saraiPolicy: 'never' });
    if (next.pending && next.pending.kind === 'provision') next = Engine.resolveProvision(next, random, 0.55, { saraiPolicy: 'never' });
    if (next.phase !== 'stop' || next.pending) return next;
  }
  next = restockAnimals(next, 5);
  next = sellForNeeds(next, policy.sell || 'split');
  while (next.supplies.medicine < 3 && next.money > 250) {
    const bought = Engine.buySupply(next, 'medicine');
    if (bought.reason) break;
    next = bought.state;
  }
  next = stockUp(next, 3);
  if (next.hired.every((hire) => hire.type !== 'guide') && policy.guide) {
    const bought = Engine.hireService(next, 'guide', 'local', null);
    if (!bought.reason) next = bought.state;
  }
  if (policy.hireAll) {
    const pool = State.ensurePool(next, next.nodeId).pools[next.nodeId];
    [['guard', pool.guards[0]], ['scout', pool.scouts[0]]].forEach(([type, listing]) => {
      if (!listing) return;
      const bought = Engine.hireService(next, type, listing.tier, listing.id);
      if (!bought.reason) next = bought.state;
    });
  }
  return next;
}

/**
 * Plays one full journey.
 * @returns {{won:boolean, days:number, score:number, ratio:number, cause:string, stats:Object, idleShare:number}}
 */
export function playRun(policyName, archetypeId, seed, monthIndex, trace) {
  const policy = POLICIES[policyName];
  const random = State.createRandomSource(seed ^ 0x9e3779b9);
  let state = State.createNewGame(buildSetup(archetypeId, seed, monthIndex, policy));
  const saraiPolicy = policy.saraiPolicy || 'ask';
  const options = { saraiPolicy };

  for (let step = 0; step < MAXIMUM_STEPS_PER_RUN && state.phase !== 'ended'; step += 1) {
    if (state.pending) {
      const pending = state.pending;
      if (pending.kind === 'provision') {
        const play = policy.provisionSpam || (!policy.random && state.supplies.rations < 30 && pending.data.rating >= 1.5) || (policy.random && random.chance(0.5));
        state = Engine.resolveProvision(state, random, play ? 0.55 : null, options);
      } else if (pending.kind === 'night') {
        state = Engine.chooseNight(state, random, nightChoiceFor(state, policy, random), options);
      } else if (pending.kind === 'jettison') {
        state = Engine.autoJettison(state);
        state = { ...state, pending: null };
        if (state.phase === 'stop') state = Engine.beginLeg(state);
      } else {
        const choiceId = policy.random ? chooseRandomly(state, random) : chooseSafest(state);
        const outcome = Events.choose(state, choiceId, random, options);
        if (!outcome) throw new Error(`Stuck on ${pending.kind} ${pending.id}`);
        state = outcome.state;
      }
    } else if (state.phase === 'stop') {
      if (state.nodeId === World.FINAL_NODE_ID) {
        state = State.sellCargoLot(state, 1);
        state = Engine.finishAtDhaka(state);
        continue;
      }
      state = handleStop(state, random, policy);
      if (trace) console.log(`${state.nodeId.padEnd(12)} day ${String(state.dayIndex).padStart(3)} money ${String(state.money).padStart(5)} rat ${Math.round(state.supplies.rations)} feed ${Math.round(state.supplies.feeds)} animals ${state.animals.length} cap ${State.getCapacity(state)} load ${State.getLoad(state)} cargo ${state.cargo.units} alive ${State.getLivingCount(state)} hp ${state.party.map((m) => Math.round(m.hp)).join('/')}`);
      if (policy.waitDays && state.nodeId === 'delhi' && !state.flags.waitedWinter && !state.pending) {
        state = State.setFlag(state, 'waitedWinter', true);
        state = Engine.passCityDays(state, random, policy.waitDays);
      }
      if (state.phase === 'stop' && !state.pending) {
        if (policy.random && state.pace) state = { ...state, pace: random.pick(Object.keys(Config.PACES)) };
        state = Engine.beginLeg(state);
      }
    } else if (state.phase === 'road') {
      if (!policy.random) state = treatAll(state, random);
      if (trace === 'factors') {
        const edge = World.findEdge(state.edgeId);
        const animalSpeed = state.animals.length ? state.animals.reduce((sum, a) => sum + Config.ANIMALS[a.type].speed * (0.75 + 0.25 * a.hp / 100), 0) / state.animals.length : 0.4;
        globalThis.__f = globalThis.__f || { n: 0, load: 0, animal: 0, weak: 0, kos: 0 };
        globalThis.__f.n += 1; globalThis.__f.load += State.getLoadFactor(state); globalThis.__f.animal += animalSpeed; globalThis.__f.weak += State.getWeakCount(state);
        globalThis.__f.kos += Engine.computeKosToday(state, edge, state.weather.today);
      }
      state = Engine.advanceDay(state, random, options);
    }
    if (step === MAXIMUM_STEPS_PER_RUN - 1) { console.log(JSON.stringify({ phase: state.phase, node: state.nodeId, pending: state.pending, day: state.dayIndex, money: state.money, supplies: state.supplies, log: state.log.slice(-6) })); throw new Error(`Run did not finish (soft-lock?) at ${state.nodeId} day ${state.dayIndex}`); }
  }
  const stats = state.stats;
  return {
    won: state.outcome.type === 'arrived', days: state.dayIndex, score: state.outcome.score, ratio: state.outcome.ratio,
    cause: state.outcome.cause, stats, idleShare: state.dayIndex > 0 ? stats.idleDays / state.dayIndex : 0,
  };
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function summarise(results) {
  const wins = results.filter((result) => result.won);
  const causes = {};
  results.filter((result) => !result.won).forEach((result) => { causes[result.cause] = (causes[result.cause] || 0) + 1; });
  return {
    runs: results.length, winPercent: Math.round((100 * wins.length) / results.length),
    meanDays: Math.round(mean(results.map((result) => result.days))), meanWinScore: Math.round(mean(wins.map((result) => result.score))),
    meanLossScore: Math.round(mean(results.filter((result) => !result.won).map((result) => result.score))),
    meanRatio: Math.round(mean(wins.map((result) => result.ratio)) * 100) / 100,
    saraiShare: Math.round(100 * mean(results.map((result) => result.stats.saraiNights / Math.max(1, result.stats.saraiNights + result.stats.campNights)))),
    provisionShare: Math.round(100 * mean(results.map((result) => result.stats.provisionRations / Math.max(1, result.stats.rationsEaten)))),
    idlePercent: Math.round(100 * mean(results.map((result) => result.idleShare))),
    causes,
  };
}

function main() {
  const runsPerArchetype = Number(process.argv[2]) || 40;
  const only = process.argv[3];
  const startMonths = Config.CALENDAR.START_OPTIONS.map((option) => option.monthIndex);
  Object.keys(POLICIES).filter((name) => !only || name === only).forEach((policyName) => {
    console.log(`\n=== policy: ${POLICIES[policyName].label} ===`);
    const everything = [];
    Config.ARCHETYPES.forEach((archetype) => {
      const results = [];
      for (let seed = 1; seed <= runsPerArchetype; seed += 1) results.push(playRun(policyName, archetype.id, seed * 7919 + 13, startMonths[seed % startMonths.length]));
      everything.push(...results);
      const summary = summarise(results);
      console.log(`${archetype.id.padEnd(9)} ${archetype.difficultyLabel.padEnd(8)} win ${String(summary.winPercent).padStart(3)}%  days ${summary.meanDays}  ratio ${summary.meanRatio}  winScore ${summary.meanWinScore}  lossScore ${summary.meanLossScore}  sarai ${summary.saraiShare}%  prov ${summary.provisionShare}%  idle ${summary.idlePercent}%  deaths ${JSON.stringify(summary.causes)}`);
    });
    const total = summarise(everything);
    console.log(`ALL       win ${total.winPercent}%  days ${total.meanDays}  ratio ${total.meanRatio}  winScore ${total.meanWinScore}  lossScore ${total.meanLossScore}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
