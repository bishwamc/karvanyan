/**
 * state.js — central state manager.
 *
 * Responsibilities:
 *   1. Create the game state from an opening setup, and transform it. Every transition returns a
 *      NEW object; nothing here mutates the state it receives.
 *   2. Calendar, modifiers (roles, flaws, archetype, hires), load and capacity.
 *   3. Markets (price formula, lots, saturation), scoring.
 *   4. Persistence with an in-memory fallback, and sanitising of anything loaded from disk.
 *
 * @typedef {Object} PartyMember
 * @property {string} id
 * @property {string|null} candidateId
 * @property {string} name
 * @property {string|null} role            key of Config.ROLES; null for the leader
 * @property {number} hp                   0-100
 * @property {boolean} isAlive
 * @property {'fever'|'dysentery'|'heat'|null} illness
 * @property {number} restDays             rest days spent with this illness
 * @property {Object<string,number>} mods  strength + flaw modifiers
 * @property {string|null} cause
 * @property {number|null} dayOfDeath
 *
 * @typedef {Object} Animal
 * @property {string} id
 * @property {string} type                 key of Config.ANIMALS
 * @property {number} hp                   0-100
 * @property {number} quality              0.6-1.0, scales capacity at purchase
 *
 * @typedef {Object} Pending
 * @property {'storylet'|'crossing'|'night'|'provision'|'jettison'|'checkpoint'} kind
 * @property {string} [id]
 * @property {Object} [data]
 *
 * @typedef {Object} GameState  (see createNewGame for every field)
 *
 * @typedef {Object} RandomSource
 * @property {() => number} next
 * @property {(probability:number) => boolean} chance
 * @property {(minimum:number, maximum:number) => number} range     inclusive integers
 * @property {(items:Array) => *} pick
 * @property {() => number} getState
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;
  const World = namespace.World;
  const Content = namespace.Content;

  // ---------------------------------------------------------------------------
  // Numbers, text, hashing, random
  // ---------------------------------------------------------------------------

  function clampNumber(value, minimum, maximum, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value));
  }

  function roundToTenth(value) { return Math.round(value * 10) / 10; }

  function sanitizeText(value, maximumLength, fallback) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, maximumLength);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  /** FNV-1a 32-bit hash of a string. Used for checksums and keyed random streams. */
  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  /** @returns {RandomSource} mulberry32 generator. Same state in, same numbers out. */
  function createRandomSource(initialState) {
    let internalState = initialState >>> 0;
    function next() {
      internalState = (internalState + 0x6d2b79f5) >>> 0;
      let mixed = internalState;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      chance: (probability) => next() < probability,
      range: (minimum, maximum) => minimum + Math.floor(next() * (maximum - minimum + 1)),
      pick: (items) => items[Math.floor(next() * items.length)],
      getState: () => internalState,
    };
  }

  /** A random stream fixed by the world seed and a key (e.g. weather for day 12), so reloads agree. */
  function createKeyedSource(worldSeed, key) {
    return createRandomSource((hashText(String(key)) ^ (worldSeed >>> 0)) >>> 0);
  }

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

  const findArchetype = (archetypeId) => Config.ARCHETYPES.find((item) => item.id === archetypeId) || null;
  const findCandidate = (candidateId) => Content.CANDIDATES.find((item) => item.id === candidateId) || null;
  const findCard = (cardId) => Content.CODEX.find((item) => item.id === cardId) || null;
  const getNode = (state) => World.findNode(state.nodeId);
  const getEdge = (state) => (state.edgeId ? World.findEdge(state.edgeId) : null);
  const getRegionOfState = (state) => {
    const edge = getEdge(state);
    return World.getRegion(edge ? edge.region : getNode(state).region);
  };
  const getArchetype = (state) => findArchetype(state.archetypeId);

  // ---------------------------------------------------------------------------
  // Calendar (GDD 6.1)
  // ---------------------------------------------------------------------------

  /** @returns {Date} UTC date of the current day */
  function getDate(state) {
    return new Date(Date.UTC(Config.CALENDAR.JOURNEY_YEAR, state.startMonthIndex, Config.CALENDAR.START_DAY_OF_MONTH + state.dayIndex));
  }

  function formatDate(state) {
    const date = getDate(state);
    return `${date.getUTCDate()} ${Config.CALENDAR.MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function computeJulianDayNumber(year, month, day) {
    const shift = Math.floor((14 - month) / 12);
    const adjustedYear = year + 4800 - shift;
    const adjustedMonth = month + 12 * shift - 3;
    return day + Math.floor((153 * adjustedMonth + 2) / 5) + 365 * adjustedYear + Math.floor(adjustedYear / 4)
      - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) - 32045;
  }

  /** Tabular civil Islamic year; may differ from observation by a day or two, so only the year is shown. */
  function computeIslamicYear(date) {
    const julianDayNumber = computeJulianDayNumber(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    return Math.floor((30 * (julianDayNumber - 1948440) + 10646) / 10631);
  }

  const getHijriLabel = (state) => `${computeIslamicYear(getDate(state))} AH`;

  /** Number of days from the current date to the first of a month (0-based), at least 1. */
  function daysUntilMonthStart(state, monthIndex) {
    let cursor = state.dayIndex;
    for (let guard = 0; guard < 400; guard += 1) {
      cursor += 1;
      const date = new Date(Date.UTC(Config.CALENDAR.JOURNEY_YEAR, state.startMonthIndex, Config.CALENDAR.START_DAY_OF_MONTH + cursor));
      if (date.getUTCMonth() === monthIndex && date.getUTCDate() === 1) return cursor - state.dayIndex;
    }
    return 1;
  }

  // ---------------------------------------------------------------------------
  // Modifiers: roles + candidate strengths/flaws + archetype + hires -> one table
  // ---------------------------------------------------------------------------

  function mergeModifiers(target, source) {
    Object.keys(source).forEach((key) => {
      if (key.endsWith('Mult')) target[key] = (target[key] === undefined ? 1 : target[key]) * source[key];
      else target[key] = (target[key] || 0) + source[key];
    });
  }

  /**
   * Aggregated modifiers from living members, the archetype and active hires.
   * Keys ending in Mult multiply; every other key adds.
   * @returns {Object<string,number>}
   */
  function getModifiers(state) {
    const mods = {};
    const archetype = getArchetype(state);
    if (archetype) { mergeModifiers(mods, archetype.expert); mergeModifiers(mods, archetype.weakness); }
    state.party.forEach((member) => {
      if (!member.isAlive) return;
      if (member.role && Config.ROLES[member.role]) mergeModifiers(mods, Config.ROLES[member.role].effects);
      mergeModifiers(mods, member.mods || {});
    });
    return mods;
  }

  const getMod = (mods, key, neutral) => (mods[key] === undefined ? neutral : mods[key]);

  // ---------------------------------------------------------------------------
  // Party, animals, supplies
  // ---------------------------------------------------------------------------

  const getLivingIndices = (state) => state.party.map((member, index) => (member.isAlive ? index : -1)).filter((index) => index >= 0);
  const getLivingCount = (state) => getLivingIndices(state).length;
  const getLeader = (state) => state.party.find((member) => member.isAlive) || null;
  const getSickCount = (state) => state.party.filter((member) => member.isAlive && member.illness).length;
  const getWeakCount = (state) => state.party.filter((member) => member.isAlive && member.hp < Config.TUNING.WEAK_HP).length;

  const getActiveHires = (state, type) => state.hired.filter((hire) => hire.type === type);
  const getGuardCount = (state) => getActiveHires(state, 'guard').length;

  /** Effective capacity of one animal in LU. */
  function getAnimalCapacity(animal, mods) {
    let capacity = Config.ANIMALS[animal.type].capacity * animal.quality;
    if (animal.type === 'camel') capacity *= getMod(mods, 'camelCapMult', 1);
    if (animal.type === 'mule' || animal.type === 'donkey' || animal.type === 'ox') capacity *= getMod(mods, 'smallCapMult', 1);
    return capacity;
  }

  const getCapacity = (state) => {
    const mods = getModifiers(state);
    return roundToTenth(state.animals.reduce((sum, animal) => sum + getAnimalCapacity(animal, mods), 0));
  };

  function getLoad(state) {
    const mods = getModifiers(state);
    const cargoLoad = state.cargo ? state.cargo.units * Config.CARGO[state.cargo.id].lu : 0;
    const supplies = state.supplies;
    return roundToTenth(
      supplies.rations * Config.UNITS.RATION_LU + supplies.feeds * Config.UNITS.FEED_LU
      + supplies.medicine * Config.UNITS.MEDICINE_LU + supplies.covers * Config.UNITS.COVER_LU
      + cargoLoad + (mods.heavyPots || 0),
    );
  }

  const getFreeCapacity = (state) => roundToTenth(getCapacity(state) - getLoad(state));

  /** Speed multiplier from overload (GDD 7.3). */
  function getLoadFactor(state) {
    const capacity = getCapacity(state);
    const load = getLoad(state);
    if (load <= capacity || capacity <= 0) return capacity <= 0 ? Config.TUNING.MIN_LOAD_FACTOR : 1;
    const mods = getModifiers(state);
    const penalty = Config.TUNING.OVERLOAD_PENALTY * getMod(mods, 'overloadMult', 1);
    return Math.max(Config.TUNING.MIN_LOAD_FACTOR, 1 - penalty * (load - capacity) / capacity);
  }

  /** Rations eaten per day by the party and guards. */
  function getRationsPerDay(state) {
    const mods = getModifiers(state);
    const perPerson = Config.RATIONS[state.rationLevel].perPerson * getMod(mods, 'rationMult', 1);
    const partyEaters = state.party.reduce((sum, member) => sum + (member.isAlive ? (member.mods && member.mods.appetite ? 1.3 : 1) : 0), 0);
    return (partyEaters + getGuardCount(state)) * perPerson;
  }

  /**
   * Feeds eaten per day (before grazing).
   * @param {{weatherKey?:string, grazeShare?:number}} [options]
   */
  function getFeedsPerDay(state, options) {
    const mods = getModifiers(state);
    const weatherFactor = options && options.weatherKey ? Config.WEATHER[options.weatherKey].fodder : 1;
    const paceFactor = state.pace === 'steady' ? 1 : (state.pace === 'hard' ? 1.1 : 1.2);
    const grazing = options && options.grazeShare ? options.grazeShare : 0;
    let total = 0;
    state.animals.forEach((animal) => {
      let feed = Config.ANIMALS[animal.type].feed * getMod(mods, 'feedMult', 1);
      if (animal.type === 'horse') feed *= getMod(mods, 'horseFeedMult', 1);
      total += feed * paceFactor * weatherFactor * (1 - grazing);
    });
    return total;
  }

  const makeNote = (state, text) => ({ ...state, log: [...state.log, { dayIndex: state.dayIndex, text }].slice(-Config.LIMITS.MAX_LOG_ENTRIES) });

  const patchState = (state, patch) => ({ ...state, ...patch });

  /** Adds deltas to money and supplies, never below zero. */
  function adjustResources(state, deltas) {
    const next = { ...state, supplies: { ...state.supplies } };
    if (typeof deltas.money === 'number') next.money = Math.max(0, Math.round(state.money + deltas.money));
    ['rations', 'feeds', 'medicine', 'covers'].forEach((key) => {
      if (typeof deltas[key] === 'number') next.supplies[key] = roundToTenth(Math.max(0, state.supplies[key] + deltas[key]));
    });
    return next;
  }

  function updateMember(state, memberId, patch) {
    return { ...state, party: state.party.map((member) => (member.id === memberId ? { ...member, ...patch } : member)) };
  }

  function updateAnimal(state, animalId, patch) {
    return { ...state, animals: state.animals.map((animal) => (animal.id === animalId ? { ...animal, ...patch } : animal)) };
  }

  const getMemberHpCap = (member) => (member.mods && member.mods.frail ? 80 : 100);

  /**
   * Changes a member's health. At zero they die; if nobody is left the journey ends.
   * @returns {Object} state
   */
  function changeMemberHealth(state, memberId, delta, cause) {
    const member = state.party.find((item) => item.id === memberId);
    if (!member || !member.isAlive || state.phase === 'ended') return state;
    const hp = clampNumber(member.hp + delta, 0, getMemberHpCap(member), member.hp);
    if (hp > 0) return updateMember(state, memberId, { hp: roundToTenth(hp) });

    let next = updateMember(state, memberId, { hp: 0, isAlive: false, illness: null, cause, dayOfDeath: state.dayIndex });
    next = makeNote(next, `${member.name} died (${cause}).`);
    next = { ...next, graveLines: [...(next.graveLines || []), { name: member.name, role: member.role, cause, regionId: getRegionOfState(next).name, dayIndex: state.dayIndex }].slice(-8) };
    if (getLivingCount(next) === 0) return finishJourney(next, 'died', cause);
    // The first living member leads. Losing the original leader costs a one-time score penalty.
    if (memberId === 'm0' && !next.flags.leaderDied) next = { ...next, flags: { ...next.flags, leaderDied: true } };
    return next;
  }

  function changeAllHealth(state, delta, cause) {
    let next = state;
    getLivingIndices(state).forEach((index) => { next = changeMemberHealth(next, state.party[index].id, delta, cause); });
    return next;
  }

  function makeMemberSick(state, memberId, illness) {
    const member = state.party.find((item) => item.id === memberId);
    if (!member || !member.isAlive || member.illness || !Config.ILLNESSES[illness]) return state;
    return makeNote(updateMember(state, memberId, { illness, restDays: 0 }), `${member.name} falls ill (${Config.ILLNESSES[illness].label.toLowerCase()}).`);
  }

  function cureMember(state, memberId) {
    const member = state.party.find((item) => item.id === memberId);
    if (!member || !member.isAlive || !member.illness) return state;
    return makeNote(updateMember(state, memberId, { illness: null, restDays: 0 }), `${member.name} recovers.`);
  }

  function getCureChance(state, illness) {
    const base = Config.ILLNESSES[illness].medicineCure;
    if (base <= 0) return 0;
    const mods = getModifiers(state);
    let chance = base + (illness === 'dysentery' ? getMod(mods, 'cureBonus', 0) : 0);
    if (illness === 'dysentery' && state.codex.includes('pes_hakim')) chance += 0.05;
    return Math.min(1, chance);
  }

  /** Uses one medicine on a sick member (a Treat button for every sickness). */
  function treatMember(state, memberId, random) {
    const member = state.party.find((item) => item.id === memberId);
    if (!member || !member.isAlive || !member.illness || state.supplies.medicine < 1) return { state, wasCured: false, wasPerformed: false };
    const mods = getModifiers(state);
    const usesNoMedicine = mods.thriftyTreatment && (state.stats.treatments % 2 === 1);
    let next = adjustResources(state, { medicine: usesNoMedicine ? 0 : -1 });
    next = { ...next, stats: { ...next.stats, treatments: next.stats.treatments + 1 } };
    if (random.chance(getCureChance(state, member.illness))) return { state: cureMember(next, memberId), wasCured: true, wasPerformed: true };
    return { state: makeNote(next, `The medicine does not cure ${member.name} this time.`), wasCured: false, wasPerformed: true };
  }

  const changeAnimalHealth = (state, animalId, delta) => {
    const animal = state.animals.find((item) => item.id === animalId);
    if (!animal) return state;
    const hp = clampNumber(animal.hp + delta, 0, 100, animal.hp);
    if (hp > 0) return updateAnimal(state, animalId, { hp: roundToTenth(hp) });
    return makeNote({ ...state, animals: state.animals.filter((item) => item.id !== animalId) }, `A ${Config.ANIMALS[animal.type].label.toLowerCase()} dies on the road.`);
  };

  /** Removes the weakest animal (used by events). */
  function loseAnimal(state, random) {
    if (state.animals.length === 0) return state;
    const mods = getModifiers(state);
    if (random && random.chance(1 - getMod(mods, 'animalLossMult', 1))) return state;
    const weakest = [...state.animals].sort((first, second) => first.hp - second.hp)[0];
    return changeAnimalHealth(state, weakest.id, -999);
  }

  function learnCard(state, cardId) {
    if (!findCard(cardId) || state.codex.includes(cardId)) return state;
    return { ...state, codex: [...state.codex, cardId] };
  }

  const addQuality = (state, name, delta) => ({ ...state, qualities: { ...state.qualities, [name]: clampNumber((state.qualities[name] || 0) + delta, -10, 50, 0) } });
  const setFlag = (state, name, value) => ({ ...state, flags: { ...state.flags, [name]: value === undefined ? true : value } });

  // ---------------------------------------------------------------------------
  // Prices and markets (GDD 3.5, 3.8)
  // ---------------------------------------------------------------------------

  /** Rupees for one purchase pack or unit at the current stop, with region and accountant factors. */
  function getBuyPrice(state, kind) {
    const region = World.getRegion(getNode(state).region);
    const mods = getModifiers(state);
    let base;
    if (kind === 'rations') base = Config.PRICES.RATION_PACK_BASE * region.rationMult;
    else if (kind === 'feeds') base = Config.PRICES.FEED_PACK_BASE * Config.TUNING.FEED_PRICE_MULT[region.fodder];
    else if (kind === 'medicine') base = Config.PRICES.MEDICINE_BASE;
    else if (kind === 'covers') base = Config.PRICES.COVER_BASE;
    else return Infinity;
    return Math.max(1, Math.round(base * getMod(mods, 'buyMult', 1)));
  }

  function getLodgingFee(state) {
    return Config.PRICES.LODGING_BASE + Config.PRICES.LODGING_PER_ANIMAL * state.animals.length;
  }

  function getSeasonFactor(cargoId, date, nodeId) {
    const cargo = Config.CARGO[cargoId];
    const month = date.getUTCMonth();
    let factor = 1;
    if (month === 10 || month === 11 || month === 0 || month === 1) factor = cargo.seasonCold;
    else if (month >= 3 && month <= 7) factor = cargo.seasonHot;
    return nodeId === 'dhaka' ? Math.pow(factor, Config.MARKET.DHAKA_SEASON_POWER) : factor;
  }

  /** Market bookkeeping for a stop: saturation of each cargo, recovering daily. */
  function getMarketRecord(state, nodeId) {
    const record = state.marketState[nodeId] || { satDay: state.dayIndex, sat: {} };
    const elapsed = Math.max(0, state.dayIndex - record.satDay);
    const sat = {};
    Object.keys(record.sat).forEach((id) => { sat[id] = Math.max(0, record.sat[id] - elapsed * Config.MARKET.SATURATION_RECOVERY_PER_DAY); });
    return { satDay: state.dayIndex, sat };
  }

  /**
   * Price of the FIRST unit sold now (GDD 3.5): P0 x demand x season x random band x saturation x condition.
   * The random draw is seeded per city, cargo and 14-day window, so a reload shows the same price.
   */
  function getCargoBasePrice(state, nodeId, cargoId) {
    const node = World.findNode(nodeId);
    if (!node || node.tier === 'none') return 0;
    const cargo = Config.CARGO[cargoId];
    const demand = node.demand[Config.CARGO_DEMAND_INDEX[cargoId]];
    const windowIndex = Math.floor(state.dayIndex / Config.MARKET.WINDOW_DAYS);
    const draw = createKeyedSource(state.worldSeed, `price|${nodeId}|${cargoId}|${windowIndex}`).next();
    const band = 1 + Config.MARKET.BAND * (2 * draw - 1);
    const mods = getModifiers(state);
    const saturation = getMarketRecord(state, nodeId).sat[cargoId] || 0;
    const condition = state.cargo ? 0.5 + 0.5 * state.cargo.condition : 1;
    return cargo.basePrice * demand * getSeasonFactor(cargoId, getDate(state), nodeId) * band
      * (1 + getMod(mods, 'saleBonus', 0)) * (1 - saturation) * condition;
  }

  /** Price range shown before arrival (rumours): +/- band. */
  function getCargoPriceRange(state, nodeId, cargoId) {
    const node = World.findNode(nodeId);
    const midpoint = Config.CARGO[cargoId].basePrice * node.demand[Config.CARGO_DEMAND_INDEX[cargoId]] * getSeasonFactor(cargoId, getDate(state), nodeId);
    return [Math.round(midpoint * (1 - Config.MARKET.BAND)), Math.round(midpoint * (1 + Config.MARKET.BAND))];
  }

  /**
   * Revenue and saturation if `units` are sold now. Unit k sells at base x (1-sigma)^k.
   * @returns {{revenue:number, units:number, newSaturation:number}}
   */
  function quoteSale(state, units) {
    if (!state.cargo || units <= 0) return { revenue: 0, units: 0, newSaturation: 0 };
    const sold = Math.min(units, state.cargo.units);
    const base = getCargoBasePrice(state, state.nodeId, state.cargo.id);
    const sigma = Config.MARKET.SATURATION_PER_UNIT;
    let revenue = 0;
    for (let index = 0; index < sold; index += 1) revenue += base * Math.pow(1 - sigma, index);
    const currentSat = getMarketRecord(state, state.nodeId).sat[state.cargo.id] || 0;
    return { revenue: Math.round(revenue), units: sold, newSaturation: 1 - (1 - currentSat) * Math.pow(1 - sigma, sold) };
  }

  /** Sells part of the cargo at the current stop. @param {number} fraction 0-1 of the units now held */
  function sellCargoLot(state, fraction) {
    if (!state.cargo || state.cargo.units <= 0 || state.phase !== 'stop') return state;
    const node = getNode(state);
    if (node.tier === 'none') return state;
    const units = Math.max(1, Math.ceil(state.cargo.units * fraction - 1e-9));
    const quote = quoteSale(state, units);
    if (quote.units <= 0) return state;
    const record = getMarketRecord(state, state.nodeId);
    let next = adjustResources(state, { money: quote.revenue });
    next = {
      ...next,
      cargo: { ...next.cargo, units: next.cargo.units - quote.units },
      marketState: { ...next.marketState, [state.nodeId]: { satDay: state.dayIndex, sat: { ...record.sat, [state.cargo.id]: quote.newSaturation } } },
      stats: { ...next.stats, salesCities: next.stats.salesCities.includes(state.nodeId) ? next.stats.salesCities : [...next.stats.salesCities, state.nodeId] },
    };
    return makeNote(next, `Sold ${quote.units} ${Config.CARGO[state.cargo.id].label.toLowerCase()} in ${node.name} for ${quote.revenue} rupees.`);
  }

  /** Surplus items sell below their buy price (GDD 3.7). */
  function sellSurplus(state, kind, amount) {
    if (state.phase !== 'stop' || getNode(state).tier === 'none') return state;
    const mods = getModifiers(state);
    const column = mods.hasAccountant ? 'accountant' : 'plain';
    if (kind === 'rations' || kind === 'feeds') {
      const sold = Math.min(amount, Math.floor(state.supplies[kind]));
      if (sold <= 0) return state;
      const packPrice = getBuyPrice(state, kind) / Config.PRICES.RATION_PACK_SIZE;
      const revenue = Math.round(sold * packPrice * Config.PRICES.SURPLUS_SALE_FACTOR[column]);
      return makeNote(adjustResources(state, { [kind]: -sold, money: revenue }), `Sold ${sold} ${kind} for ${revenue} rupees.`);
    }
    return state;
  }

  function sellAnimal(state, animalId) {
    const animal = state.animals.find((item) => item.id === animalId);
    if (!animal || state.phase !== 'stop' || getNode(state).tier === 'none') return state;
    const column = getModifiers(state).hasAccountant ? 'accountant' : 'plain';
    const revenue = Math.round(Config.ANIMALS[animal.type].price * Config.PRICES.ANIMAL_SALE_FACTOR[column] * (animal.hp / 100));
    return makeNote(adjustResources({ ...state, animals: state.animals.filter((item) => item.id !== animalId) }, { money: revenue }), `Sold a ${Config.ANIMALS[animal.type].label.toLowerCase()} for ${revenue} rupees.`);
  }

  /** Market stock for a stop (guards, scouts, animals, medicine), created once per visit window. */
  function ensurePool(state, nodeId) {
    const existing = state.pools[nodeId];
    const windowIndex = Math.floor(state.dayIndex / Config.MARKET.WINDOW_DAYS);
    if (existing && existing.windowIndex === windowIndex) return state;
    const node = World.findNode(nodeId);
    const random = createKeyedSource(state.worldSeed, `pool|${nodeId}|${windowIndex}`);
    const tierMedicine = { great: [3, 8], large: [2, 6], medium: [1, 4], small: [0, 2], none: [0, 0] }[node.tier];
    const hirees = (type, range) => {
      const count = random.range(range[0], range[1]);
      const tiers = Config.SERVICES[type].tiers;
      return Array.from({ length: count }, (_, index) => ({
        id: `${type}-${nodeId}-${windowIndex}-${index}`, tier: random.pick(tiers).id,
        name: random.pick(Content.CANDIDATES).name.split(' ')[0],
      }));
    };
    const animalTypes = node.hasAnimalMarket ? (node.animalSet === 'north' ? ['donkey', 'mule', 'camel', 'horse'] : ['donkey', 'ox', 'mule']) : [];
    const animals = [];
    animalTypes.forEach((type) => {
      const count = random.range(0, type === 'horse' ? 2 : 4);
      for (let index = 0; index < count; index += 1) animals.push({ id: `animal-${nodeId}-${windowIndex}-${type}-${index}`, type, hp: random.range(60, 100), quality: 0.6 + 0.4 * random.next() });
    });
    const pool = {
      windowIndex, medicine: random.range(tierMedicine[0], tierMedicine[1]) * (node.tier === 'none' ? 0 : 1),
      guards: hirees('guard', node.recruits.guard), scouts: hirees('scout', node.recruits.scout), animals,
    };
    return { ...state, pools: { ...state.pools, [nodeId]: pool } };
  }

  // ---------------------------------------------------------------------------
  // Creation (opening setup -> state)
  // ---------------------------------------------------------------------------

  /**
   * @param {{archetypeId:string, leaderName:string, cargoShare:number, candidateIds:string[],
   *   extraAnimals?:string[], rationPacks:number, feedPacks:number, startMonthIndex:number,
   *   pace?:string, rationLevel?:string, scout?:boolean, subplotId:string, worldSeed:number}} setup
   */
  function createNewGame(setup) {
    const archetype = findArchetype(setup.archetypeId) || Config.ARCHETYPES[0];
    const startMonthIndex = Config.CALENDAR.START_OPTIONS.some((option) => option.monthIndex === setup.startMonthIndex) ? setup.startMonthIndex : 9;
    const animals = [];
    let animalCounter = 0;
    const addAnimal = (type) => animals.push({ id: `a${animalCounter += 1}`, type, hp: 100, quality: 1 });
    Object.keys(archetype.animals).forEach((type) => { for (let index = 0; index < archetype.animals[type]; index += 1) addAnimal(type); });

    const leaderName = sanitizeText(setup.leaderName, Config.LIMITS.MAX_NAME_LENGTH, archetype.names[0]);
    const party = [{ id: 'm0', candidateId: null, name: leaderName, role: null, hp: 100, isAlive: true, illness: null, restDays: 0, mods: {}, cause: null, dayOfDeath: null }];
    (setup.candidateIds || []).slice(0, 3).forEach((candidateId, index) => {
      const candidate = findCandidate(candidateId);
      if (!candidate) return;
      const mods = {};
      mergeModifiers(mods, candidate.strength);
      mergeModifiers(mods, candidate.flaw);
      party.push({ id: `m${index + 1}`, candidateId, name: candidate.name, role: candidate.role, hp: 100, isAlive: true, illness: null, restDays: 0, mods, cause: null, dayOfDeath: null });
    });

    const cargoDefinition = Config.CARGO[archetype.cargoId];
    const purse0Target = archetype.capital * (1 - clampNumber(setup.cargoShare, 0, 1, 0.55));
    let state = {
      schemaVersion: Config.SAVE_SCHEMA_VERSION,
      archetypeId: archetype.id, subplotId: Content.SUBPLOTS[setup.subplotId] ? setup.subplotId : 'book',
      leaderName, startMonthIndex, dayIndex: 0, worldSeed: (setup.worldSeed >>> 0) || 1,
      money: Math.round(purse0Target), supplies: { rations: 0, feeds: 0, medicine: 1, covers: 0 },
      animals: animals.map((animal) => ({ ...animal })), cargo: { id: archetype.cargoId, units: 0, condition: 1 }, startWealth: archetype.capital,
      party, hired: [], nodeId: World.FIRST_NODE_ID, edgeId: null, kosOnEdge: 0, doneCrossings: [],
      pace: Config.PACES[setup.pace] ? setup.pace : 'steady', rationLevel: Config.RATIONS[setup.rationLevel] ? setup.rationLevel : 'filling',
      weather: { today: 'clear', forecast: 'clear', history: [] },
      phase: 'stop', pending: null, queue: [], dayStage: null, dayCtx: null, vignette: null,
      qualities: { reputation: 0, exposure: 0, entries: 0, clues: 0 }, flags: {}, seenStorylets: [], codex: ['kab_crossroads'],
      rumours: [], regionStock: Object.fromEntries(Object.keys(World.REGIONS).map((id) => [id, 1])),
      marketState: {}, pools: {}, vignettesSeen: [], graveLines: [],
      stats: { travelDays: 0, restDays: 0, saraiNights: 0, campNights: 0, idleDays: 0, provisionRations: 0, rationsEaten: 0, treatments: 0, salesCities: [], servicesUsed: [], saraiEligibleNights: 0 },
      log: [{ dayIndex: 0, text: 'Your caravan gathers in Kabul at dawn.' }], isPaused: false, outcome: null,
    };

    // Cargo is bought once at the Kabul price, capped by free capacity (GDD 3.4).
    state = ensurePool(state, World.FIRST_NODE_ID);
    const cargoBudget = archetype.capital - state.money;
    const maxByMoney = Math.floor(cargoBudget / cargoDefinition.basePrice);
    state.cargo.units = Math.max(0, maxByMoney);
    const capacity = getCapacity(state);
    const reservedForSupplies = Math.max(12, capacity * 0.3); // LU kept for food and fodder at the start
    const maxByCapacity = Math.max(0, Math.floor((capacity - reservedForSupplies) / cargoDefinition.lu));
    state.cargo.units = Math.min(state.cargo.units, maxByCapacity);
    state.money += cargoBudget - state.cargo.units * cargoDefinition.basePrice; // unspent cargo budget returns to the purse
    state.startWealth = state.money + state.cargo.units * cargoDefinition.basePrice + 0.6 * animals.reduce((sum, animal) => sum + Config.ANIMALS[animal.type].price, 0);

    // Opening purchases come out of the purse (GDD 9.2 beats 5 and 6), limited by money and capacity.
    (setup.extraAnimals || []).forEach((type) => {
      const definition = Config.ANIMALS[type];
      if (!definition || state.money < definition.price || state.animals.length >= Config.LIMITS.MAX_ANIMALS) return;
      state = { ...state, money: state.money - definition.price, animals: [...state.animals, { id: `a${state.animals.length + 100}`, type, hp: 100, quality: 1 }] };
    });
    ['rations', 'feeds'].forEach((kind) => {
      const packs = Math.max(0, Math.floor(clampNumber(kind === 'rations' ? setup.rationPacks : setup.feedPacks, 0, 60, 0)));
      for (let pack = 0; pack < packs; pack += 1) {
        const price = getBuyPrice(state, kind);
        const size = Config.PRICES.RATION_PACK_SIZE;
        const lu = size * (kind === 'rations' ? Config.UNITS.RATION_LU : Config.UNITS.FEED_LU);
        if (state.money < price || getFreeCapacity(state) < lu) break;
        state = adjustResources(state, { money: -price, [kind]: size });
      }
    });
    if (setup.scout) state = { ...state, hired: [{ type: 'scout', tier: 'steady', untilNode: 'jalalabad', untilRegion: null, hungryDays: 0, name: 'Daulat Beg\'s scout' }] };
    return state;
  }

  // ---------------------------------------------------------------------------
  // Scoring and ending (GDD 3.10)
  // ---------------------------------------------------------------------------

  function getAnimalBodyValue(state) {
    return state.animals.reduce((sum, animal) => sum + Config.ANIMALS[animal.type].price * Config.PRICES.ANIMAL_BODY_VALUE_FACTOR * (animal.hp / 100), 0);
  }

  /** Subplot bonus S_sub (0-150). */
  function computeSubplotBonus(state) {
    const quality = state.qualities;
    switch (state.subplotId) {
      case 'book': return Math.max(0, quality.entries) * 30;
      case 'spy': return Math.max(0, 120 - Math.max(0, quality.exposure) * 30) + (state.flags.spy_drop ? 30 : 0);
      case 'lover': return Math.max(0, quality.clues) * 30;
      case 'government': return Math.max(0, quality.reputation) * 30;
      default: return 0;
    }
  }

  /**
   * @returns {{total:number, ratio:number, base:number, subplot:number, codex:number, finalWealth:number, verdict:string}}
   */
  function computeScore(state, hasArrived) {
    const tuning = Config.TUNING;
    const codexPoints = state.codex.length * tuning.CODEX_POINTS;
    const cargoValue = state.cargo && state.cargo.units > 0 ? quoteSale({ ...state, nodeId: 'dhaka', phase: 'stop' }, state.cargo.units).revenue : 0;
    const animalValue = getAnimalBodyValue(state);
    if (!hasArrived) {
      const carried = state.money + (state.cargo ? state.cargo.units * Config.CARGO[state.cargo.id].basePrice : 0) + animalValue;
      return { total: Math.round(carried * tuning.DEATH_SCORE_FRACTION + codexPoints), ratio: 0, base: 0, subplot: 0, codex: codexPoints, finalWealth: Math.round(carried), verdict: 'ruin' };
    }
    const finalWealth = state.money + cargoValue + animalValue;
    const ratio = finalWealth / Math.max(1, state.startWealth);
    const alive = getLivingCount(state) / state.party.length;
    const base = tuning.SCORE_SCALE * ratio * (tuning.SURVIVOR_BASE_WEIGHT + (1 - tuning.SURVIVOR_BASE_WEIGHT) * alive);
    const subplot = Math.min(tuning.SUBPLOT_BONUS_CAP, computeSubplotBonus(state));
    const codex = Math.min(codexPoints, tuning.CODEX_CAP_FRACTION * base);
    let total = (base + subplot + codex) * (getArchetype(state).scoreMultiplier || 1);
    if (state.flags.leaderDied) total *= tuning.LEADER_SUCCESSION_SCORE_FACTOR;
    const verdict = ratio < 0.08 ? 'ruin' : (ratio < 0.2 ? 'fair' : (ratio < 0.4 ? 'good' : 'great'));
    return { total: Math.round(total), ratio: Math.round(ratio * 100) / 100, base: Math.round(base), subplot, codex: Math.round(codex), finalWealth: Math.round(finalWealth), verdict };
  }

  function finishJourney(state, type, cause) {
    if (state.phase === 'ended') return state;
    const scoring = computeScore(state, type === 'arrived');
    return {
      ...state, phase: 'ended', pending: null, queue: [], dayStage: null, isPaused: true,
      outcome: { type, cause: Content.LESSONS[cause] ? cause : 'general', score: scoring.total, ratio: scoring.ratio, base: scoring.base, subplot: scoring.subplot, codex: scoring.codex, finalWealth: scoring.finalWealth, verdict: scoring.verdict, dateLabel: formatDate(state) },
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  function createStorageAdapter() {
    const memoryStore = new Map();
    let browserStorage = null;
    try {
      window.localStorage.setItem('__karvanyan_probe__', '1');
      window.localStorage.removeItem('__karvanyan_probe__');
      browserStorage = window.localStorage;
    } catch {
      browserStorage = null;
    }
    return {
      isPersistent: browserStorage !== null,
      readText(key) {
        try { return browserStorage ? browserStorage.getItem(key) : (memoryStore.get(key) ?? null); } catch { return memoryStore.get(key) ?? null; }
      },
      writeText(key, value) {
        memoryStore.set(key, value);
        if (!browserStorage) return false;
        try { browserStorage.setItem(key, value); return true; } catch { return false; }
      },
      removeKey(key) {
        memoryStore.delete(key);
        try { if (browserStorage) browserStorage.removeItem(key); } catch { /* ignore */ }
      },
    };
  }

  const storage = createStorageAdapter();

  function readJson(key, fallback) {
    const text = storage.readText(key);
    if (text === null) return fallback;
    try { return JSON.parse(text); } catch { return fallback; }
  }

  /** Copies only plain data: finite numbers, booleans, short strings, small arrays and objects. */
  function sanitizeJson(value, depth) {
    if (typeof value === 'number') return Number.isFinite(value) ? clampNumber(value, -1e7, 1e7, 0) : 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return sanitizeText(value, 240, '');
    if (depth <= 0 || value === null || typeof value !== 'object') return null;
    if (Array.isArray(value)) return value.slice(0, 300).map((item) => sanitizeJson(item, depth - 1));
    const copy = {};
    Object.keys(value).slice(0, 80).forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      copy[sanitizeText(key, 60, 'key')] = sanitizeJson(value[key], depth - 1);
    });
    return copy;
  }

  const ILLNESS_IDS = Object.keys(Config.ILLNESSES);
  const PHASES = ['stop', 'road', 'ended'];

  /** Validates raw JSON into a playable state, or returns null. */
  function sanitizeLoadedState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const archetype = findArchetype(raw.archetypeId);
    if (!archetype || !World.findNode(raw.nodeId) || !PHASES.includes(raw.phase)) return null;
    if (raw.edgeId !== null && !World.findEdge(raw.edgeId)) return null;
    if (raw.phase === 'road' && raw.edgeId === null) return null;
    if (!Array.isArray(raw.party) || raw.party.length < 1 || raw.party.length > Config.LIMITS.MAX_PARTY_SIZE) return null;
    if (!Array.isArray(raw.animals) || raw.animals.length > Config.LIMITS.MAX_ANIMALS) return null;
    const big = Config.LIMITS.MAX_AMOUNT;

    const party = raw.party.map((member, index) => ({
      id: `m${index}`, candidateId: member && findCandidate(member.candidateId) ? member.candidateId : null,
      name: sanitizeText(member && member.name, Config.LIMITS.MAX_NAME_LENGTH, `Traveller ${index + 1}`),
      role: member && Config.ROLES[member.role] ? member.role : null,
      hp: clampNumber(member && member.hp, 0, 100, 100), isAlive: Boolean(member && member.isAlive),
      illness: member && ILLNESS_IDS.includes(member.illness) ? member.illness : null, restDays: clampNumber(member && member.restDays, 0, 99, 0),
      mods: member && member.candidateId && findCandidate(member.candidateId) ? (() => { const mods = {}; const candidate = findCandidate(member.candidateId); mergeModifiers(mods, candidate.strength); mergeModifiers(mods, candidate.flaw); return mods; })() : {},
      cause: member && typeof member.cause === 'string' ? sanitizeText(member.cause, 20, 'general') : null,
      dayOfDeath: member && typeof member.dayOfDeath === 'number' ? clampNumber(member.dayOfDeath, 0, Config.LIMITS.MAX_DAYS, 0) : null,
    }));
    const animals = raw.animals.map((animal, index) => ({
      id: `a${index + 1}`, type: animal && Config.ANIMALS[animal.type] ? animal.type : 'donkey',
      hp: clampNumber(animal && animal.hp, 1, 100, 100), quality: clampNumber(animal && animal.quality, 0.5, 1, 1),
    }));
    const rawSupplies = raw.supplies && typeof raw.supplies === 'object' ? raw.supplies : {};
    const rawCargo = raw.cargo && typeof raw.cargo === 'object' ? raw.cargo : {};
    const rawWeather = raw.weather && typeof raw.weather === 'object' ? raw.weather : {};
    const weatherKeys = Config.WEATHER_STATES;

    const hired = Array.isArray(raw.hired) ? raw.hired.slice(0, 12).map((hire) => ({
      type: hire && Config.SERVICES[hire.type] ? hire.type : 'guard',
      tier: sanitizeText(hire && hire.tier, 20, 'steady'),
      untilNode: hire && World.findNode(hire.untilNode) ? hire.untilNode : null,
      untilRegion: hire && World.getRegion(hire.untilRegion) ? hire.untilRegion : null,
      hungryDays: clampNumber(hire && hire.hungryDays, 0, 20, 0),
      name: sanitizeText(hire && hire.name, 20, 'Hired hand'),
    })).filter((hire) => Config.SERVICES[hire.type].tiers.some((tier) => tier.id === hire.tier)) : [];

    const pending = raw.pending && typeof raw.pending === 'object' && ['storylet', 'crossing', 'night', 'provision', 'jettison', 'checkpoint'].includes(raw.pending.kind)
      ? { kind: raw.pending.kind, id: typeof raw.pending.id === 'string' ? sanitizeText(raw.pending.id, 60, '') : undefined, data: sanitizeJson(raw.pending.data || {}, 4) } : null;
    const outcome = raw.outcome && typeof raw.outcome === 'object' && (raw.outcome.type === 'arrived' || raw.outcome.type === 'died') ? {
      type: raw.outcome.type, cause: Content.LESSONS[raw.outcome.cause] ? raw.outcome.cause : 'general',
      score: Math.floor(clampNumber(raw.outcome.score, 0, 1e7, 0)), ratio: clampNumber(raw.outcome.ratio, 0, 1000, 0), base: clampNumber(raw.outcome.base, 0, 1e7, 0),
      subplot: clampNumber(raw.outcome.subplot, 0, 1000, 0), codex: clampNumber(raw.outcome.codex, 0, 1e6, 0), finalWealth: clampNumber(raw.outcome.finalWealth, 0, 1e8, 0),
      verdict: ['ruin', 'fair', 'good', 'great'].includes(raw.outcome.verdict) ? raw.outcome.verdict : 'fair', dateLabel: sanitizeText(raw.outcome.dateLabel, 40, ''),
    } : null;
    const regionStock = {};
    Object.keys(World.REGIONS).forEach((id) => { regionStock[id] = clampNumber(raw.regionStock && raw.regionStock[id], 0, 1, 1); });
    const qualities = {};
    ['reputation', 'exposure', 'entries', 'clues'].forEach((name) => { qualities[name] = clampNumber(raw.qualities && raw.qualities[name], -10, 50, 0); });

    return {
      schemaVersion: Config.SAVE_SCHEMA_VERSION, archetypeId: archetype.id,
      subplotId: Content.SUBPLOTS[raw.subplotId] ? raw.subplotId : 'book',
      leaderName: sanitizeText(raw.leaderName, Config.LIMITS.MAX_NAME_LENGTH, archetype.names[0]),
      startMonthIndex: Config.CALENDAR.START_OPTIONS.some((option) => option.monthIndex === raw.startMonthIndex) ? raw.startMonthIndex : 9,
      dayIndex: Math.floor(clampNumber(raw.dayIndex, 0, Config.LIMITS.MAX_DAYS, 0)), worldSeed: (Math.floor(clampNumber(raw.worldSeed, 1, 4294967295, 1))) >>> 0,
      money: Math.floor(clampNumber(raw.money, 0, big, 0)),
      supplies: { rations: clampNumber(rawSupplies.rations, 0, big, 0), feeds: clampNumber(rawSupplies.feeds, 0, big, 0), medicine: Math.floor(clampNumber(rawSupplies.medicine, 0, 999, 0)), covers: Math.floor(clampNumber(rawSupplies.covers, 0, 999, 0)) },
      animals, cargo: { id: Config.CARGO[rawCargo.id] ? rawCargo.id : archetype.cargoId, units: Math.floor(clampNumber(rawCargo.units, 0, 9999, 0)), condition: clampNumber(rawCargo.condition, 0, 1, 1) },
      startWealth: clampNumber(raw.startWealth, 1, 1e8, 1000), party, hired,
      nodeId: raw.nodeId, edgeId: raw.edgeId, kosOnEdge: clampNumber(raw.kosOnEdge, 0, 500, 0),
      doneCrossings: Array.isArray(raw.doneCrossings) ? raw.doneCrossings.filter((item) => typeof item === 'string').slice(0, 12).map((item) => item.slice(0, 40)) : [],
      pace: Config.PACES[raw.pace] ? raw.pace : 'steady', rationLevel: Config.RATIONS[raw.rationLevel] ? raw.rationLevel : 'filling',
      weather: {
        today: weatherKeys.includes(rawWeather.today) ? rawWeather.today : 'clear', forecast: weatherKeys.includes(rawWeather.forecast) ? rawWeather.forecast : 'clear',
        history: Array.isArray(rawWeather.history) ? rawWeather.history.filter((item) => weatherKeys.includes(item)).slice(-7) : [],
      },
      phase: raw.phase, pending, queue: Array.isArray(raw.queue) ? raw.queue.slice(0, 6).map((item) => sanitizeJson(item, 4)).filter((item) => item && typeof item.kind === 'string') : [],
      dayStage: raw.dayStage === 'evening' || raw.dayStage === 'night' ? raw.dayStage : null,
      dayCtx: raw.dayCtx && typeof raw.dayCtx === 'object' ? sanitizeJson(raw.dayCtx, 2) : null, vignette: typeof raw.vignette === 'string' ? sanitizeText(raw.vignette, 120, '') || null : null,
      qualities, flags: sanitizeJson(raw.flags && typeof raw.flags === 'object' ? raw.flags : {}, 2) || {},
      seenStorylets: Array.isArray(raw.seenStorylets) ? raw.seenStorylets.filter((item) => typeof item === 'string').slice(0, 200).map((item) => item.slice(0, 60)) : [],
      codex: Array.isArray(raw.codex) ? raw.codex.filter((id) => findCard(id)) : [],
      rumours: Array.isArray(raw.rumours) ? raw.rumours.slice(-12).map((item) => ({ text: sanitizeText(item && item.text, 200, ''), dayIndex: Math.floor(clampNumber(item && item.dayIndex, 0, Config.LIMITS.MAX_DAYS, 0)) })).filter((item) => item.text) : [],
      regionStock, marketState: sanitizeJson(raw.marketState && typeof raw.marketState === 'object' ? raw.marketState : {}, 4) || {},
      pools: sanitizeJson(raw.pools && typeof raw.pools === 'object' ? raw.pools : {}, 5) || {},
      vignettesSeen: Array.isArray(raw.vignettesSeen) ? raw.vignettesSeen.filter((item) => typeof item === 'string').slice(-80).map((item) => item.slice(0, 60)) : [],
      graveLines: Array.isArray(raw.graveLines) ? sanitizeJson(raw.graveLines, 3).slice(0, 8) : [],
      stats: (() => { const stats = sanitizeJson(raw.stats && typeof raw.stats === 'object' ? raw.stats : {}, 3) || {}; ['travelDays', 'restDays', 'saraiNights', 'campNights', 'idleDays', 'provisionRations', 'rationsEaten', 'treatments', 'saraiEligibleNights'].forEach((key) => { stats[key] = clampNumber(stats[key], 0, 1e6, 0); }); stats.salesCities = Array.isArray(stats.salesCities) ? stats.salesCities.filter((item) => typeof item === 'string') : []; stats.servicesUsed = Array.isArray(stats.servicesUsed) ? stats.servicesUsed.filter((item) => typeof item === 'string') : []; return stats; })(),
      log: Array.isArray(raw.log) ? raw.log.slice(-Config.LIMITS.MAX_LOG_ENTRIES).map((entry) => ({ dayIndex: Math.floor(clampNumber(entry && entry.dayIndex, 0, Config.LIMITS.MAX_DAYS, 0)), text: sanitizeText(entry && entry.text, 200, '') })).filter((entry) => entry.text) : [],
      isPaused: true, outcome,
    };
  }

  function buildSaveText(state, randomState) {
    const stateText = JSON.stringify(state);
    return JSON.stringify({ app: 'karvanyan', schema: Config.SAVE_SCHEMA_VERSION, build: Config.GAME_VERSION, savedAt: new Date().toISOString(), checksum: hashText(stateText).toString(16), randomState, state });
  }

  /** @returns {{status:'none'|'ok'|'damaged'|'newer', wasRepaired?:boolean, state:Object|null, randomState:number}} */
  function parseSaveText(text) {
    const none = { status: 'none', state: null, randomState: 1 };
    if (text === null || text === undefined) return none;
    let envelope;
    try { envelope = JSON.parse(text); } catch { return { ...none, status: 'damaged' }; }
    if (!envelope || envelope.app !== 'karvanyan' || typeof envelope.schema !== 'number') return { ...none, status: 'damaged' };
    if (envelope.schema > Config.SAVE_SCHEMA_VERSION) return { ...none, status: 'newer' };
    if (envelope.schema < Config.SAVE_SCHEMA_VERSION) return { ...none, status: 'damaged' };
    const state = sanitizeLoadedState(envelope.state);
    if (!state) return { ...none, status: 'damaged' };
    const checksumMatches = hashText(JSON.stringify(envelope.state)).toString(16) === envelope.checksum;
    return { status: 'ok', wasRepaired: !checksumMatches, state, randomState: clampNumber(envelope.randomState, 0, 4294967295, 1) };
  }

  const saveGame = (state, randomState) => storage.writeText(Config.STORAGE_KEYS.SAVE, buildSaveText(state, randomState));
  const loadGame = () => parseSaveText(storage.readText(Config.STORAGE_KEYS.SAVE));
  const clearSavedGame = () => storage.removeKey(Config.STORAGE_KEYS.SAVE);
  const exportSaveText = () => storage.readText(Config.STORAGE_KEYS.SAVE);

  function importSaveText(text) {
    const result = parseSaveText(text);
    if (result.status === 'ok') saveGame(result.state, result.randomState);
    return result;
  }

  function loadGraves() {
    const raw = readJson(Config.STORAGE_KEYS.GRAVES, []);
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, Config.LIMITS.MAX_GRAVES).map((grave) => ({
      name: sanitizeText(grave && grave.name, Config.LIMITS.MAX_NAME_LENGTH, 'Unknown'), role: sanitizeText(grave && grave.role, 20, ''),
      epitaph: sanitizeText(grave && grave.epitaph, Config.LIMITS.MAX_EPITAPH_LENGTH, ''), cause: sanitizeText(grave && grave.cause, 20, 'general'),
      place: sanitizeText(grave && grave.place, 40, ''), dayIndex: Math.floor(clampNumber(grave && grave.dayIndex, 0, Config.LIMITS.MAX_DAYS, 0)),
    }));
  }

  /** Writes a grave line for every dead member, newest first. The epitaph goes on the leader's. */
  function addGraves(state, epitaph) {
    const dead = state.party.filter((member) => !member.isAlive);
    const fresh = dead.map((member, index) => ({
      name: member.name, role: member.role ? Config.ROLES[member.role].label : 'Leader',
      epitaph: index === 0 ? sanitizeText(epitaph, Config.LIMITS.MAX_EPITAPH_LENGTH, '') : '', cause: member.cause || 'general',
      place: (state.graveLines.find((line) => line.name === member.name) || {}).regionId || '', dayIndex: member.dayOfDeath || 0,
    }));
    storage.writeText(Config.STORAGE_KEYS.GRAVES, JSON.stringify([...fresh, ...loadGraves()].slice(0, Config.LIMITS.MAX_GRAVES)));
  }

  function loadTopScores() {
    const raw = readJson(Config.STORAGE_KEYS.TOP_SCORES, []);
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, Config.LIMITS.MAX_TOP_SCORES).map((entry) => ({
      name: sanitizeText(entry && entry.name, Config.LIMITS.MAX_NAME_LENGTH, 'Unknown'), score: Math.floor(clampNumber(entry && entry.score, 0, 1e7, 0)),
      archetype: sanitizeText(entry && entry.archetype, 40, ''), resultLabel: sanitizeText(entry && entry.resultLabel, 40, ''),
    }));
  }

  function recordTopScore(state) {
    if (!state.outcome) return;
    const entry = { name: state.leaderName, score: state.outcome.score, archetype: getArchetype(state).label, resultLabel: state.outcome.type === 'arrived' ? 'Reached Dhaka' : 'Died on the road' };
    const ranked = [...loadTopScores(), entry].sort((first, second) => second.score - first.score).slice(0, Config.LIMITS.MAX_TOP_SCORES);
    storage.writeText(Config.STORAGE_KEYS.TOP_SCORES, JSON.stringify(ranked));
  }

  function loadSettings() {
    const raw = readJson(Config.STORAGE_KEYS.SETTINGS, {});
    const source = raw && typeof raw === 'object' ? raw : {};
    const defaults = Config.DEFAULT_SETTINGS;
    return {
      textSizePercent: [100, 115, 130].includes(source.textSizePercent) ? source.textSizePercent : defaults.textSizePercent,
      theme: ['auto', 'light', 'dark'].includes(source.theme) ? source.theme : defaults.theme,
      reducedMotion: ['auto', 'on'].includes(source.reducedMotion) ? source.reducedMotion : defaults.reducedMotion,
      hasScanlines: source.hasScanlines === undefined ? defaults.hasScanlines : Boolean(source.hasScanlines),
      hasAssists: Boolean(source.hasAssists), saraiDefault: ['ask', 'always', 'never'].includes(source.saraiDefault) ? source.saraiDefault : defaults.saraiDefault,
      hasSeenIntro: Boolean(source.hasSeenIntro),
    };
  }
  const saveSettings = (settings) => storage.writeText(Config.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

  /** The last opening setup, for the second-run quick start. */
  function loadLastSetup() {
    const raw = readJson(Config.STORAGE_KEYS.LAST_SETUP, null);
    if (!raw || typeof raw !== 'object' || !findArchetype(raw.archetypeId)) return null;
    return {
      archetypeId: raw.archetypeId, leaderName: sanitizeText(raw.leaderName, Config.LIMITS.MAX_NAME_LENGTH, ''), cargoShare: clampNumber(raw.cargoShare, 0, 1, 0.55),
      candidateIds: Array.isArray(raw.candidateIds) ? raw.candidateIds.filter((id) => findCandidate(id)).slice(0, 3) : [],
      startMonthIndex: Config.CALENDAR.START_OPTIONS.some((option) => option.monthIndex === raw.startMonthIndex) ? raw.startMonthIndex : 9,
      subplotId: Content.SUBPLOTS[raw.subplotId] ? raw.subplotId : 'book',
      rationPacks: Math.floor(clampNumber(raw.rationPacks, 0, 60, 8)), feedPacks: Math.floor(clampNumber(raw.feedPacks, 0, 60, 8)),
    };
  }
  const saveLastSetup = (setup) => storage.writeText(Config.STORAGE_KEYS.LAST_SETUP, JSON.stringify(setup));

  namespace.State = Object.freeze({
    clampNumber, roundToTenth, sanitizeText, hashText, createRandomSource, createKeyedSource,
    findArchetype, findCandidate, findCard, getNode, getEdge, getRegionOfState, getArchetype,
    getDate, formatDate, getHijriLabel, computeIslamicYear, daysUntilMonthStart,
    getModifiers, getMod, getLivingIndices, getLivingCount, getLeader, getSickCount, getWeakCount, getActiveHires, getGuardCount,
    getCapacity, getLoad, getFreeCapacity, getLoadFactor, getAnimalCapacity, getRationsPerDay, getFeedsPerDay,
    makeNote, patchState, adjustResources, updateMember, updateAnimal, changeMemberHealth, changeAllHealth, makeMemberSick, cureMember,
    getCureChance, treatMember, changeAnimalHealth, loseAnimal, learnCard, addQuality, setFlag, getMemberHpCap,
    getBuyPrice, getLodgingFee, getSeasonFactor, getMarketRecord, getCargoBasePrice, getCargoPriceRange, quoteSale, sellCargoLot, sellSurplus, sellAnimal, ensurePool,
    createNewGame, computeScore, computeSubplotBonus, finishJourney, getAnimalBodyValue,
    isStorageSupported: () => storage.isPersistent,
    saveGame, loadGame, clearSavedGame, exportSaveText, importSaveText, parseSaveText, sanitizeLoadedState,
    loadGraves, addGraves, loadTopScores, recordTopScore, loadSettings, saveSettings, loadLastSetup, saveLastSetup,
  });
})(window.Karvanyan);
