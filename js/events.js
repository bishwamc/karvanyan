/**
 * events.js — storylets and set pieces (GDD sections 9 and 10).
 *
 * One content format (the storylet) serves road events, arrival set pieces, region dilemmas and
 * subplot beats. Three set pieces need custom rules and are written as hooks: the toll /
 * checkpoint (Matrix A), the river crossing (Matrix B) and the night prompt. The Delhi winter
 * decision (Matrix C) is plain storylet data.
 *
 * getView(state) turns the pending item into text and choices; choose(state, choiceId, random)
 * applies one choice and then resumes the day. Both are pure.
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;
  const Content = namespace.Content;
  const State = namespace.State;
  const engine = () => namespace.Engine;

  const STORYLETS = new Map(Content.STORYLETS.map((storylet) => [storylet.id, storylet]));
  const CHECKPOINT_IDS = Object.freeze(['khyber_toll', 'delhi_checkpoint', 'checkpoint_generic']);
  const STRANGER_IDS = Object.freeze(['stranger_trade', 'stranger_help', 'traveller_news']);

  // ---------------------------------------------------------------------------
  // Requirements and effects
  // ---------------------------------------------------------------------------

  function compare(value, expression) {
    const match = /^(>=|<=|>|<|==)(-?\d+(?:\.\d+)?)$/.exec(String(expression));
    if (!match) return false;
    const target = Number(match[2]);
    return { '>=': value >= target, '<=': value <= target, '>': value > target, '<': value < target, '==': value === target }[match[1]];
  }

  /** @param {Object} requirement one {key: value} entry */
  function meetsOne(state, requirement) {
    const mods = State.getModifiers(state);
    const [key] = Object.keys(requirement);
    const value = requirement[key];
    switch (key) {
      case 'money': return compare(state.money, value);
      case 'rations': return compare(state.supplies.rations, value);
      case 'feeds': return compare(state.supplies.feeds, value);
      case 'medicine': return compare(state.supplies.medicine, value);
      case 'cargoUnits': return compare(state.cargo ? state.cargo.units : 0, value);
      case 'animals': return compare(state.animals.length, value);
      case 'role': return state.party.some((member) => member.isAlive && member.role === value);
      case 'noRole': return !mods[value];
      case 'archetype': return state.archetypeId === value;
      case 'subplot': return state.subplotId === value;
      case 'quality': return compare(state.qualities[value[0]] || 0, value[1]);
      case 'card': return state.codex.includes(value);
      case 'flag': return Boolean(state.flags[value]);
      case 'flagNot': return !state.flags[value];
      case 'weather': return value.includes(state.weather.today);
      case 'node': return state.nodeId === value;
      case 'region': return State.getRegionOfState(state).id === value;
      case 'month': return value.includes(State.getDate(state).getUTCMonth());
      default: return true;
    }
  }

  const meets = (state, requirements) => (requirements || []).every((requirement) => meetsOne(state, requirement));

  /** Short chips describing what a choice does ("-8 rupees"). Never leaks hidden chance outcomes' numbers. */
  function describeEffects(effects) {
    const chips = [];
    (effects || []).forEach((effect) => {
      const signed = (value) => (value > 0 ? `+${value}` : `${value}`);
      if (effect.money) chips.push(`${signed(effect.money)} rupees`);
      if (effect.rations) chips.push(`${signed(effect.rations)} rations`);
      if (effect.feeds) chips.push(`${signed(effect.feeds)} feeds`);
      if (effect.medicine) chips.push(`${signed(effect.medicine)} medicine`);
      if (effect.pursePct) chips.push(`${Math.round(effect.pursePct * 100)}% of purse`);
      if (effect.hpAll) chips.push(`${signed(effect.hpAll)} health, all`);
      if (effect.quality && effect.quality[1] !== 0) chips.push(`${effect.quality[0]} ${signed(effect.quality[1])}`);
      if (effect.wait) chips.push(`${effect.wait} day${effect.wait > 1 ? 's' : ''}`);
      if (effect.waitUntilMonth !== undefined) chips.push('until spring');
      if (effect.animalLoss) chips.push('-1 animal');
      if (effect.sellShare) chips.push(`sell ${Math.round(effect.sellShare * 100)}% of cargo`);
      if (effect.chance) chips.push('risk');
    });
    return chips;
  }

  /**
   * Applies effects. Returns the new state, extra result lines, and days to wait afterwards.
   * @returns {{state:Object, lines:string[], waitDays:number}}
   */
  function applyEffects(state, effects, random) {
    let next = state;
    const lines = [];
    let waitDays = 0;
    let keepSupplies = false;
    const mods = State.getModifiers(state);
    (effects || []).forEach((effect) => {
      if (next.phase === 'ended') return;
      if (typeof effect.money === 'number') next = State.adjustResources(next, { money: effect.money });
      ['rations', 'feeds', 'medicine', 'covers'].forEach((key) => { if (typeof effect[key] === 'number') next = State.adjustResources(next, { [key]: effect[key] }); });
      if (typeof effect.pursePct === 'number') next = State.adjustResources(next, { money: Math.round(next.money * effect.pursePct) });
      if (typeof effect.cargoPct === 'number' && next.cargo) next = { ...next, cargo: { ...next.cargo, units: Math.max(0, Math.round(next.cargo.units * (1 + effect.cargoPct))) } };
      if (typeof effect.hpAll === 'number') next = State.changeAllHealth(next, effect.hpAll, effect.hpAll < 0 ? 'exhaustion' : 'general');
      if (effect.hp) {
        const living = State.getLivingIndices(next);
        if (living.length > 0) {
          const target = effect.hp.target === 'leader' ? State.getLeader(next) : next.party[random.pick(living)];
          next = State.changeMemberHealth(next, target.id, effect.hp.amount, effect.hp.cause || 'violence');
        }
      }
      if (effect.sick) {
        const healthy = State.getLivingIndices(next).filter((index) => !next.party[index].illness);
        if (healthy.length > 0) next = State.makeMemberSick(next, next.party[random.pick(healthy)].id, effect.sick);
      }
      if (effect.card) next = State.learnCard(next, effect.card);
      if (effect.quality) next = State.addQuality(next, effect.quality[0], effect.quality[1]);
      if (effect.flag) next = State.setFlag(next, effect.flag, true);
      if (effect.wait) waitDays += effect.wait;
      if (effect.keepSupplies) keepSupplies = true;
      if (effect.waitUntilMonth !== undefined) waitDays += State.daysUntilMonthStart(next, effect.waitUntilMonth);
      if (effect.animalLoss) next = State.loseAnimal(next, null);
      if (effect.animalHp) {
        const weakest = [...next.animals].sort((first, second) => first.hp - second.hp)[0];
        if (weakest) next = State.updateAnimal(next, weakest.id, { hp: Math.min(100, weakest.hp + effect.animalHp) });
      }
      if (effect.guardLoss) next = { ...next, hired: next.hired.filter((hire, index) => index !== next.hired.findIndex((item) => item.type === 'guard')) };
      if (effect.rumour) next = engine().addRumours(next, effect.rumour, random);
      if (effect.foggy) next = State.setFlag(next, 'fogUntil', next.dayIndex + 10);
      if (effect.sellShare) next = State.sellCargoLot(next, effect.sellShare);
      if (effect.conditionSafe) next = State.setFlag(next, 'boatSafeUntil', next.dayIndex + 5);
      if (effect.cargoWet && next.cargo) next = { ...next, cargo: { ...next.cargo, condition: Math.max(0, next.cargo.condition - Config.CARGO[next.cargo.id].fragile.wet * effect.cargoWet * 10) } };
      if (effect.chance) {
        let roll = random.next();
        for (const entry of effect.chance) {
          const probability = entry.p * (entry.kitchen ? State.getMod(mods, 'kitchenMult', 1) : 1);
          if (roll < probability) {
            const inner = applyEffects(next, entry.effects, random);
            next = inner.state; waitDays += inner.waitDays; keepSupplies = keepSupplies || inner.keepSupplies;
            if (entry.result) lines.push(entry.result);
            lines.push(...inner.lines);
            break;
          }
          roll -= probability;
        }
      }
    });
    return { state: next, lines, waitDays, keepSupplies };
  }

  // ---------------------------------------------------------------------------
  // Drawing storylets
  // ---------------------------------------------------------------------------

  const getStorylet = (id) => STORYLETS.get(id) || null;
  const findDilemma = (regionId) => Content.STORYLETS.find((item) => item.kind === 'dilemma' && item.region === regionId) || null;

  /** Picks a road storylet by weight from a pool kind ('stranger', 'water', 'animal'). */
  function pickRoadStorylet(state, kind, random) {
    const poolIds = { stranger: STRANGER_IDS, water: ['water_trouble'], animal: ['animal_lame'], ambush: ['road_ambush'], wildlife: ['road_wildlife'], flood: ['road_flood'] }[kind] || [];
    const candidates = poolIds.map(getStorylet).filter((storylet) => storylet && meets(state, storylet.requires)
      && (kind !== 'animal' || state.animals.length > 1) && (storylet.id !== 'stranger_help' || state.supplies.medicine >= 1 || state.supplies.rations >= 3));
    if (candidates.length === 0) return null;
    const total = candidates.reduce((sum, item) => sum + (item.weight || 1), 0);
    let remaining = random.next() * total;
    for (const candidate of candidates) { remaining -= candidate.weight || 1; if (remaining <= 0) return candidate.id; }
    return candidates[0].id;
  }

  /**
   * Queues what happens on arrival: a checkpoint, set-piece storylets and subplot beats (at most two
   * storylets per visit, GDD 9.4). Each is shown after the night.
   */
  function queueArrival(state) {
    const items = [];
    let next = state;
    const nodeId = state.nodeId;
    if (nodeId === 'khyber' && !state.flags.khyber_done) items.push({ kind: 'checkpoint', id: 'khyber_toll', data: { baseToll: 60 } });
    if (nodeId === 'delhi' && !state.flags.delhi_checked) items.push({ kind: 'checkpoint', id: 'delhi_checkpoint', data: { baseToll: 40 } });
    const eligible = Content.STORYLETS.filter((storylet) => (storylet.kind === 'arrival' || storylet.kind === 'subplot') && storylet.node === nodeId
      && !state.seenStorylets.includes(storylet.id) && (storylet.kind !== 'subplot' || storylet.subplot === state.subplotId) && meets(state, storylet.requires));
    eligible.sort((first, second) => (second.salience || 0) - (first.salience || 0)).slice(0, 2).forEach((storylet) => {
      items.push({ kind: 'storylet', id: storylet.id });
      next = { ...next, seenStorylets: [...next.seenStorylets, storylet.id] };
    });
    return { ...next, queue: [...next.queue, ...items] };
  }

  // ---------------------------------------------------------------------------
  // Hook: tolls and checkpoints (Matrix A)
  // ---------------------------------------------------------------------------

  /** Everything that changes a toll or haggle for this caravan. */
  function getTollContext(state, baseToll) {
    const mods = State.getModifiers(state);
    const region = State.getRegionOfState(state);
    const inPashtunLands = ['r1', 'r2', 'r3', 'r4'].includes(region.id);
    let tollMult = State.getMod(mods, 'tollMult', 1);
    if (inPashtunLands) tollMult *= State.getMod(mods, 'pashtunTollMult', 1);
    const toll = Math.max(1, Math.round(baseToll * tollMult));
    let haggle = 0.45 + State.getMod(mods, 'haggleBonus', 0);
    if (state.hired.some((hire) => hire.type === 'guide')) haggle += 0.15;
    if (state.codex.includes('kab_rahdari')) haggle += 0.1;
    if (!inPashtunLands) haggle += State.getMod(mods, 'outsideHaggleBonus', 0);
    if (Config.ARCHETYPES.find((item) => item.id === state.archetypeId).hasFarman) haggle += 0.1;
    const afterDelhi = World.getNodeIndex(state.nodeId) > World.getNodeIndex('delhi');
    if (afterDelhi) haggle -= State.getMod(mods, 'eastHaggleLoss', 0);
    return { toll, haggle: Math.max(0.1, Math.min(0.9, haggle)), canBribe: !mods.bribeLocked };
  }

  function buildTollChoices(state, pending) {
    const { toll, haggle, canBribe } = getTollContext(state, pending.data.baseToll);
    const isKhyber = pending.id === 'khyber_toll';
    const guards = state.hired.filter((hire) => hire.type === 'guard').length;
    const choices = [
      { id: 'pay', label: 'Pay in full', tone: 'safe', chips: [`-${toll} rupees`], reason: state.money >= toll ? null : `You need ${toll} rupees (cargo cannot pay a toll).` },
      { id: 'haggle', label: 'Haggle', tone: 'risky', chips: [`${Math.round(haggle * 100)}% to pay about 60%`, 'else full toll +25%'], reason: state.money >= Math.round(toll * 1.25) ? null : 'You could not cover a failed haggle.' },
    ];
    if (isKhyber) choices.push({ id: 'share', label: 'Share fodder with a stranded caravan, then pay', tone: 'safe', chips: [`-${toll} rupees`, '-10 feeds', '+1 reputation'], reason: state.supplies.feeds >= 10 && state.money >= toll ? null : 'You need 10 spare feeds and the toll.' });
    choices.push({ id: 'bribe', label: 'Bribe the official', tone: 'risky', chips: [`-${Math.round(toll * 0.4)} rupees`, '20% exposed: toll doubles', '-1 reputation'], reason: !canBribe ? 'Someone in your party refuses to bribe.' : (state.money >= toll * 2 ? null : 'You could not cover a failed bribe.') });
    if (isKhyber) choices.push({ id: 'escort', label: 'Hire a local escort', tone: 'risky', chips: [`-${30 + 20 * guards} rupees`, '15% the escort betrays you'], reason: state.money >= 30 + 20 * guards ? null : 'Not enough rupees.' });
    choices.push({ id: 'push', label: 'Refuse and push through', tone: 'danger', chips: ['fight', '-1 reputation', '+2 exposure'], reason: null });
    return choices;
  }

  function resolveToll(state, pending, choiceId, random) {
    const { toll, haggle } = getTollContext(state, pending.data.baseToll);
    const mods = State.getModifiers(state);
    const done = (next, message) => ({ state: State.setFlag(State.setFlag(next, 'khyber_done', pending.id === 'khyber_toll' ? true : next.flags.khyber_done), 'delhi_checked', pending.id === 'delhi_checkpoint' ? true : next.flags.delhi_checked), message });
    const payAmount = (next, amount) => State.adjustResources(next, { money: -amount });
    switch (choiceId) {
      case 'pay': return done(payAmount(state, toll), `You pay ${toll} rupees and are waved through.`);
      case 'haggle':
        if (random.chance(haggle)) { const paid = Math.round(toll * 0.6); return done(payAmount(state, paid), `After long talk you settle for ${paid} rupees.`); }
        { const paid = Math.round(toll * 1.25); return done(State.addQuality(payAmount(state, paid), 'exposure', 1), `They will not budge. You pay ${paid} rupees and are remembered.`); }
      case 'share':
        return done(State.addQuality(State.adjustResources(payAmount(state, toll), { feeds: -10 }), 'reputation', 1), `You share 10 feeds, then pay ${toll} rupees. Word of it travels.`);
      case 'bribe': {
        const bribe = Math.round(toll * 0.4);
        let next = State.addQuality(State.addQuality(state, 'reputation', -1), 'exposure', -1);
        if (random.chance(0.2)) return done(payAmount(next, toll * 2), `The bribe is exposed. You pay ${toll * 2} rupees in all.`);
        next = payAmount(next, bribe);
        return done(next, `A quiet coin changes hands. You pay ${bribe} rupees.`);
      }
      case 'escort': {
        const cost = 30 + 20 * state.hired.filter((hire) => hire.type === 'guard').length;
        let next = payAmount(state, cost);
        const edge = World.getOutgoingEdges(state.nodeId)[0];
        next = { ...next, hired: [...next.hired, { type: 'guard', tier: 'seasoned', untilNode: edge ? edge.to : null, untilRegion: null, hungryDays: 0, name: 'Local escort' }] };
        if (random.chance(0.15) && next.cargo) {
          const loss = Math.max(1, Math.round(next.cargo.units * 0.1));
          return done({ ...next, cargo: { ...next.cargo, units: Math.max(0, next.cargo.units - loss) } }, `The escort leads you through, then robs you of ${loss} lots at the far end.`);
        }
        return done(next, `A local escort walks you past the post for ${cost} rupees.`);
      }
      case 'push': {
        const threat = pending.id === 'khyber_toll' ? 4 : 2;
        const guards = state.hired.filter((hire) => hire.type === 'guard').reduce((sum, hire) => sum + Config.SERVICES.guard.tiers.find((tier) => tier.id === hire.tier).strength, 0);
        const defence = 1 - Math.exp(-Config.TUNING.DEFENCE_RATE * guards) + State.getMod(mods, 'wildlifeDefenceBonus', 0);
        const repel = Math.max(0.05, Math.min(0.95, Config.TUNING.REPEL_BASE + defence - Config.TUNING.REPEL_PER_THREAT * threat));
        let next = State.addQuality(State.addQuality(state, 'reputation', -1), 'exposure', 2);
        if (random.chance(repel)) return done(next, 'Your boldness (and your guards) unsettles them. You slip through.');
        next = State.adjustResources(next, { money: -Math.round(next.money * 0.2) });
        const hasGuard = next.hired.some((hire) => hire.type === 'guard');
        next = hasGuard ? { ...next, hired: next.hired.filter((hire, index) => index !== next.hired.findIndex((item) => item.type === 'guard')) } : State.loseAnimal(next, null);
        return done(State.changeAllHealth(next, -6, 'violence'), 'They strike your people, take a fifth of your purse and a guard or a beast before letting you go.');
      }
      default: return { state, message: '' };
    }
  }

  // ---------------------------------------------------------------------------
  // Hook: river crossings (Matrix B), rebuilt in 3.0
  //
  // Every number lives in Config.CROSSING. The rules the numbers must satisfy are tested in
  // tests/crossing-balance.test.mjs: fording without covers must cost far more than the ferry on average,
  // swimming more than fording, and the Indus at Attock is never fordable.
  // ---------------------------------------------------------------------------

  const CROSSING = Config.CROSSING;
  const LEVEL_ORDER = ['low', 'normal', 'high', 'flood'];
  const roundToThousandth = (value) => Math.round(value * 1000) / 1000;

  /** Players see the exact level only with a guide or scout; otherwise a range. */
  function describeLevel(state, level) {
    if (state.hired.some((hire) => hire.type === 'guide' || hire.type === 'scout')) return level;
    const index = LEVEL_ORDER.indexOf(level);
    const low = LEVEL_ORDER[Math.max(0, index - 1)];
    const high = LEVEL_ORDER[Math.min(3, index + 1)];
    return low === high ? low : `${low} to ${high}`;
  }

  const getMonthIndex = (state) => State.getDate(state).getUTCMonth();

  function getCrossingOptions(state, pending) {
    const level = engine().getRiverLevel(state, pending.data.riverId);
    const river = World.RIVERS[pending.data.riverId];
    const feeFactor = CROSSING.FEE_BASE_FACTOR + CROSSING.FEE_PER_ANIMAL * state.animals.length;
    const price = Math.max(1, Math.round(river.ferryPrice * CROSSING.LEVEL_PRICE_FACTOR[level] * feeFactor));
    const knowledge = state.codex.includes('att_water') ? 0.02 : 0;
    const monthIndex = getMonthIndex(state);
    return {
      level, price, knowledge, river,
      hasBridge: Boolean(river.bridgeMonths && river.bridgeMonths.includes(monthIndex)),
      bridgePrice: Math.max(1, Math.round(river.ferryPrice * CROSSING.BRIDGE_TOLL_FACTOR * feeFactor)),
      isFordable: river.isFordable !== false,
      isColdSeason: CROSSING.COLD_MONTHS.includes(monthIndex),
      isCovered: state.supplies.covers > 0,
    };
  }

  /** Chance of losing an animal when fording or swimming. Knowledge lowers it; handlers and Uzbek animal-sense apply once. */
  function getAnimalLossChance(state, table, level, knowledge) {
    if (table[level] === null) return null;
    const mods = State.getModifiers(state);
    return Math.max(0, table[level] - knowledge) * State.getMod(mods, 'animalLossMult', 1);
  }

  const percentText = (value) => `${Math.round(value * 100)}%`;

  function buildCrossingChoices(state, pending) {
    const options = getCrossingOptions(state, pending);
    const { level, price, knowledge, hasBridge, bridgePrice, isFordable, isCovered } = options;
    const lossText = (value) => (value === null ? null : `${Math.max(0, Math.round((value - knowledge) * 100))}% cargo loss`);
    const affordable = (cost) => (state.money >= cost ? null : 'Not enough rupees.');
    const choices = [];
    if (hasBridge) {
      choices.push({ id: 'bridge', label: 'Cross the bridge of boats', tone: 'safe', chips: [`-${bridgePrice} rupees`, lossText(CROSSING.BRIDGE_CARGO_LOSS), 'no queue'], reason: affordable(bridgePrice) });
    } else {
      if (CROSSING.FERRY_ONE_TRIP_CARGO_LOSS[level] !== null) choices.push({ id: 'ferry', label: 'Ferry, one trip', tone: 'safe', chips: [`-${price} rupees`, lossText(CROSSING.FERRY_ONE_TRIP_CARGO_LOSS[level]), `may queue 0 to ${CROSSING.FERRY_QUEUE_MAX_DAYS} days`], reason: affordable(price) });
      if (CROSSING.FERRY_TWO_TRIP_CARGO_LOSS[level] !== null) choices.push({ id: 'ferry2', label: 'Ferry, cargo split in two trips', tone: 'safe', chips: [`-${price * 2} rupees`, '+1 day', lossText(CROSSING.FERRY_TWO_TRIP_CARGO_LOSS[level])], reason: affordable(price * 2) });
      if (!state.flags[`premium_${pending.data.key}`] && CROSSING.FERRY_ONE_TRIP_CARGO_LOSS[level] !== null) choices.push({ id: 'premium', label: 'Pay a premium to cross first', tone: 'safe', chips: [`-${price * 2} rupees`, 'no queue', 'less risk'], reason: affordable(price * 2) });
    }
    if (level !== 'low') choices.push({ id: 'wait', label: 'Wait for the water to fall', tone: 'safe', chips: [`${CROSSING.WAIT_DAYS_FOR_LEVEL[level]} days`, 'food, lodging'], reason: null });
    const soakChip = isCovered ? 'covers protect the load' : 'soaks cargo, food and medicine';
    const fordChance = isFordable ? getAnimalLossChance(state, CROSSING.FORD_ANIMAL_LOSS, level, knowledge) : null;
    if (fordChance !== null) choices.push({ id: 'ford', label: 'Ford the river with the animals', tone: 'risky', chips: ['free', `${percentText(fordChance)} risk of losing an animal`, soakChip], reason: null });
    const swimChance = getAnimalLossChance(state, CROSSING.SWIM_ANIMAL_LOSS, level, knowledge);
    if (swimChance !== null) choices.push({ id: 'swim', label: 'Swim the animals across', tone: 'danger', chips: ['free', `${percentText(swimChance)} risk of losing an animal`, soakChip, 'irreversible'], reason: null });
    return choices.map((choice) => ({ ...choice, chips: choice.chips.filter(Boolean) }));
  }

  function applyFerrySlip(state, random) {
    if (!state.cargo || state.cargo.units <= 0) return state;
    const [low, high] = CROSSING.FERRY_SLIP_LOSS_RANGE;
    const loss = Math.max(1, Math.round(state.cargo.units * (low + (high - low) * random.next())));
    const fragile = Config.CARGO[state.cargo.id].fragile.wet;
    return { ...state, cargo: { units: Math.max(0, state.cargo.units - loss), id: state.cargo.id, condition: Math.max(0, roundToThousandth(state.cargo.condition - fragile * CROSSING.FERRY_SLIP_SOAK_MULTIPLIER)) } };
  }

  /**
   * Fording or swimming always soaks the load. Covers cut the damage and save the rations.
   * Order of random draws (kept stable so seeded tests agree): rations, then medicine unit by unit.
   */
  function soakLoad(state, random, isCovered) {
    const damageFactor = isCovered ? CROSSING.COVERS_DAMAGE_FACTOR : 1;
    let next = state;
    if (next.cargo && next.cargo.units > 0) {
      const fragile = Config.CARGO[next.cargo.id].fragile.wet;
      next = { ...next, cargo: { ...next.cargo, condition: Math.max(0, roundToThousandth(next.cargo.condition - fragile * CROSSING.SOAK_WET_MULTIPLIER * damageFactor)) } };
    }
    if (!isCovered) {
      const [low, high] = CROSSING.SOAK_RATION_LOSS_RANGE;
      const fraction = low + (high - low) * random.next();
      next = State.adjustResources(next, { rations: -State.roundToTenth(next.supplies.rations * fraction) });
    }
    let ruined = 0;
    for (let unit = 0; unit < next.supplies.medicine; unit += 1) if (random.chance(CROSSING.MEDICINE_RUIN_CHANCE * damageFactor)) ruined += 1;
    return ruined > 0 ? State.adjustResources(next, { medicine: -ruined }) : next;
  }

  /** In the cold months a wet crossing can bring on fever. */
  function applyColdFever(state, random) {
    let next = state;
    State.getLivingIndices(state).forEach((index) => {
      if (random.chance(CROSSING.COLD_FEVER_CHANCE)) next = State.makeMemberSick(next, state.party[index].id, 'fever');
    });
    return next;
  }

  /** A lost animal takes its share of the load with it: cargo and food in proportion, medicine and covers by chance. */
  function removeLoadShare(state, share, random) {
    let next = state;
    if (next.cargo && next.cargo.units > 0) next = { ...next, cargo: { ...next.cargo, units: Math.max(0, next.cargo.units - Math.round(next.cargo.units * share)) } };
    next = State.adjustResources(next, { rations: -State.roundToTenth(next.supplies.rations * share), feeds: -State.roundToTenth(next.supplies.feeds * share) });
    let lostMedicine = 0;
    let lostCovers = 0;
    for (let unit = 0; unit < next.supplies.medicine; unit += 1) if (random.chance(share)) lostMedicine += 1;
    for (let unit = 0; unit < next.supplies.covers; unit += 1) if (random.chance(share)) lostCovers += 1;
    return State.adjustResources(next, { medicine: -lostMedicine, covers: -lostCovers });
  }

  const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : (pluralForm || `${singular}s`)}`;

  /** Says exactly what a crossing changed, by comparing the state before and after. Never claims a loss that did not happen. */
  function describeCrossingLosses(before, after) {
    const parts = [];
    before.animals.filter((animal) => !after.animals.some((item) => item.id === animal.id))
      .forEach((animal) => parts.push(`you lose a ${Config.ANIMALS[animal.type].label.toLowerCase()}`));
    const lostLots = (before.cargo ? before.cargo.units : 0) - (after.cargo ? after.cargo.units : 0);
    if (lostLots > 0) parts.push(`${plural(lostLots, 'lot')} of cargo are gone`);
    if (before.cargo && after.cargo && before.cargo.units > 0 && before.cargo.condition - after.cargo.condition >= 0.01) {
      parts.push(`the ${Config.CARGO[after.cargo.id].label.toLowerCase()} is soaked, condition ${Math.round(before.cargo.condition * 100)}% to ${Math.round(after.cargo.condition * 100)}%`);
    }
    const lostRations = Math.round(before.supplies.rations - after.supplies.rations);
    if (lostRations >= 1) parts.push(`${plural(lostRations, 'ration')} spoil`);
    const lostFeeds = Math.round(before.supplies.feeds - after.supplies.feeds);
    if (lostFeeds >= 1) parts.push(`${plural(lostFeeds, 'feed')} lost`);
    const lostMedicine = before.supplies.medicine - after.supplies.medicine;
    if (lostMedicine >= 1) parts.push(`${lostMedicine} medicine ruined`);
    const lostCovers = before.supplies.covers - after.supplies.covers;
    if (lostCovers >= 1) parts.push(`${plural(lostCovers, 'cover')} lost`);
    after.party.forEach((member) => {
      const old = before.party.find((item) => item.id === member.id);
      if (old && member.isAlive && !old.illness && member.illness) parts.push(`${member.name} falls ill with ${Config.ILLNESSES[member.illness].label.toLowerCase()}`);
    });
    if (parts.length === 0) return '';
    const sentence = parts.join('; ');
    return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
  }

  /** Marks the crossing complete; the day then resumes. */
  const completeCrossing = (state, pending) => ({ ...state, doneCrossings: [...state.doneCrossings, pending.data.key] });

  function resolveWadeOrSwim(state, pending, choiceId, random, options) {
    const table = choiceId === 'ford' ? CROSSING.FORD_ANIMAL_LOSS : CROSSING.SWIM_ANIMAL_LOSS;
    // A refused ford (the Indus, or deep water) falls back to nothing: the view never offers it, but stay safe if asked.
    if ((choiceId === 'ford' && !options.isFordable) || table[options.level] === null) return { state, message: '' };
    let next = soakLoad(state, random, options.isCovered);
    if (options.isColdSeason) next = applyColdFever(next, random);
    const chance = getAnimalLossChance(state, table, options.level, options.knowledge);
    let lead = choiceId === 'ford' ? 'The animals wade across, wet and annoyed.' : 'The animals swim across, wild-eyed.';
    if (random.chance(chance)) {
      const lost = State.loseAnimalByLoad(next, random);
      if (lost.animal) {
        next = removeLoadShare(lost.state, lost.loadShare, random);
        lead = `The current knocks a ${Config.ANIMALS[lost.animal.type].label.toLowerCase()} off its feet.`;
      }
    }
    const losses = describeCrossingLosses(state, next);
    return { state: completeCrossing(next, pending), message: `${lead} ${losses || 'It costs you nothing this time.'}` };
  }

  function resolveCrossing(state, pending, choiceId, random) {
    const options = getCrossingOptions(state, pending);
    const { level, price, knowledge, river } = options;
    const adjust = (value) => Math.max(0, value - knowledge);
    switch (choiceId) {
      case 'bridge': {
        let next = State.adjustResources(state, { money: -options.bridgePrice });
        if (random.chance(adjust(CROSSING.BRIDGE_CARGO_LOSS))) next = applyFerrySlip(next, random);
        const losses = describeCrossingLosses(state, next);
        return { state: completeCrossing(next, pending), message: `You cross ${river.name} on the bridge of boats. ${losses || 'Everything arrives dry.'}` };
      }
      case 'ferry':
      case 'premium': {
        const cost = choiceId === 'premium' ? price * 2 : price;
        let next = State.adjustResources(state, { money: -cost });
        const risk = Math.max(0, adjust(CROSSING.FERRY_ONE_TRIP_CARGO_LOSS[level]) - (choiceId === 'premium' ? CROSSING.FERRY_PREMIUM_RISK_REDUCTION : 0));
        if (choiceId === 'premium') next = State.setFlag(next, `premium_${pending.data.key}`, true);
        const isSlip = random.chance(risk);
        if (isSlip) next = applyFerrySlip(next, random);
        // Only a plain one-trip ferry queues. The premium fare crosses first.
        const queueDays = choiceId === 'ferry' ? random.range(0, CROSSING.FERRY_QUEUE_MAX_DAYS) : 0;
        const lead = isSlip ? `The ferry slips in the current of ${river.name}.` : `The ferry grinds onto the far bank of ${river.name}.`;
        const losses = describeCrossingLosses(state, next);
        const queueText = queueDays > 0 ? ` You waited ${plural(queueDays, 'day')} at the landing for your turn.` : '';
        return { state: completeCrossing(next, pending), message: `${lead}${losses ? ` ${losses}` : ''}${queueText}`, waitDays: queueDays };
      }
      case 'ferry2': {
        let next = State.adjustResources(state, { money: -price * 2 });
        if (random.chance(adjust(CROSSING.FERRY_TWO_TRIP_CARGO_LOSS[level]))) next = applyFerrySlip(next, random);
        const losses = describeCrossingLosses(state, next);
        return { state: completeCrossing(next, pending), message: `Two trips, two prayers. ${losses || 'Everything arrives.'} The second trip costs you a day.`, waitDays: 1 };
      }
      case 'ford':
      case 'swim': {
        const outcome = resolveWadeOrSwim(state, pending, choiceId, random, options);
        return outcome;
      }
      case 'wait': return { state, message: `You camp on the bank and watch ${river.name}.`, waitDays: CROSSING.WAIT_DAYS_FOR_LEVEL[level] || 1, keepOpen: true };
      default: return { state, message: '' };
    }
  }

  // ---------------------------------------------------------------------------
  // Night prompt and overload dialog
  // ---------------------------------------------------------------------------

  function nightChoices(state) {
    const fee = State.getLodgingFee(state);
    return [
      { id: 'sarai', label: 'Sleep in a sarai', tone: 'safe', chips: [`-${fee} rupees`, 'shelter', 'attacks x0.5', 'crowd risk'], reason: state.money >= fee ? null : 'Not enough rupees.' },
      { id: 'camp', label: 'Camp by the road', tone: 'risky', chips: ['free', 'full weather', 'attacks x1.5', 'grazing'], reason: null },
    ];
  }

  const JETTISON_CHOICES = Object.freeze([
    { id: 'rations', label: 'Leave 10 rations behind' }, { id: 'feeds', label: 'Leave 10 feeds behind' },
    { id: 'covers', label: 'Leave a waxed cover behind' }, { id: 'cargo', label: 'Leave one lot of cargo behind' },
    { id: 'auto', label: 'Let the handlers choose' },
  ]);

  // ---------------------------------------------------------------------------
  // View models
  // ---------------------------------------------------------------------------

  /** Days a choice keeps you waiting in a city, and the price of that stay (for the choice chips). */
  function stayNote(state, effects) {
    if (state.phase !== 'stop') return null;
    const days = (effects || []).reduce((sum, effect) => sum + (effect.wait || 0)
      + (effect.waitUntilMonth !== undefined ? State.daysUntilMonthStart(state, effect.waitUntilMonth) : 0), 0);
    if (days <= 0) return null;
    const stay = engine().estimateStayCost(state, days);
    const kept = (effects || []).some((effect) => effect.keepSupplies) ? ', stores kept' : '';
    return `About ${stay.days} days in the city: ${stay.money} rupees for lodging${kept}`;
  }

  function storyletView(state, storylet) {
    return {
      kind: 'storylet', id: storylet.id, icon: storylet.icon, title: storylet.title, paragraphs: storylet.text,
      choices: storylet.choices.map((choice) => ({
        id: choice.id, label: choice.label, tone: choice.tone || 'safe',
        chips: [...describeEffects(choice.effects), ...(stayNote(state, choice.effects) ? [stayNote(state, choice.effects)] : [])],
        reason: meets(state, choice.requires) ? null : 'You cannot do this now.',
      })),
    };
  }

  /** @returns {{kind:string, icon:string, title:string, paragraphs:string[], choices:Object[]}|null} */
  function getView(state) {
    const pending = state.pending;
    if (!pending) return null;
    if (pending.kind === 'storylet') { const storylet = getStorylet(pending.id); return storylet ? storyletView(state, storylet) : null; }
    if (pending.kind === 'checkpoint') {
      const context = getTollContext(state, pending.data.baseToll);
      const isKhyber = pending.id === 'khyber_toll';
      return { kind: 'checkpoint', id: pending.id, icon: '⛰️', title: isKhyber ? 'The toll at the pass' : 'A checkpoint', paragraphs: [
        isKhyber ? `Armed men hold the narrow pass. Their price: ${context.toll} rupees. Cargo cannot pay it.` : `Officials stop the caravan and name a price: ${context.toll} rupees. Cargo cannot pay it.`,
        isKhyber ? 'Some say the emperor forbade such tolls. Here, the men with the swords set the rules.' : 'They say it is the custom. Perhaps it is.',
      ], choices: buildTollChoices(state, pending) };
    }
    if (pending.kind === 'crossing') {
      const { level, river, hasBridge, isFordable } = getCrossingOptions(state, pending);
      return { kind: 'crossing', id: pending.id, icon: '🌊', title: `Crossing ${pending.data.name}`, paragraphs: [
        `The water of ${river.name} looks ${describeLevel(state, level)}. ${hasBridge ? 'A bridge of boats is laid across the river.' : 'Ferrymen wait on the bank.'}`,
        `Choose how to cross. A guide or scout shows the exact level.${isFordable ? '' : ' Nobody fords this river with loaded animals.'}`,
      ], choices: buildCrossingChoices(state, pending) };
    }
    if (pending.kind === 'night') return { kind: 'night', icon: '🌙', title: 'Where do you sleep tonight?', paragraphs: ['A sarai is close. A camp costs nothing but the weather.'], choices: nightChoices(state) };
    if (pending.kind === 'jettison') {
      const over = engine().getOverload(state);
      return { kind: 'jettison', icon: '⚖️', title: 'Too much load', paragraphs: [`Your animals are over capacity by ${over} load units. Drop something before moving on.`],
        choices: JETTISON_CHOICES.map((choice) => ({ id: choice.id, label: choice.label, tone: 'risky', chips: [], reason: null })) };
    }
    if (pending.kind === 'provision') return { kind: 'provision', icon: '🏹', title: 'A rest day', paragraphs: ['You rest. You can also spend the day finding food.'], choices: [] };
    return null;
  }

  // ---------------------------------------------------------------------------
  // Choosing
  // ---------------------------------------------------------------------------

  /** Clears the pending slot and resumes the interrupted day, or presents the next queued beat. */
  function resume(state, random, options) {
    let next = { ...state, pending: null };
    if (next.phase === 'ended') return next;
    if (next.dayStage) return engine().continueDay(next, random, options);
    return engine().presentNext(next);
  }

  /** Applies queued wait days after a choice, stopping if something new needs an answer. */
  function runWaits(state, random, days, options) {
    let next = state;
    for (let day = 0; day < days && next.phase !== 'ended' && !next.pending; day += 1) {
      next = next.phase === 'stop' ? engine().passCityDays(next, random, 1, { keepSupplies: Boolean(options && options.keepSupplies) })
        : engine().continueDay({ ...engine().beginDay(next, { isRest: true, mode: 'road' }), dayStage: 'evening' }, random, { saraiPolicy: (options && options.saraiPolicy) === 'always' ? 'always' : 'never' });
    }
    return next;
  }

  /**
   * Applies one choice of the pending item.
   * @returns {{state:Object, message:string}|null} null when the choice is unknown or unavailable
   */
  function choose(state, choiceId, random, options) {
    const pending = state.pending;
    if (!pending) return null;
    const view = getView(state);
    if (!view) return null;
    const choiceView = view.choices.find((item) => item.id === choiceId);
    if (!choiceView || choiceView.reason) return null;

    if (pending.kind === 'night') {
      return { state: engine().chooseNight(state, random, choiceId, options), message: choiceId === 'sarai' ? 'You take a corner of the sarai.' : 'You make camp by the road.' };
    }
    if (pending.kind === 'jettison') {
      let next = choiceId === 'auto' ? engine().autoJettison(state) : engine().jettison(state, choiceId);
      if (engine().getOverload(next) > 0) return { state: next, message: 'You drop what you can.', keepOpen: true };
      next = { ...next, pending: null };
      return { state: next.phase === 'stop' ? engine().beginLeg(next) : next, message: 'The load fits again.' };
    }
    if (pending.kind === 'checkpoint') {
      const outcome = resolveToll(state, pending, choiceId, random);
      return { state: resume(State.makeNote(outcome.state, outcome.message), random, options), message: outcome.message };
    }
    if (pending.kind === 'crossing') {
      const outcome = resolveCrossing(state, pending, choiceId, random);
      if (outcome.keepOpen) {
        // Wait with the crossing set aside, then put it back if the river is still in the way.
        const waited = runWaits({ ...outcome.state, pending: null }, random, outcome.waitDays || 1, options);
        const stillCrossing = !waited.pending && waited.phase !== 'ended';
        return { state: State.makeNote(stillCrossing ? { ...waited, pending } : waited, outcome.message), message: outcome.message, keepOpen: stillCrossing };
      }
      let resumed = resume(State.makeNote(outcome.state, outcome.message), random, options);
      if (outcome.waitDays) resumed = runWaits(resumed, random, outcome.waitDays, options);
      return { state: resumed, message: outcome.message };
    }

    const storylet = getStorylet(pending.id);
    const choice = storylet.choices.find((item) => item.id === choiceId);
    const applied = applyEffects(state, choice.effects, random);
    let next = applied.state;
    if (storylet.once && !next.seenStorylets.includes(storylet.id)) next = { ...next, seenStorylets: [...next.seenStorylets, storylet.id] };
    const message = [choice.result, ...applied.lines].filter(Boolean).join(' ');
    next = State.makeNote(next, message);
    let resumed = resume(next, random, options);
    if (applied.waitDays > 0) resumed = runWaits(resumed, random, applied.waitDays, { ...options, keepSupplies: applied.keepSupplies });
    return { state: resumed, message };
  }

  /** True when a loaded pending item still refers to real content. */
  function isPendingValid(pending) {
    if (!pending) return true;
    if (pending.kind === 'storylet') return Boolean(getStorylet(pending.id));
    if (pending.kind === 'checkpoint') return CHECKPOINT_IDS.includes(pending.id) && pending.data && typeof pending.data.baseToll === 'number';
    if (pending.kind === 'crossing') return Boolean(pending.data && World.RIVERS[pending.data.riverId] && typeof pending.data.key === 'string');
    return ['night', 'provision', 'jettison'].includes(pending.kind);
  }

  namespace.Events = Object.freeze({
    meets, describeEffects, applyEffects, getStorylet, findDilemma, pickRoadStorylet, queueArrival,
    getTollContext, getView, choose, resume, isPendingValid, STORYLETS: Content.STORYLETS, getCrossingOptions, describeLevel, resolveCrossing, buildCrossingChoices,
  });
})(window.Karvanyan);
