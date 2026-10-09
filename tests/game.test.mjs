/**
 * tests/game.test.mjs — unit and invariant tests (GDD 14.5). Run: node --test tests/game.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, playRun } from '../tools/simulate.mjs';

const { State, Engine, Events, Config, World, Content } = loadGame();
const plain = (value) => JSON.parse(JSON.stringify(value));
const setup = (extra) => ({ archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.35, candidateIds: ['naseer', 'hakim_jafar', 'sher_dil'], rationPacks: 8, feedPacks: 8, startMonthIndex: 9, subplotId: 'book', worldSeed: 77, scout: true, ...extra });
const newGame = (extra) => State.createNewGame(setup(extra));
const alwaysRandom = (value, chance) => ({ next: () => value, chance: () => chance, range: (minimum) => minimum, pick: (items) => items[0], getState: () => 1 });

test('same seed gives the same run', () => {
  assert.deepEqual(plain(playRun('careful', 'persian', 4242, 9)), plain(playRun('careful', 'persian', 4242, 9)));
});

test('graph invariants (GDD 5.5)', () => {
  assert.equal(World.NODES.length, 31);
  assert.equal(World.EDGES.length, 30);
  assert.equal(World.TOTAL_KOS, 875);
  World.NODES.forEach((node) => {
    assert.equal(World.getOutgoingEdges(node.id).length, node.id === 'dhaka' ? 0 : 1, node.id);
    assert.ok(World.getRegion(node.region), node.id);
  });
  World.EDGES.forEach((edge) => { assert.ok(World.findNode(edge.from) && World.findNode(edge.to)); edge.crossings.forEach((crossing) => assert.ok(World.RIVERS[crossing.river])); });
});

test('Hijri year is 1076 AH for the journey start and for 1 January 1666', () => {
  assert.equal(State.getHijriLabel(newGame()), '1076 AH');
  assert.equal(State.getHijriLabel({ ...newGame({ startMonthIndex: 10 }), dayIndex: 47 }), '1076 AH');
});

test('river levels follow the calendar (Indus high in September, low in November)', () => {
  const at = (month, day) => ({ ...newGame({ startMonthIndex: month }), dayIndex: day });
  assert.equal(Engine.getRiverLevel(at(8, 0), 'indus'), 'high');
  assert.equal(Engine.getRiverLevel(at(10, 0), 'indus'), 'low');
  assert.equal(Engine.getRiverLevel({ ...at(8, 0), weather: { today: 'monsoon', forecast: 'monsoon', history: ['monsoon', 'monsoon', 'rain'] } }, 'indus'), 'flood');
});

test('weather and prices are deterministic by seed; weather exists for every day of two years', () => {
  const a = newGame(); const b = newGame();
  let previous = 'clear';
  for (let day = 1; day < 730; day += 1) { previous = Engine.drawWeatherFor(a, day, previous, 'r6'); assert.ok(Config.WEATHER_STATES.includes(previous)); }
  assert.equal(Engine.drawWeatherFor(a, 40, 'clear', 'r6'), Engine.drawWeatherFor(b, 40, 'clear', 'r6'));
  assert.equal(State.getCargoBasePrice(a, 'lahore', 'carpets'), State.getCargoBasePrice(b, 'lahore', 'carpets'));
});

test('load never exceeds capacity at the start; money and supplies are never negative', () => {
  Config.ARCHETYPES.forEach((archetype) => {
    [0.1, 0.55, 0.9].forEach((cargoShare) => {
      const state = newGame({ archetypeId: archetype.id, cargoShare });
      assert.ok(State.getLoad(state) <= State.getCapacity(state) + 0.01, `${archetype.id} ${cargoShare}`);
      assert.ok(state.money >= 0 && state.supplies.rations >= 0 && state.supplies.feeds >= 0);
    });
  });
});

test('prices stay in band; saturation lowers later units; no market at Khyber', () => {
  const at = { ...newGame(), nodeId: 'lahore' };
  const p0 = Config.CARGO.carpets.basePrice * World.findNode('lahore').demand[2];
  const price = State.getCargoBasePrice(at, 'lahore', 'carpets');
  assert.ok(price >= p0 * 0.8 * 0.5 * 0.8 && price <= p0 * 1.2 * 1.3 * 1.2, String(price));
  assert.ok(State.quoteSale(at, 10).revenue < State.quoteSale(at, 1).revenue * 10);
  const sold = State.sellCargoLot(at, 0.5);
  assert.ok(State.getCargoBasePrice(sold, 'lahore', 'carpets') < price);
  assert.equal(State.sellCargoLot({ ...at, nodeId: 'khyber' }, 1).cargo.units, at.cargo.units);
});

test('dead animals drop load: overload blocks leaving until jettisoned', () => {
  let state = newGame({ cargoShare: 0.6 });
  const camel = state.animals.find((animal) => animal.type === 'camel');
  state = State.changeAnimalHealth(state, camel.id, -999);
  assert.ok(Engine.getOverload(state) > 0);
  assert.equal(Engine.beginLeg(state).pending.kind, 'jettison');
  const fixed = Engine.autoJettison(state);
  assert.equal(Engine.getOverload(fixed), 0);
  assert.equal(Engine.beginLeg(fixed).phase, 'road');
});

test('medicine treats any sickness; fever is always cured', () => {
  const state = State.makeMemberSick(newGame(), 'm1', 'fever');
  const result = State.treatMember(state, 'm1', alwaysRandom(0.5, true));
  assert.equal(result.wasCured, true);
  assert.equal(result.state.supplies.medicine, state.supplies.medicine - 1);
  assert.equal(State.treatMember({ ...state, supplies: { ...state.supplies, medicine: 0 } }, 'm1', alwaysRandom(0.5, true)).wasPerformed, false);
});

test('leader death passes leadership on; everyone dead ends the run', () => {
  let state = State.changeMemberHealth(newGame(), 'm0', -999, 'fever');
  assert.equal(state.phase, 'stop');
  assert.equal(State.getLeader(state).id, 'm1');
  assert.equal(state.flags.leaderDied, true);
  ['m1', 'm2', 'm3'].forEach((id) => { state = State.changeMemberHealth(state, id, -999, 'hunger'); });
  assert.equal(state.phase, 'ended');
  assert.equal(state.outcome.cause, 'hunger');
});

test('Khyber toll: cargo cannot pay; unaffordable options are disabled but pushing through stays possible', () => {
  const state = { ...newGame(), nodeId: 'khyber', money: 5, pending: { kind: 'checkpoint', id: 'khyber_toll', data: { baseToll: 60 } } };
  const view = Events.getView(state);
  assert.ok(view.choices.find((choice) => choice.id === 'pay').reason);
  assert.equal(Events.choose(state, 'pay', alwaysRandom(0.5, true), {}), null);
  assert.equal(view.choices.find((choice) => choice.id === 'push').reason, null);
});

test('river crossing choices depend on the water level', () => {
  const pending = { kind: 'crossing', id: 'indus', data: { key: 'attock-hasan_abdal@1', riverId: 'indus', name: 'the Indus' } };
  const low = Events.getView({ ...newGame({ startMonthIndex: 10 }), nodeId: 'attock', edgeId: 'attock-hasan_abdal', phase: 'road', pending });
  assert.ok(low.choices.some((choice) => choice.id === 'ford'));
  const flood = Events.getView({ ...newGame({ startMonthIndex: 8 }), edgeId: 'attock-hasan_abdal', phase: 'road', pending, weather: { today: 'monsoon', forecast: 'monsoon', history: ['monsoon', 'monsoon', 'monsoon'] } });
  assert.ok(!flood.choices.some((choice) => choice.id === 'ford'));
  assert.ok(!flood.choices.some((choice) => choice.id === 'ferry'));
});

test('services: one guide per region; guards come from the stop pool', () => {
  const state = { ...newGame(), money: 900 };
  const guide = Engine.hireService(state, 'guide', 'local', null);
  assert.equal(guide.reason, null);
  assert.equal(Engine.hireService(guide.state, 'guide', 'local', null).reason, 'You already have a guide.');
  const pool = State.ensurePool(state, 'kabul').pools.kabul;
  if (pool.guards[0]) assert.equal(Engine.hireService(state, 'guard', pool.guards[0].tier, pool.guards[0].id).state.hired.filter((hire) => hire.type === 'guard').length, 1);
});

test('a travelling day advances the date and uses rations; nothing moves while a choice is pending', () => {
  const state = Engine.beginLeg(newGame());
  const random = State.createRandomSource(5);
  const after = Engine.advanceDay(state, random, { saraiPolicy: 'never' });
  assert.equal(after.dayIndex, 1);
  assert.ok(after.supplies.rations <= state.supplies.rations);
  assert.equal(Engine.advanceDay({ ...after, pending: { kind: 'night', data: {} } }, random, {}).dayIndex, 1);
});

test('provisioning is capped, depletes regional stock and is offered only on rest days', () => {
  const random = State.createRandomSource(3);
  const state = Engine.beginLeg({ ...newGame(), cargo: { ...newGame().cargo, units: 0 } });
  const rest = Engine.restDay({ ...state, supplies: { ...state.supplies, rations: 5 } }, random, { saraiPolicy: 'never' });
  assert.equal(rest.pending && rest.pending.kind, 'provision');
  const resolved = Engine.resolveProvision(rest, random, 1, { saraiPolicy: 'never' });
  assert.ok(resolved.stats.provisionRations > 0);
  assert.ok(resolved.stats.provisionRations <= State.getRationsPerDay(rest) * 1.5);
  assert.ok(resolved.regionStock[State.getRegionOfState(rest).id] < 1);
  const travelDay = Engine.advanceDay(state, random, { saraiPolicy: 'never' });
  assert.notEqual(travelDay.pending && travelDay.pending.kind, 'provision');
});

test('saves round-trip, survive damage and clamp tampered values', () => {
  const state = newGame({ archetypeId: 'yarkandi' });
  State.saveGame(state, 12345);
  const loaded = State.loadGame();
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.randomState, 12345);
  assert.deepEqual(plain({ ...loaded.state, isPaused: false }), plain({ ...state, isPaused: false }));
  assert.equal(State.parseSaveText('nope').status, 'damaged');
  assert.equal(State.parseSaveText('{"app":"karvanyan","schema":2').status, 'damaged');
  assert.equal(State.parseSaveText(JSON.stringify({ app: 'karvanyan', schema: 99, state: {} })).status, 'newer');
  assert.equal(State.parseSaveText(JSON.stringify({ app: 'karvanyan', schema: 1, state: {} })).status, 'damaged');
  const hostile = plain(state);
  hostile.money = -9; hostile.supplies.rations = 'lots'; hostile.party[0].name = '<script>x</script>'.repeat(10); hostile.animals[0].hp = NaN;
  const repaired = State.parseSaveText(JSON.stringify({ app: 'karvanyan', schema: 2, checksum: 'bad', randomState: 3, state: hostile }));
  assert.equal(repaired.status, 'ok');
  assert.equal(repaired.wasRepaired, true);
  assert.equal(repaired.state.money, 0);
  assert.ok(!repaired.state.party[0].name.includes('<'));
  assert.ok(repaired.state.party[0].name.length <= Config.LIMITS.MAX_NAME_LENGTH);
});

test('content integrity: unique storylets, valid card references, word limits, 18 recruits, 12 dilemmas', () => {
  const ids = new Set();
  Content.STORYLETS.forEach((storylet) => {
    assert.ok(!ids.has(storylet.id), `duplicate ${storylet.id}`); ids.add(storylet.id);
    assert.ok(storylet.choices.length >= 2, storylet.id);
    storylet.text.forEach((paragraph) => assert.ok(paragraph.split(/\s+/).length <= 45, `${storylet.id} paragraph too long`));
    (JSON.stringify(storylet.choices).match(/"card":"[a-z_]+"/g) || []).forEach((match) => assert.ok(State.findCard(match.slice(8, -1)), `${storylet.id} -> ${match}`));
  });
  World.NODES.forEach((node) => assert.equal(Content.CODEX.filter((card) => card.nodeId === node.id && card.unlock === 'arrival').length, 1, `${node.id} needs exactly one city card`));
  Content.CODEX.forEach((card) => {
    const words = card.text.split(/\s+/).length;
    if (card.unlock === 'arrival') {
      // City cards follow the 3-sentence formula: 65-85 words.
      assert.ok(words >= 65 && words <= 85, `${card.id} has ${words} words`);
      assert.equal((card.text.match(/[.!?](\s|$)/g) || []).length, 3, `${card.id} must have 3 sentences`);
    } else assert.ok(words <= 45, card.id);
    assert.ok(!/verify|needs? checking|provisional|check before|in place of|replaces/i.test(card.text), `${card.id} still has placeholder wording`);
  });
  World.NODES.forEach((node) => assert.ok(!/verify|replaces/i.test(node.notes), `${node.id} note has placeholder wording`));
  World.NODES.forEach((node) => assert.equal(Content.CODEX.filter((card) => card.nodeId === node.id && card.unlock === 'ask').length, 1, `${node.id} needs exactly one Ask around card`));
  Content.CODEX.filter((card) => card.unlock === 'ask').forEach((card) => assert.ok(/\b(I|me|my|we|our|us)\b/i.test(card.text), `${card.id} should be in the traveller's own voice`));
  Content.CODEX.forEach((card) => { assert.ok(['high', 'moderate', 'low'].includes(card.confidence)); assert.equal(card.source, 'TBD'); assert.ok(World.findNode(card.nodeId), card.id); });
  Content.DAULAT_BEG.beats.forEach((line) => assert.ok(line.split(/\s+/).length <= 25, line));
  Object.values(Content.DAULAT_BEG.reasons).forEach((line) => assert.ok(line.split(/\s+/).length <= 25, line));
  assert.equal(Content.CANDIDATES.length, 18);
  Object.keys(Config.ROLES).forEach((role) => assert.equal(Content.CANDIDATES.filter((candidate) => candidate.role === role).length, 3, role));
  Object.keys(World.REGIONS).forEach((region) => assert.ok(Content.STORYLETS.some((storylet) => storylet.kind === 'dilemma' && storylet.region === region), region));
});

test('every storylet renders and every available choice resolves without throwing', () => {
  const random = State.createRandomSource(11);
  Content.STORYLETS.forEach((storylet) => {
    const base = { ...newGame({ subplotId: storylet.subplot || 'book' }), money: 500, nodeId: storylet.node || 'kabul', pending: { kind: 'storylet', id: storylet.id } };
    const view = Events.getView(base);
    assert.ok(view && view.choices.length > 0, storylet.id);
    view.choices.filter((choice) => !choice.reason).forEach((choice) => assert.doesNotThrow(() => Events.choose(base, choice.id, random, {}), `${storylet.id}/${choice.id}`));
  });
});

test('balance gates (bots): careful 45-75%, random <= 5%, camp-always no better than careful', () => {
  const winRate = (policy) => { let wins = 0; let total = 0; Config.ARCHETYPES.forEach((archetype) => { for (let seed = 1; seed <= 12; seed += 1) { wins += playRun(policy, archetype.id, seed * 7919 + 13, [8, 9, 10][seed % 3]).won ? 1 : 0; total += 1; } }); return wins / total; };
  const careful = winRate('careful');
  assert.ok(careful >= 0.45 && careful <= 0.75, `careful ${careful}`);
  assert.ok(winRate('random') <= 0.05);
  assert.ok(winRate('campAlways') <= careful + 0.05, 'camp-always should not beat careful');
});


test('resting in a city never offers gathering, and costs can be previewed', () => {
  const random = State.createRandomSource(5);
  const state = newGame();
  assert.equal(state.phase, 'stop');
  const rested = Engine.restDay(state, random, { saraiPolicy: 'never' });
  assert.equal(rested.pending, null);
  assert.equal(rested.dayIndex, state.dayIndex + 1);
  const one = Engine.estimateRestCost(state, 1);
  const five = Engine.estimateRestCost(state, 5);
  assert.equal(five.days, 5);
  assert.ok(five.rations >= one.rations * 4 && five.rations <= one.rations * 5 + 5);
  assert.ok(five.money <= one.money * 5 && five.money >= one.money * 5 - 5, 'lodging is rounded once, on the total');
  assert.equal(Engine.estimateRestCost({ ...state, supplies: { ...state.supplies, rations: 1 } }, 10).isRationsShort, true);
});

test('fodder can be cut on the road: feeds only, no rations, and it uses up regional stock', () => {
  const random = State.createRandomSource(7);
  const start = Engine.beginLeg({ ...newGame(), cargo: { ...newGame().cargo, units: 0 } });
  const region = State.getRegionOfState(start);
  assert.notEqual(region.fodder, 'none');
  const rest = Engine.restDay({ ...start, supplies: { ...start.supplies, feeds: 3 } }, random, { saraiPolicy: 'never' });
  assert.equal(rest.pending.kind, 'provision');
  assert.ok(rest.pending.data.fodderRating > 0);
  const cut = Engine.resolveProvision(rest, random, 1, { saraiPolicy: 'never' }, 'fodder');
  assert.equal(cut.stats.provisionRations, rest.stats.provisionRations);
  assert.ok(cut.supplies.feeds > rest.supplies.feeds - Config.TUNING.GRAZE_SHARE.ok * 100);
  assert.ok(cut.regionStock[region.id] < 1);
  const skipped = Engine.resolveProvision(rest, State.createRandomSource(7), null, { saraiPolicy: 'never' }, 'fodder');
  assert.ok(cut.supplies.feeds >= skipped.supplies.feeds);
});

test('alerts name every illness, weakness and death, but not sales', () => {
  const state = newGame();
  const sick = State.makeMemberSick(state, state.party[1].id, 'fever');
  assert.ok(Engine.detectAlerts(state, sick).some((alert) => alert.tone === 'warning' && alert.text.includes(state.party[1].name)));
  const dead = State.changeMemberHealth(state, state.party[1].id, -500, 'fever');
  assert.ok(Engine.detectAlerts(state, dead).some((alert) => alert.tone === 'danger' && alert.text.includes('died')));
  const lost = { ...state, animals: state.animals.slice(1) };
  assert.ok(Engine.detectAlerts(state, lost).some((alert) => alert.tone === 'danger'));
  assert.equal(Engine.detectAlerts(state, state).length, 0);
  const cured = State.cureMember(sick, state.party[1].id);
  assert.ok(Engine.detectAlerts(sick, cured).every((alert) => alert.tone === 'info'));
});
