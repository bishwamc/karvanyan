/**
 * engine.js — the daily rules (GDD sections 6, 7, 8). Pure: no DOM, runs under Node.
 *
 * One day is: morning (date, weather) -> travel -> events -> evening (sarai or camp) -> night
 * (consumption, health, illness, animals, cargo, attacks). A day may pause for a player choice
 * (a storylet, a crossing, the night prompt, a provisioning decision); resolving that choice calls
 * continueDay() to resume where it stopped. state.dayStage and state.dayCtx remember the place,
 * so a saved game resumes mid-day.
 *
 * Every function returns a new state. Randomness comes only from the `random` argument
 * (or from keyed streams fixed by the world seed, for weather and prices).
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;
  const Content = namespace.Content;
  const State = namespace.State;
  const events = () => namespace.Events;
  const TUNING = Config.TUNING;

  // ---------------------------------------------------------------------------
  // Weather and forecast (GDD 6.4)
  // ---------------------------------------------------------------------------

  /** Draws the weather for a day from the climate table, with persistence. Keyed: reloads agree. */
  function drawWeatherFor(state, dayIndex, previous, regionId) {
    const date = new Date(Date.UTC(Config.CALENDAR.JOURNEY_YEAR, state.startMonthIndex, Config.CALENDAR.START_DAY_OF_MONTH + dayIndex));
    const weights = World.getClimateWeights(regionId, World.getMonthBand(date));
    const source = State.createKeyedSource(state.worldSeed, `wx|${dayIndex}`);
    if (previous && source.chance(World.WEATHER_PERSISTENCE)) return previous;
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let remaining = source.next() * total;
    for (let index = 0; index < weights.length; index += 1) {
      remaining -= weights[index];
      if (remaining <= 0) return Config.WEATHER_STATES[index];
    }
    return 'clear';
  }

  /** The true weather for the next n days, assuming the caravan stays in the current region. */
  function computeWeatherChain(state, count) {
    const regionId = State.getRegionOfState(state).id;
    const chain = [];
    let previous = state.weather.today;
    for (let ahead = 1; ahead <= count; ahead += 1) {
      previous = drawWeatherFor(state, state.dayIndex + ahead, previous, regionId);
      chain.push(previous);
    }
    return chain;
  }

  /** Best accuracy available for forecasting `ahead` days, and its source. */
  function getForecastSource(state, ahead) {
    let accuracy = ahead === 1 ? TUNING.DEFAULT_FORECAST_ACCURACY : 0;
    let source = ahead === 1 ? 'morning briefing' : 'none';
    state.hired.forEach((hire) => {
      const tier = Config.SERVICES[hire.type].tiers.find((item) => item.id === hire.tier);
      if (hire.type === 'scout' && ahead <= 3 && tier.accuracy > accuracy) { accuracy = tier.accuracy; source = 'scout'; }
      if (hire.type === 'guide' && ahead <= 3 && tier.accuracy > accuracy) { accuracy = tier.accuracy; source = 'guide'; }
    });
    return { accuracy, source };
  }

  /**
   * What the player is told about the coming days. A wrong forecast is always a NEIGHBOURING
   * state in the transition table, so players can learn to read the odds.
   * @returns {{aheadDays:number, shown:string, accuracy:number, source:string}[]}
   */
  function getForecast(state) {
    const chain = computeWeatherChain(state, 3);
    const entries = [];
    chain.forEach((truth, index) => {
      const ahead = index + 1;
      const { accuracy, source } = getForecastSource(state, ahead);
      if (accuracy <= 0) return;
      const draw = State.createKeyedSource(state.worldSeed, `fc|${state.dayIndex}|${ahead}|${source}`);
      const shown = draw.chance(accuracy) ? truth : draw.pick(Config.WEATHER[truth].neighbours);
      entries.push({ aheadDays: ahead, shown, accuracy, source });
    });
    return entries;
  }

  /** Water level of a river on the current date: low, normal, high or flood. */
  function getRiverLevel(state, riverId) {
    const date = State.getDate(state);
    let level = World.getBaseRiverLevel(riverId, date.getUTCMonth());
    const heavyDays = state.weather.history.filter((key) => Config.WEATHER[key].heavyRain).length;
    if (heavyDays >= 2 && level >= 1) level += 1;
    return ['low', 'normal', 'high', 'flood'][Math.min(3, level)];
  }

  // ---------------------------------------------------------------------------
  // Speed (GDD 7.3)
  // ---------------------------------------------------------------------------

  const TERRAIN_FACTOR = Object.freeze({ plain: 1, hill: 0.9, pass: 0.85, delta: 0.8, river: 1 });

  function hasHire(state, type) { return state.hired.some((hire) => hire.type === type); }

  /** Effective kos for one travelling day. */
  function computeKosToday(state, edge, weatherKey) {
    const mods = State.getModifiers(state);
    const pace = Config.PACES[state.pace];
    let terrain = Math.min(...edge.terrain.map((tag) => TERRAIN_FACTOR[tag] || 1));
    if (hasHire(state, 'guide')) terrain = Math.min(1, terrain * (1 + TUNING.GUIDE_SPEED_BONUS));
    const animalSpeed = state.animals.length === 0 ? TUNING.MIN_LOAD_FACTOR
      : state.animals.reduce((sum, animal) => sum + Config.ANIMALS[animal.type].speed * (0.75 + 0.25 * animal.hp / 100), 0) / state.animals.length;
    const slowCount = state.party.filter((member) => member.isAlive && member.mods && member.mods.slow).length;
    const weakFactor = Math.pow(1 - TUNING.WEAK_SPEED_PENALTY, State.getWeakCount(state));
    return pace.kosPerDay * pace.speedFactor * terrain * Config.WEATHER[weatherKey].speed * State.getLoadFactor(state)
      * Math.min(1.3, animalSpeed) * weakFactor * Math.pow(0.97, slowCount) * (mods.speedMult || 1);
  }

  /** Days needed for the rest of the current or next leg at steady rates (forecast bar). */
  function estimateLegDays(state, edge) {
    const kosLeft = Math.max(0, edge.kos - (state.edgeId === edge.id ? state.kosOnEdge : 0));
    const perDay = Math.max(1, computeKosToday(state, edge, 'clear') * 0.93);
    return Math.max(1, Math.ceil(kosLeft / perDay));
  }

  /** One shared forecast for the action bar and the advisor, so they never disagree. */
  function computeSupplyForecast(state, edge) {
    const rationsPerDay = State.getRationsPerDay(state);
    const feedsPerDay = State.getFeedsPerDay(state, { grazeShare: 0 });
    // Be cautious: grazing is not counted, because sarai and city nights give none.
    const feedsNeeded = Math.max(0.01, feedsPerDay * 1.05);
    return {
      legDays: estimateLegDays(state, edge),
      rationDays: rationsPerDay > 0 ? Math.floor(state.supplies.rations / rationsPerDay) : 0,
      feedDays: Math.floor(state.supplies.feeds / feedsNeeded),
      destination: World.findNode(edge.to).name,
    };
  }

  // ---------------------------------------------------------------------------
  // Region briefings and rumours (GDD 4.4, 9.8)
  // ---------------------------------------------------------------------------

  /** Unguided players see ranges; a guide shows exact values. */
  function getRegionBriefing(state, regionId) {
    const region = World.getRegion(regionId);
    const isGuided = state.hired.some((hire) => hire.type === 'guide' && hire.untilRegion === regionId);
    const range = (value) => (isGuided ? [value, value] : [Math.max(0, value - 1), Math.min(5, value + 1)]);
    return {
      regionId, name: region.name, isGuided, sarai: region.sarai, fodder: region.fodder,
      hunt: range(region.hunt), fish: range(region.fish), forage: range(region.forage),
      threat: Object.fromEntries(['bandit', 'wildlife', 'authority', 'theft', 'disease', 'flood'].map((type) => [type, range(region.threat[type])])),
      climate: region.climate, signature: region.signature,
    };
  }

  /**
   * Adds rumours: price ranges for cities ahead, weather words, and threat warnings.
   * Each is correct about 60% of the time plus role bonuses (GDD: ranges, sometimes wrong).
   */
  function addRumours(state, count, random) {
    const mods = State.getModifiers(state);
    const accuracy = 0.6 + State.getMod(mods, 'rumourBonus', 0);
    let next = state;
    const cities = [];
    let cursor = World.getOutgoingEdges(state.nodeId)[0];
    while (cursor && cities.length < 4) {
      const node = World.findNode(cursor.to);
      if (node.tier !== 'none') cities.push(node);
      cursor = World.getOutgoingEdges(cursor.to)[0];
    }
    for (let index = 0; index < count; index += 1) {
      const kind = random.pick(['market', 'market', 'threat', 'weather']);
      let text;
      if (kind === 'market' && cities.length > 0 && state.cargo) {
        const city = random.pick(cities);
        let [low, high] = State.getCargoPriceRange(state, city.id, state.cargo.id);
        if (!random.chance(accuracy)) { const shift = random.chance(0.5) ? 0.75 : 1.3; low = Math.round(low * shift); high = Math.round(high * shift); }
        text = `${city.name} is said to pay ${low} to ${high} rupees for ${Config.CARGO[state.cargo.id].label.toLowerCase()}.`;
      } else if (kind === 'threat' && cities.length > 0) {
        const city = random.pick(cities);
        const real = World.getRegion(city.region).threat.bandit >= 3;
        const told = random.chance(accuracy) ? real : !real;
        text = told ? `Robbers are said to work the road near ${city.name}.` : `Travellers say the road near ${city.name} has been quiet.`;
      } else {
        const chain = computeWeatherChain(state, 3);
        const truth = chain[2];
        const shown = random.chance(accuracy) ? truth : random.pick(Config.WEATHER[truth].neighbours);
        const word = { rain: 'rain', monsoon: 'heavy rain', hot: 'heat', extreme: 'fierce heat', cold: 'cold', snow: 'snow', fog: 'fog', dust: 'dust', clear: 'fair skies' }[shown];
        text = `Locals expect ${word} in a few days.`;
      }
      next = { ...next, rumours: [...next.rumours, { text, dayIndex: state.dayIndex }].slice(-12) };
    }
    return next;
  }

  // ---------------------------------------------------------------------------
  // Shopping and hiring (GDD 3.8, 4.4)
  // ---------------------------------------------------------------------------

  const SUPPLY_PACK_SIZE = Object.freeze({ rations: Config.PRICES.RATION_PACK_SIZE, feeds: Config.PRICES.FEED_PACK_SIZE, medicine: 1, covers: 1 });
  const SUPPLY_LU = Object.freeze({ rations: Config.UNITS.RATION_LU, feeds: Config.UNITS.FEED_LU, medicine: Config.UNITS.MEDICINE_LU, covers: Config.UNITS.COVER_LU });

  /** @returns {{state:Object, reason:string|null}} */
  function buySupply(state, kind) {
    if (state.phase !== 'stop') return { state, reason: 'You can only trade in a town.' };
    const node = World.findNode(state.nodeId);
    if (node.tier === 'none') return { state, reason: 'There is no market here.' };
    const price = State.getBuyPrice(state, kind);
    const amount = SUPPLY_PACK_SIZE[kind];
    if (state.money < price) return { state, reason: 'Not enough rupees.' };
    if (State.getFreeCapacity(state) < amount * SUPPLY_LU[kind] - 1e-9) return { state, reason: 'Your animals cannot carry more.' };
    let next = State.ensurePool(state, state.nodeId);
    if (kind === 'medicine') {
      const pool = next.pools[state.nodeId];
      if (pool.medicine < 1) return { state, reason: 'No medicine for sale here.' };
      next = { ...next, pools: { ...next.pools, [state.nodeId]: { ...pool, medicine: pool.medicine - 1 } } };
    }
    return { state: State.adjustResources(next, { money: -price, [kind]: amount }), reason: null };
  }

  function getAnimalPrice(state, listing) {
    const mods = State.getModifiers(state);
    return Math.round(Config.ANIMALS[listing.type].price * (0.5 + 0.5 * listing.hp / 100) * State.getMod(mods, 'buyMult', 1));
  }

  function buyAnimal(state, listingId) {
    const node = World.findNode(state.nodeId);
    if (!node.hasAnimalMarket || state.phase !== 'stop') return { state, reason: 'No animal market here.' };
    const ready = State.ensurePool(state, state.nodeId);
    const pool = ready.pools[state.nodeId];
    const listing = pool.animals.find((item) => item.id === listingId);
    if (!listing) return { state, reason: 'That animal has been sold.' };
    const price = getAnimalPrice(state, listing);
    if (state.money < price) return { state, reason: 'Not enough rupees.' };
    if (state.animals.length >= Config.LIMITS.MAX_ANIMALS) return { state, reason: 'You cannot manage more animals.' };
    const nextId = `a${Math.max(0, ...state.animals.map((animal) => Number(animal.id.slice(1)) || 0)) + 1}`;
    const next = {
      ...ready, money: ready.money - price,
      animals: [...ready.animals, { id: nextId, type: listing.type, hp: listing.hp, quality: listing.quality }],
      pools: { ...ready.pools, [state.nodeId]: { ...pool, animals: pool.animals.filter((item) => item.id !== listingId) } },
    };
    return { state: State.makeNote(next, `Bought a ${Config.ANIMALS[listing.type].label.toLowerCase()} for ${price} rupees.`), reason: null };
  }

  /** Price of a hire. Guides cost a base fee plus a daily rate for the days left in the region. */
  function getHirePrice(state, type, tierId) {
    const service = Config.SERVICES[type];
    const tier = service.tiers.find((item) => item.id === tierId);
    let price = service.base * tier.priceMult;
    if (type === 'guide') {
      const edge = World.getOutgoingEdges(state.nodeId)[0];
      price += service.perDay * Math.ceil((edge ? edge.kos : 6) / 6) * tier.priceMult;
    }
    const mods = State.getModifiers(state);
    return Math.max(1, Math.round(price * (type === 'guard' ? 1 : 1) * (mods.hireMult || 1)));
  }

  /**
   * Hires a scout or guard from the stop's pool, or a guide.
   * @param {string|null} listingId  pool id for scouts and guards; null for a guide
   */
  function hireService(state, type, tierId, listingId) {
    if (state.phase !== 'stop') return { state, reason: 'Hire at a stop.' };
    const edge = World.getOutgoingEdges(state.nodeId)[0];
    if (!edge) return { state, reason: 'Nowhere to go.' };
    const price = getHirePrice(state, type, tierId);
    if (state.money < price) return { state, reason: 'Not enough rupees.' };
    let next = State.ensurePool(state, state.nodeId);
    const hire = { type, tier: tierId, untilNode: null, untilRegion: null, hungryDays: 0, name: Config.SERVICES[type].label };
    if (type === 'guide') {
      if (state.hired.some((item) => item.type === 'guide' && item.untilRegion === edge.region)) return { state, reason: 'You already have a guide.' };
      hire.untilRegion = edge.region;
    } else {
      const pool = next.pools[state.nodeId];
      const key = type === 'guard' ? 'guards' : 'scouts';
      const listing = pool[key].find((item) => item.id === listingId);
      if (!listing) return { state, reason: 'That hand is no longer available.' };
      if (type === 'scout' && state.hired.some((item) => item.type === 'scout')) return { state, reason: 'You already have a scout.' };
      hire.untilNode = edge.to;
      hire.name = listing.name;
      next = { ...next, pools: { ...next.pools, [state.nodeId]: { ...pool, [key]: pool[key].filter((item) => item.id !== listingId) } } };
    }
    next = { ...next, money: next.money - price, hired: [...next.hired, hire], stats: { ...next.stats, servicesUsed: next.stats.servicesUsed.includes(type) ? next.stats.servicesUsed : [...next.stats.servicesUsed, type] } };
    return { state: State.makeNote(next, `Hired a ${type} (${tierId}) for ${price} rupees.`), reason: null };
  }

  // ---------------------------------------------------------------------------
  // Overload (GDD 3.3 dead-animal rule)
  // ---------------------------------------------------------------------------

  const getOverload = (state) => Math.max(0, State.roundToTenth(State.getLoad(state) - State.getCapacity(state)));

  /** Drops items the player chooses until the load fits. @param {'rations'|'feeds'|'covers'|'cargo'|'medicine'} item */
  function jettison(state, item) {
    if (item === 'cargo') {
      if (!state.cargo || state.cargo.units < 1) return state;
      return State.makeNote({ ...state, cargo: { ...state.cargo, units: state.cargo.units - 1 } }, 'You leave one lot of cargo behind.');
    }
    const amount = item === 'rations' || item === 'feeds' ? 10 : 1;
    if (state.supplies[item] < 1) return state;
    return State.makeNote(State.adjustResources(state, { [item]: -Math.min(amount, state.supplies[item]) }), `You leave some ${item} behind.`);
  }

  /** Cheapest-first automatic jettison (used by bots, and as a "choose for me" button). */
  function autoJettison(state) {
    let next = state;
    for (let guard = 0; guard < 400 && getOverload(next) > 0; guard += 1) {
      const order = ['covers', 'feeds', 'rations', 'cargo', 'medicine'];
      const item = order.find((candidate) => (candidate === 'cargo' ? next.cargo && next.cargo.units >= 1 : next.supplies[candidate] >= 1));
      if (!item) break;
      next = jettison(next, item);
    }
    return next;
  }

  // ---------------------------------------------------------------------------
  // Starting and ending days
  // ---------------------------------------------------------------------------

  /** Leaves the stop. Returns a jettison prompt instead if the animals are overloaded. */
  function beginLeg(state) {
    if (state.phase !== 'stop' || state.pending) return state;
    const edge = World.getOutgoingEdges(state.nodeId)[0];
    if (!edge) return state;
    if (getOverload(state) > 0 && state.animals.length > 0) return { ...state, pending: { kind: 'jettison', data: {} } };
    const departed = { ...state, phase: 'road', edgeId: edge.id, kosOnEdge: 0, doneCrossings: [], isPaused: false };
    return State.makeNote(departed, `Set out for ${World.findNode(edge.to).name}.`);
  }

  /** Morning: the date advances, weather is drawn, regional stock regrows. */
  function beginDay(state, ctx) {
    const regionId = State.getRegionOfState(state).id;
    const dayIndex = state.dayIndex + 1;
    const weatherKey = drawWeatherFor(state, dayIndex, state.weather.today, regionId);
    const regionStock = {};
    Object.keys(state.regionStock).forEach((id) => { regionStock[id] = Math.min(1, state.regionStock[id] + Config.PROVISION.STOCK_REGROWTH_PER_DAY); });
    return {
      ...state, dayIndex, regionStock, dayCtx: { ...ctx, arrived: false, place: null },
      weather: { today: weatherKey, forecast: weatherKey, history: [...state.weather.history, state.weather.today].slice(-7) },
    };
  }

  /** Is a sarai available tonight on the road? Seeded per day so reloads agree. */
  function isSaraiAvailable(state) {
    const edge = State.getEdge(state);
    const level = edge && edge.sarai ? edge.sarai : State.getRegionOfState(state).sarai;
    const chance = TUNING.SARAI_CHANCE[level];
    if (chance <= 0) return false;
    return State.createKeyedSource(state.worldSeed, `sarai|${state.dayIndex}`).chance(chance);
  }

  // ---------------------------------------------------------------------------
  // Arrival
  // ---------------------------------------------------------------------------

  function arriveAtStop(state, edge) {
    const node = World.findNode(edge.to);
    let next = {
      ...state, nodeId: node.id, edgeId: null, kosOnEdge: 0, doneCrossings: [], phase: 'stop', isPaused: false,
      hired: state.hired.filter((hire) => !(hire.untilNode && hire.untilNode === node.id) && !(hire.untilRegion && hire.untilRegion !== node.region)),
    };
    next = State.learnCard(next, node.id === 'kabul' ? 'kab_crossroads' : (Content.CODEX.find((item) => item.nodeId === node.id && item.unlock === 'arrival') || {}).id);
    next = State.makeNote(next, `The caravan reaches ${node.name}.`);
    next = State.ensurePool(next, node.id);
    next = { ...next, dayCtx: { ...next.dayCtx, arrived: true } };
    return events().queueArrival(next);
  }

  // ---------------------------------------------------------------------------
  // The road day
  // ---------------------------------------------------------------------------

  /**
   * Advances one travelling day. Does nothing while a choice is pending.
   * @param {Object} state
   * @param {Object} random
   * @param {{saraiPolicy?:string}} [options]
   */
  function advanceDay(state, random, options) {
    if (state.phase !== 'road' || state.pending) return state;
    let next = beginDay(state, { isRest: false, mode: 'road' });
    next = { ...next, stats: { ...next.stats, travelDays: next.stats.travelDays + 1 } };
    next = travelPart(next, random);
    if (next.pending || next.phase === 'ended') return { ...next, dayStage: next.pending ? 'evening' : null };
    return continueDay({ ...next, dayStage: 'evening' }, random, options);
  }

  function travelPart(state, random) {
    const edge = State.getEdge(state);
    const mods = State.getModifiers(state);
    const weatherKey = state.weather.today;
    let next = state;

    const guided = hasHire(next, 'scout') || hasHire(next, 'guide');
    const foggy = (next.flags.fogUntil || 0) > next.dayIndex;
    let lostChance = TUNING.LOST_DAY_CHANCE * State.getMod(mods, 'lostDayMult', 1) * (weatherKey === 'fog' || foggy ? TUNING.FOG_LOST_DAY_FACTOR : 1);
    if (guided) lostChance = 0;
    if (random.chance(lostChance)) return State.makeNote(next, 'You lose the road in the murk and make no headway.');

    const kos = computeKosToday(next, edge, weatherKey);
    for (const crossing of edge.crossings) {
      const key = `${edge.id}@${crossing.atKos}`;
      if (next.doneCrossings.includes(key)) continue;
      if (next.kosOnEdge < crossing.atKos && next.kosOnEdge + kos >= crossing.atKos) {
        const river = World.RIVERS[crossing.river];
        return { ...next, kosOnEdge: crossing.atKos, pending: { kind: 'crossing', id: crossing.river, data: { key, riverId: crossing.river, name: crossing.name || river.name } } };
      }
    }
    const kosAfter = next.kosOnEdge + kos;
    edge.waypoints.forEach((waypoint) => {
      if (next.kosOnEdge < waypoint.atKos && kosAfter >= waypoint.atKos) next = State.makeNote(next, `You pass the waypoint of ${waypoint.name}.`);
    });
    if (kosAfter >= edge.kos) return arriveAtStop(next, edge);
    next = { ...next, kosOnEdge: State.roundToTenth(kosAfter) };
    return rollRoadEvent(next, random);
  }

  /** At most one road event per day (GDD 7.7): dilemma, checkpoint, or a small encounter. */
  function rollRoadEvent(state, random) {
    const region = State.getRegionOfState(state);
    const mods = State.getModifiers(state);
    const scoutFactor = hasHire(state, 'scout') ? 1 - TUNING.SCOUT_EVENT_REDUCTION : 1;
    const dilemmaFlag = `dilemma_${region.id}`;
    if (!state.flags[dilemmaFlag] && state.kosOnEdge > 2) {
      const dilemma = events().findDilemma(region.id);
      if (dilemma) return { ...State.setFlag(state, dilemmaFlag), pending: { kind: 'storylet', id: dilemma.id } };
    }
    if (random.chance(TUNING.CHECKPOINT_CHANCE_PER_THREAT * region.threat.authority * scoutFactor)) {
      return { ...state, pending: { kind: 'checkpoint', id: 'checkpoint_generic', data: { baseToll: 10 + 12 * region.threat.authority } } };
    }
    const dry = ['hot', 'extreme', 'dust'].includes(state.weather.today);
    const rolls = [
      ['stranger', TUNING.STRANGER_CHANCE], ['water', TUNING.WATER_TROUBLE_CHANCE * (dry ? 2 : 1)], ['animal', TUNING.ANIMAL_TROUBLE_CHANCE * State.getMod(mods, 'animalLossMult', 1)],
    ];
    for (const [kind, probability] of rolls) {
      if (!random.chance(probability * scoutFactor)) continue;
      const id = events().pickRoadStorylet(state, kind, random);
      if (id) return { ...state, pending: { kind: 'storylet', id } };
    }
    return state;
  }

  // ---------------------------------------------------------------------------
  // Evening and night
  // ---------------------------------------------------------------------------

  /**
   * Resumes a day after a pause: decides where the caravan sleeps, then runs the night.
   * @param {Object} state
   * @param {Object} random
   * @param {{saraiPolicy?:string}} [options]
   */
  function continueDay(state, random, options) {
    if (state.phase === 'ended' || state.pending) return state;
    const ctx = state.dayCtx || { isRest: false, mode: 'road', arrived: false, place: null };
    let next = state;
    if (state.dayStage === 'evening') {
      let place = ctx.place;
      if (!place) {
        if (ctx.mode === 'city' || ctx.arrived) place = 'city';
        else if (isSaraiAvailable(next) && next.money >= State.getLodgingFee(next)) {
          next = { ...next, stats: { ...next.stats, saraiEligibleNights: next.stats.saraiEligibleNights + 1 } };
          const policy = (options && options.saraiPolicy) || 'ask';
          if (policy === 'ask') return { ...next, pending: { kind: 'night', data: { fee: State.getLodgingFee(next) } }, dayStage: 'evening' };
          place = policy === 'always' ? 'sarai' : 'camp';
        } else place = 'camp';
      }
      next = { ...next, dayCtx: { ...ctx, place }, dayStage: 'night' };
    }
    if (next.dayStage === 'night') {
      next = processNight(next, random);
      if (next.phase === 'ended') return next;
      next = { ...next, dayStage: null, dayCtx: null };
      next = presentNext(next);
      if (!next.pending && next.phase === 'road' && getOverload(next) > 0 && next.animals.length > 0) next = { ...next, pending: { kind: 'jettison', data: {} } };
    }
    return next;
  }

  /** Moves the next queued arrival beat into the pending slot. */
  function presentNext(state) {
    if (state.pending || state.queue.length === 0) return state;
    const [first, ...rest] = state.queue;
    return { ...state, pending: first, queue: rest };
  }

  function chooseNight(state, random, place, options) {
    if (!state.pending || state.pending.kind !== 'night') return state;
    const ctx = state.dayCtx || { isRest: false, mode: 'road', arrived: false };
    return continueDay({ ...state, pending: null, dayCtx: { ...ctx, place: place === 'sarai' ? 'sarai' : 'camp' }, dayStage: 'evening' }, random, options);
  }

  /** The long list of things that happen at night (GDD 7.1 step 5). */
  function processNight(state, random) {
    const ctx = state.dayCtx;
    const region = State.getRegionOfState(state);
    const weather = Config.WEATHER[state.weather.today];
    const mods = State.getModifiers(state);
    const isRest = ctx.isRest;
    let place = ctx.place;
    let next = state;

    // 1. Lodging
    if (place === 'sarai' || (place === 'city' && World.findNode(state.nodeId).id !== 'khyber')) {
      const fee = State.getLodgingFee(next);
      if (next.money >= fee) next = State.adjustResources(next, { money: -fee });
      else if (place === 'sarai') place = 'camp';
    }
    const sheltered = place !== 'camp';
    if (place === 'sarai') next = { ...next, stats: { ...next.stats, saraiNights: next.stats.saraiNights + 1 } };
    if (place === 'camp') next = { ...next, stats: { ...next.stats, campNights: next.stats.campNights + 1 } };
    if (isRest) next = { ...next, stats: { ...next.stats, restDays: next.stats.restDays + 1, idleDays: next.stats.idleDays + 1 } };

    // 2. Rations
    const rationsNeed = State.getRationsPerDay(next) + (place === 'camp' && ['cold', 'snow'].includes(state.weather.today) ? TUNING.COLD_FUEL_RATIONS : 0);
    const rationsSatisfaction = rationsNeed <= 0 ? 1 : Math.min(1, next.supplies.rations / rationsNeed);
    next = State.adjustResources(next, { rations: -rationsNeed });
    next = { ...next, stats: { ...next.stats, rationsEaten: next.stats.rationsEaten + rationsNeed } };
    if (rationsSatisfaction < 1) next = State.makeNote(next, 'The caravan goes hungry.');

    // 3. Feeds and grazing (grazing only when camping)
    const graze = place === 'camp' ? TUNING.GRAZE_SHARE[region.fodder] : 0;
    const feedsNeed = State.getFeedsPerDay(next, { weatherKey: state.weather.today, grazeShare: graze });
    const feedsSatisfaction = feedsNeed <= 0 ? 1 : Math.min(1, next.supplies.feeds / feedsNeed);
    next = State.adjustResources(next, { feeds: -feedsNeed });

    // 4. Animals
    const pace = Config.PACES[next.pace];
    next.animals.forEach((animal) => {
      const definition = Config.ANIMALS[animal.type];
      let delta = 0;
      if (!isRest) delta -= pace.animalStrain;
      let weatherHit = weather.animalHp;
      if (weatherHit < 0) {
        if (['cold', 'snow'].includes(state.weather.today)) weatherHit *= definition.coldDamage;
        if (['extreme', 'hot'].includes(state.weather.today)) weatherHit *= definition.heat;
        if (state.weather.today === 'monsoon') weatherHit *= definition.mud;
        weatherHit *= State.getMod(mods, 'animalLossMult', 1);
        if (sheltered) weatherHit *= 0.5;
        delta += weatherHit;
      }
      if (feedsSatisfaction < 1) {
        delta -= TUNING.FEED_SHORT_HP;
        if (random.chance(TUNING.FEED_SHORT_LAME_CHANCE)) delta -= TUNING.FEED_SHORT_LAME_HP;
      } else if (isRest) delta += TUNING.ANIMAL_REST_RECOVERY;
      if (delta !== 0) next = State.changeAnimalHealth(next, animal.id, delta);
    });

    // 5. People: health, illness
    const lowland = !['r1', 'r3'].includes(region.id);
    for (const index of State.getLivingIndices(next)) {
      if (next.phase === 'ended') break;
      const member = next.party[index];
      const parts = [];
      let delta = 0;
      if (isRest) {
        const recovery = TUNING.REST_HP[place === 'city' ? 'city' : (place === 'sarai' ? 'sarai' : 'camp')] * State.getMod(mods, 'restMult', 1);
        delta += recovery;
      }
      if (rationsSatisfaction < 1) { const loss = TUNING.FOOD_SHORT_HP; delta -= loss; parts.push(['hunger', loss]); }
      const rationLoss = Config.RATIONS[next.rationLevel].hpLoss;
      if (rationLoss > 0) { delta -= rationLoss; parts.push(['hunger', rationLoss * 0.6]); }
      if (!isRest && pace.strain > 0) { delta -= pace.strain; parts.push(['exhaustion', pace.strain]); }

      let exposure = weather.hp;
      if (exposure < 0) {
        const isCold = ['cold', 'snow'].includes(state.weather.today);
        const isHeat = ['hot', 'extreme'].includes(state.weather.today);
        if (sheltered) exposure *= isHeat ? 0.5 : 0;
        else exposure *= TUNING.CAMP_EXPOSURE_FACTOR;
        if (isCold) exposure *= State.getMod(mods, 'coldMult', 1) * (member.mods.coldMult || 1);
        if (isHeat && lowland) exposure *= State.getMod(mods, 'lowlandHeatMult', 1);
        delta += exposure;
        if (exposure < 0) parts.push([isCold ? 'exposure' : (isHeat ? 'heat' : 'exposure'), -exposure]);
      }
      if (member.illness) {
        const damage = Config.ILLNESSES[member.illness].hp * State.getMod(mods, 'illnessSlowMult', 1);
        delta -= damage; parts.push([member.illness, damage]);
        if (isRest) {
          const restDays = member.restDays + 1;
          next = State.updateMember(next, member.id, { restDays });
          const recovers = member.illness === 'heat' ? restDays >= 2 : random.chance(Config.ILLNESSES[member.illness].restRecovery);
          if (recovers) next = State.cureMember(next, member.id);
        }
      }
      const cause = parts.sort((first, second) => second[1] - first[1])[0];
      next = State.changeMemberHealth(next, member.id, delta, cause ? cause[0] : 'exhaustion');
    }
    if (next.phase === 'ended') return next;

    next = rollNewIllness(next, random, { place, region, weather, mods, isRest });
    next = rollNightAttacks(next, random, { place, region, mods, isRest });
    if (next.phase === 'ended') return next;

    // 6. Cargo condition
    next = applyCargoDecay(next, { place, isRest, weatherKey: state.weather.today });

    // 7. Hired guards: deserters when rations are cut
    const cutRations = next.rationLevel !== 'filling';
    next = { ...next, hired: next.hired.map((hire) => (hire.type === 'guard' ? { ...hire, hungryDays: cutRations ? hire.hungryDays + 1 : 0 } : hire)) };
    const deserters = next.hired.filter((hire) => hire.type === 'guard' && hire.hungryDays >= TUNING.GUARD_DESERT_DAYS || (hire.type === 'guard' && rationsSatisfaction < 1));
    if (deserters.length > 0) {
      next = { ...next, hired: next.hired.filter((hire) => !deserters.includes(hire)) };
      next = State.makeNote(next, 'Hungry guards desert in the night.');
    }

    // 8. A telegraphing vignette
    next = maybeAddVignette(next, random);
    return State.makeNote(next, `Night in a ${place === 'camp' ? 'camp' : (place === 'sarai' ? 'sarai' : 'city lodging')}. ${Config.WEATHER[state.weather.today].label}.`);
  }

  function rollNewIllness(state, random, ctx) {
    const mods = ctx.mods;
    const { place, region, weather } = ctx;
    let next = state;
    for (const index of State.getLivingIndices(state)) {
      const member = next.party[index];
      if (member.illness) continue;
      let probability = TUNING.SICK_BASE_PER_PERSON * weather.sick * (1 + 0.25 * region.threat.disease);
      const crowded = place !== 'camp' && (region.threat.disease >= 3 || ['peshawar', 'varanasi'].includes(state.nodeId));
      if (crowded) probability *= 1 + TUNING.SICK_CROWD;
      if (place === 'sarai' || place === 'city') probability += TUNING.SARAI_KITCHEN_DYSENTERY * State.getMod(mods, 'kitchenMult', 1);
      if (place === 'camp' && ['hot', 'extreme', 'dust'].includes(state.weather.today)) probability *= 1 + TUNING.SICK_BAD_WATER * 0.5;
      if (ctx.isRest) probability -= 0;
      if (!random.chance(probability)) continue;
      const wet = weather.wet || ['r10', 'r11', 'r12'].includes(region.id);
      let illness = wet ? (random.chance(0.6) ? 'fever' : 'dysentery') : (random.chance(0.35) ? 'fever' : 'dysentery');
      if (illness === 'dysentery' && !random.chance(Math.min(1, State.getMod(mods, 'dysenteryMult', 1)))) illness = 'fever';
      next = State.makeMemberSick(next, member.id, illness);
    }
    // Heat sickness: extreme heat on the road without shelter, worse at hard pace (GDD 7.4).
    if (!ctx.isRest && state.weather.today === 'extreme' && place === 'camp') {
      const healthy = State.getLivingIndices(next).filter((index) => !next.party[index].illness);
      const paceFactor = state.pace === 'steady' ? 1 : 1.6;
      healthy.forEach((index) => { if (random.chance(TUNING.HEAT_SICK_CHANCE * paceFactor)) next = State.makeMemberSick(next, next.party[index].id, 'heat'); });
    }
    return next;
  }

  /** Bandits, wildlife and theft at night (GDD 7.7). City nights are safe from attacks. */
  function rollNightAttacks(state, random, ctx) {
    if (ctx.place === 'city') return state;
    const { place, region, mods } = ctx;
    const nightFactor = place === 'sarai' ? TUNING.SARAI_ATTACK_FACTOR : TUNING.CAMP_ATTACK_FACTOR;
    const guards = state.hired.filter((hire) => hire.type === 'guard');
    const guardStrength = guards.reduce((sum, hire) => sum + Config.SERVICES.guard.tiers.find((tier) => tier.id === hire.tier).strength, 0);
    let next = state;

    const attackRolls = [['bandit', region.threat.bandit, 0], ['wildlife', region.threat.wildlife, State.getMod(mods, 'wildlifeDefenceBonus', 0)]];
    for (const [kind, threat, extraDefence] of attackRolls) {
      if (!random.chance(TUNING.ATTACK_BASE * threat * nightFactor)) continue;
      const defence = 1 - Math.exp(-TUNING.DEFENCE_RATE * guardStrength) + extraDefence;
      const repel = Math.max(0.05, Math.min(0.95, TUNING.REPEL_BASE + defence - TUNING.REPEL_PER_THREAT * threat));
      if (random.chance(repel)) { next = State.makeNote(next, kind === 'bandit' ? 'Robbers test the camp and are driven off.' : 'Wild animals prowl and are driven off.'); continue; }
      next = applyAttackLoss(next, random, kind, mods, guards);
      if (next.phase === 'ended') return next;
    }
    const theftThreat = region.threat.theft;
    if (theftThreat > 0 && random.chance(0.012 * theftThreat * State.getMod(mods, 'theftMult', 1) * (place === 'sarai' ? TUNING.SARAI_THEFT_FACTOR : 0.4))) {
      const loss = Math.round(next.money * (0.03 + 0.05 * random.next()));
      next = State.makeNote(State.adjustResources(next, { money: -loss }), `A thief lifts ${loss} rupees.`);
    }
    return next;
  }

  function applyAttackLoss(state, random, kind, mods, guards) {
    let next = state;
    if (kind === 'wildlife') {
      if (random.chance(0.5) && next.animals.length > 0) return State.makeNote(State.loseAnimal(next, null), 'Wild animals drag down a pack animal.');
      const living = State.getLivingIndices(next);
      const victim = next.party[random.pick(living)];
      return State.makeNote(State.changeMemberHealth(next, victim.id, -random.range(10, 25), 'violence'), `${victim.name} is mauled in the night.`);
    }
    const roll = random.next() * 5;
    if (roll < 2) {
      const fraction = TUNING.ATTACK_LOSS_PURSE[0] + random.next() * (TUNING.ATTACK_LOSS_PURSE[1] - TUNING.ATTACK_LOSS_PURSE[0]);
      const loss = Math.round(next.money * fraction);
      next = State.makeNote(State.adjustResources(next, { money: -loss }), `Robbers take ${loss} rupees from the purse.`);
    } else if (roll < 4 && next.cargo && next.cargo.units > 0) {
      const fraction = TUNING.ATTACK_LOSS_CARGO[0] + random.next() * (TUNING.ATTACK_LOSS_CARGO[1] - TUNING.ATTACK_LOSS_CARGO[0]);
      const loss = Math.max(1, Math.round(next.cargo.units * fraction));
      next = State.makeNote({ ...next, cargo: { ...next.cargo, units: Math.max(0, next.cargo.units - loss) } }, `Robbers take ${loss} lots of cargo.`);
    } else if (next.animals.length > 0) {
      next = State.makeNote(State.loseAnimal(next, null), 'Robbers drive off a pack animal and its load.');
    }
    if (guards.length > 0 && random.chance(0.3)) {
      next = { ...next, hired: next.hired.filter((hire, index) => !(hire.type === 'guard' && index === next.hired.findIndex((item) => item.type === 'guard'))) };
      next = State.makeNote(next, 'A guard is lost in the fight.');
    }
    return next;
  }

  /** Cargo condition falls with wet and heat (GDD 6.7); covers cut wet damage. */
  function applyCargoDecay(state, ctx) {
    if (!state.cargo || state.cargo.units <= 0) return state;
    if (ctx.place === 'city' || (ctx.place === 'sarai' && ctx.isRest)) return state;
    const fragile = Config.CARGO[state.cargo.id].fragile;
    const weather = Config.WEATHER[ctx.weatherKey];
    let loss = 0;
    const isSafe = (state.flags.boatSafeUntil || 0) > state.dayIndex;
    if (weather.wet && !isSafe) loss += fragile.wet * (state.supplies.covers > 0 ? 0.2 : 1) * (ctx.weatherKey === 'monsoon' ? 1.5 : 1);
    if (['hot', 'extreme'].includes(ctx.weatherKey)) loss += fragile.heat * (ctx.weatherKey === 'extreme' ? 2 : 1);
    if (['cold', 'snow'].includes(ctx.weatherKey)) loss += fragile.cold;
    if (loss <= 0) return state;
    return { ...state, cargo: { ...state.cargo, condition: Math.max(0, State.roundToTenth(state.cargo.condition * 1000 - loss * 1000) / 1000) } };
  }

  /** A short scene that hints at tomorrow's weather or a threat, true about 70% of the time. */
  function maybeAddVignette(state, random) {
    if (!random.chance(0.4)) return state;
    const region = State.getRegionOfState(state);
    const tomorrow = computeWeatherChain(state, 1)[0];
    const kindFor = { rain: 'rain', monsoon: 'rain', hot: 'heat', extreme: 'heat', cold: 'cold', snow: 'cold', fog: 'fog', dust: 'heat' };
    let truth = kindFor[tomorrow] || 'calm';
    if (truth === 'calm' && region.threat.bandit >= 3) truth = 'bandit';
    if (truth === 'calm' && region.threat.wildlife >= 3) truth = 'wildlife';
    if (truth === 'calm' && (region.fodder === 'scarce' || region.fodder === 'none')) truth = 'fodder';
    const kinds = Object.keys(Content.VIGNETTES).filter((kind) => kind !== 'calm');
    const kind = truth === 'calm' ? 'calm' : (random.chance(0.7) ? truth : random.pick(kinds));
    let pool = kind === 'calm' ? Content.REGION_FLAVOUR[region.id] : Content.VIGNETTES[kind];
    pool = pool.filter((text) => !state.vignettesSeen.includes(text));
    if (pool.length === 0) pool = kind === 'calm' ? Content.REGION_FLAVOUR[region.id] : Content.VIGNETTES[kind];
    const text = random.pick(pool);
    return { ...state, vignette: text, vignettesSeen: [...state.vignettesSeen, text].slice(-80) };
  }

  // ---------------------------------------------------------------------------
  // Rest days and provisioning (GDD 8)
  // ---------------------------------------------------------------------------

  /** Which skin the region offers today (hunt, fish or forage), drawn by rating weight. */
  function pickSkin(state) {
    const region = State.getRegionOfState(state);
    const weights = { hunt: region.hunt, fish: region.fish, forage: region.forage };
    const total = weights.hunt + weights.fish + weights.forage;
    if (total <= 0) return null;
    let remaining = State.createKeyedSource(state.worldSeed, `skin|${region.id}|${state.dayIndex}`).next() * total;
    for (const skin of ['hunt', 'fish', 'forage']) { remaining -= weights[skin]; if (remaining <= 0) return skin; }
    return 'forage';
  }

  /** How good fodder cutting is in a region: from the region's fodder rating. 0 means none to cut. */
  const FODDER_RATING = Object.freeze({ none: 0, scarce: 1, ok: 2, plentiful: 3 });

  /**
   * One rest day, in a city or on the road. In a city you buy what you need, so nothing is offered.
   * On the road the player may gather food (hunt, fish or forage) or cut fodder (a pending
   * 'provision' decision) before the night.
   */
  function restDay(state, random, options) {
    if ((state.phase !== 'stop' && state.phase !== 'road') || state.pending) return state;
    const mode = state.phase === 'stop' ? 'city' : 'road';
    let next = beginDay(state, { isRest: true, mode });
    if (mode === 'city') return continueDay({ ...next, dayStage: 'evening' }, random, options);
    const foodSkin = pickSkin(next);
    const region = State.getRegionOfState(next);
    const foodRating = foodSkin ? region[foodSkin] : 0;
    const fodderRating = FODDER_RATING[region.fodder] || 0;
    const hasFood = Boolean(foodSkin) && foodRating >= 0.2;
    if (!hasFood && fodderRating <= 0) return continueDay({ ...next, dayStage: 'evening' }, random, options);
    return { ...next, dayStage: 'evening', pending: { kind: 'provision', data: { skin: hasFood ? foodSkin : null, rating: hasFood ? foodRating : 0, fodderRating, mode } } };
  }

  /** What resting `days` days in a city will cost, so the player can decide before committing. */
  function estimateRestCost(state, days) {
    const count = Math.max(1, Math.min(10, Math.floor(days) || 1));
    const rations = Math.ceil(State.getRationsPerDay(state) * count);
    const feeds = Math.ceil(State.getFeedsPerDay(state, { weatherKey: state.weather.today, grazeShare: 0 }) * count);
    const money = state.phase === 'stop' && state.nodeId !== 'khyber' ? Math.ceil(State.getLodgingFee(state) * count) : 0;
    return { days: count, rations, feeds, money, isRationsShort: rations > state.supplies.rations, isFeedsShort: feeds > state.supplies.feeds, isMoneyShort: money > state.money };
  }

  /**
   * Applies a minigame score, or declines (score null). Then the night runs.
   * @param {number|null} score 0-1
   */
  function resolveProvision(state, random, score, options, chosenSkin) {
    if (!state.pending || state.pending.kind !== 'provision') return state;
    const data = state.pending.data;
    const skin = chosenSkin || data.skin || 'fodder';
    const rating = skin === 'fodder' ? data.fodderRating : data.rating;
    let next = { ...state, pending: null };
    if (score !== null && score !== undefined) next = applyProvisionYield(next, skin, rating, Math.max(0, Math.min(1, score)));
    return continueDay(next, random, options);
  }

  /** Cutting fodder: feeds only, no rations. A good session gathers about a day of feed. */
  function applyFodderYield(state, rating, score) {
    const region = State.getRegionOfState(state);
    const settings = Config.PROVISION;
    const stock = state.regionStock[region.id];
    const feedNeed = State.getFeedsPerDay(state, {});
    const weatherMult = ['rain', 'dust'].includes(state.weather.today) ? 0.8 : 1;
    let feedGain = feedNeed * settings.FODDER_DAY_FRACTION * (rating / 3) * (0.4 + 0.6 * score) * weatherMult * stock;
    feedGain = Math.max(0, Math.min(feedGain, State.getFreeCapacity(state) / Config.UNITS.FEED_LU));
    feedGain = State.roundToTenth(feedGain);
    let next = State.adjustResources(state, { feeds: feedGain });
    const newStock = Math.max(0, stock - (settings.FODDER_STOCK_COST_BASE + settings.FODDER_STOCK_COST_PER_SCORE * score));
    next = { ...next, regionStock: { ...next.regionStock, [region.id]: newStock } };
    return State.makeNote(next, `Cutting fodder brings ${feedGain} feeds.`);
  }

  function applyProvisionYield(state, skin, rating, score) {
    if (skin === 'fodder') return applyFodderYield(state, rating, score);
    const mods = State.getModifiers(state);
    const region = State.getRegionOfState(state);
    const people = State.getLivingCount(state) + State.getGuardCount(state);
    const ration = Config.RATIONS[state.rationLevel].perPerson;
    const dailyFood = people * ration;
    const skinMult = { hunt: State.getMod(mods, 'huntMult', 1), fish: State.getMod(mods, 'fishMult', 1), forage: State.getMod(mods, 'forageMult', 1) }[skin];
    const weatherMult = ['rain', 'dust'].includes(state.weather.today) ? 0.8 : 1;
    const stock = state.regionStock[region.id];
    let yieldRations = dailyFood * 0.8 * (rating / 3) * (0.4 + 0.6 * score) * Config.PROVISION.SKIN_YIELD[skin]
      * State.getMod(mods, 'provisionMult', 1) * skinMult * weatherMult * stock;
    yieldRations = Math.min(yieldRations, Config.PROVISION.MAX_SESSION_FRACTION_OF_DAY * dailyFood * 1.5);
    let foodGain = yieldRations;
    let feedGain = 0;
    if (skin === 'forage') {
      foodGain = 0.5 * yieldRations * State.getMod(mods, 'provisionFoodMult', 1);
      const feedNeed = State.getFeedsPerDay(state, {});
      feedGain = Math.min(0.8 * feedNeed, 0.5 * (yieldRations / Math.max(0.01, dailyFood)) * feedNeed);
    } else {
      foodGain = yieldRations * State.getMod(mods, 'provisionFoodMult', 1);
    }
    const room = State.getFreeCapacity(state);
    foodGain = Math.max(0, Math.min(foodGain, room / Config.UNITS.RATION_LU));
    feedGain = Math.max(0, Math.min(feedGain, (room - foodGain * Config.UNITS.RATION_LU) / Config.UNITS.FEED_LU));
    foodGain = State.roundToTenth(foodGain);
    feedGain = State.roundToTenth(feedGain);
    let next = State.adjustResources(state, { rations: foodGain, feeds: feedGain });
    const newStock = Math.max(0, stock - (Config.PROVISION.STOCK_COST_BASE + Config.PROVISION.STOCK_COST_PER_SCORE * score));
    next = { ...next, regionStock: { ...next.regionStock, [region.id]: newStock }, stats: { ...next.stats, provisionRations: next.stats.provisionRations + foodGain } };
    const label = { hunt: 'hunting', fish: 'fishing', forage: 'foraging' }[skin];
    return State.makeNote(next, `${label[0].toUpperCase()}${label.slice(1)} brings ${foodGain} rations${feedGain > 0 ? ` and ${feedGain} feeds` : ''}.`);
  }

  /**
   * News the player must not miss: illness, recovery, weakness, deaths of people and animals.
   * Compares two states; returns [{tone, text}] with tone 'danger', 'warning' or 'info'.
   */
  function detectAlerts(before, after) {
    const alerts = [];
    if (!before || !after || after.phase === 'ended' || before.worldSeed !== after.worldSeed) return alerts;
    const weakHp = Config.TUNING.WEAK_HP;
    after.party.forEach((member) => {
      const old = before.party.find((item) => item.id === member.id);
      if (!old) return;
      if (old.isAlive && !member.isAlive) alerts.push({ tone: 'danger', text: `${member.name} has died (${member.cause || 'exhaustion'}).` });
      else if (member.isAlive && !old.illness && member.illness) alerts.push({ tone: 'warning', text: `${member.name} has fallen ill with ${Config.ILLNESSES[member.illness].label.toLowerCase()}. Rest, or use medicine from the Caravan tab.` });
      else if (member.isAlive && old.illness && !member.illness) alerts.push({ tone: 'info', text: `${member.name} has recovered.` });
      else if (member.isAlive && old.hp >= weakHp && member.hp < weakHp) alerts.push({ tone: 'warning', text: `${member.name} is weak (health ${Math.round(member.hp)}). Rest or ease the pace.` });
    });
    before.animals.forEach((old) => {
      const now = after.animals.find((item) => item.id === old.id);
      const label = Config.ANIMALS[old.type].label.toLowerCase();
      if (!now) alerts.push({ tone: 'danger', text: `Your ${label} has died.` });
      else if (old.hp >= weakHp && now.hp < weakHp) alerts.push({ tone: 'warning', text: `Your ${label} is weak and tiring. Rest, feed it, or lighten the load.` });
    });
    return alerts;
  }

  /** Waits n days in a city without provisioning (used by storylets and bots). */
  function passCityDays(state, random, days) {
    let next = state;
    for (let day = 0; day < days && next.phase !== 'ended'; day += 1) {
      next = beginDay(next, { isRest: true, mode: 'city' });
      next = continueDay({ ...next, dayStage: 'evening' }, random, { saraiPolicy: 'never' });
      if (next.pending) break;
    }
    return next;
  }

  /** Ends the journey at Dhaka after the final sales. */
  function finishAtDhaka(state) {
    if (state.nodeId !== World.FINAL_NODE_ID || state.phase !== 'stop') return state;
    return State.finishJourney(State.makeNote(state, 'You reach Dhaka and complete the journey.'), 'arrived', 'general');
  }

  namespace.Engine = Object.freeze({
    drawWeatherFor, computeWeatherChain, getForecast, getRiverLevel, computeKosToday, estimateLegDays, computeSupplyForecast,
    getRegionBriefing, addRumours, buySupply, buyAnimal, getAnimalPrice, getHirePrice, hireService,
    getOverload, jettison, autoJettison, beginLeg, advanceDay, continueDay, chooseNight, presentNext,
    pickSkin, restDay, estimateRestCost, detectAlerts, resolveProvision, passCityDays, finishAtDhaka, isSaraiAvailable, hasHire, beginDay,
  });
})(window.Karvanyan);
