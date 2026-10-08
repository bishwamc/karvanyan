/**
 * world.js — the map: 31 stops, 30 legs, 12 regions, markets, rivers and climate (GDD section 5, 6).
 *
 * Distances are modern road distances converted at 3.6 km per kos (VERIFY, low confidence).
 * Region attributes, market demand and river calendars are PROPOSED placeholders (VERIFY).
 * Adding a stop is a data edit here; the engine reads everything from these tables.
 */
(function (namespace) {
  'use strict';

  const Config = namespace.Config;

  // ---------------------------------------------------------------------------
  // Regions (GDD 5.2). threat: bandit, wildlife, exposure, authority, theft, disease, flood (0-5)
  // ---------------------------------------------------------------------------
  const REGIONS = Object.freeze({
    r1: { id: 'r1', name: 'Kabul uplands', climate: 'highland', sarai: 'sparse', fodder: 'scarce', hunt: 1, fish: 0, forage: 1, rationMult: 1.28, threat: { bandit: 1, wildlife: 1, exposure: 4, authority: 1, theft: 0, disease: 0, flood: 0 }, signature: 'The first cold snap tests your packing.' },
    r2: { id: 'r2', name: 'Jalalabad basin', climate: 'frontier', sarai: 'regular', fodder: 'ok', hunt: 1, fish: 1, forage: 3, rationMult: 0.64, threat: { bandit: 1, wildlife: 0, exposure: 0, authority: 1, theft: 1, disease: 1, flood: 0 }, signature: 'Orchards and relief.' },
    r3: { id: 'r3', name: 'Khyber', climate: 'frontier', sarai: 'none', fodder: 'none', hunt: 1, fish: 0, forage: 1, rationMult: 2.0, threat: { bandit: 4, wildlife: 1, exposure: 2, authority: 4, theft: 0, disease: 0, flood: 0 }, signature: 'A toll to negotiate.' },
    r4: { id: 'r4', name: 'Peshawar plain', climate: 'frontier', sarai: 'dense', fodder: 'plentiful', hunt: 0, fish: 2, forage: 2, rationMult: 0.64, threat: { bandit: 2, wildlife: 0, exposure: 0, authority: 2, theft: 3, disease: 3, flood: 0 }, signature: 'Crowded sarais.' },
    r5: { id: 'r5', name: 'Indus and Potohar', climate: 'plateau', sarai: 'sparse', fodder: 'scarce', hunt: 2, fish: 3, forage: 1, rationMult: 1.12, threat: { bandit: 3, wildlife: 2, exposure: 1, authority: 2, theft: 1, disease: 0, flood: 3 }, signature: 'The Indus crossing.' },
    r6: { id: 'r6', name: 'Punjab', climate: 'plainsN', sarai: 'dense', fodder: 'plentiful', hunt: 1, fish: 2, forage: 3, rationMult: 0.48, threat: { bandit: 1, wildlife: 0, exposure: 0, authority: 2, theft: 3, disease: 1, flood: 2 }, signature: 'Five-river ferries.' },
    r7: { id: 'r7', name: 'Sirhind to Delhi', climate: 'plainsN', sarai: 'dense', fodder: 'plentiful', hunt: 0, fish: 1, forage: 3, rationMult: 0.48, threat: { bandit: 1, wildlife: 0, exposure: 0, authority: 3, theft: 2, disease: 1, flood: 0 }, signature: 'The imperial plain.' },
    r8: { id: 'r8', name: 'Braj and Doab', climate: 'doab', sarai: 'dense', fodder: 'ok', hunt: 1, fish: 1, forage: 2, rationMult: 0.64, threat: { bandit: 3, wildlife: 0, exposure: 0, authority: 1, theft: 1, disease: 1, flood: 1 }, signature: 'Jumna ferries.' },
    r9: { id: 'r9', name: 'Prayag to Kashi', climate: 'doab', sarai: 'dense', fodder: 'plentiful', hunt: 0, fish: 3, forage: 2, rationMult: 0.56, threat: { bandit: 1, wildlife: 0, exposure: 0, authority: 1, theft: 2, disease: 3, flood: 3 }, signature: 'Confluence and crowds.' },
    r10: { id: 'r10', name: 'Bihar plain', climate: 'plainsE', sarai: 'regular', fodder: 'plentiful', hunt: 1, fish: 3, forage: 3, rationMult: 0.56, threat: { bandit: 3, wildlife: 0, exposure: 0, authority: 1, theft: 1, disease: 2, flood: 4 }, signature: 'The Ganga floodplain.' },
    r11: { id: 'r11', name: 'Rajmahal and west Bengal', climate: 'delta', sarai: 'regular', fodder: 'ok', hunt: 2, fish: 3, forage: 3, rationMult: 0.72, threat: { bandit: 1, wildlife: 3, exposure: 0, authority: 1, theft: 1, disease: 4, flood: 2 }, signature: 'Hills and fever.' },
    r12: { id: 'r12', name: 'Delta approach', climate: 'delta', sarai: 'sparse', fodder: 'scarce', hunt: 1, fish: 3, forage: 3, rationMult: 1.28, threat: { bandit: 0, wildlife: 2, exposure: 0, authority: 1, theft: 1, disease: 3, flood: 4 }, signature: 'The Padma crossing.' },
  });

  // ---------------------------------------------------------------------------
  // Stops (GDD 5.1). demand = [lambskin, silk, carpets, cloth, fruit] (PROPOSED, VERIFY)
  // ---------------------------------------------------------------------------
  function stop(id, name, region, tier, hasAnimalMarket, animalSet, demand, notes, recruits) {
    return Object.freeze({ id, name, region, tier, hasAnimalMarket, animalSet, demand: Object.freeze(demand), notes, recruits: recruits || { guard: [0, 3], scout: [0, 3] } });
  }

  const NODES = Object.freeze([
    stop('kabul', 'Kabul', 'r1', 'large', true, 'north', [0.9, 0.8, 0.8, 0.9, 0.7], 'Start. The patron\'s farewell.'),
    stop('jalalabad', 'Jalalabad', 'r2', 'medium', false, null, [0.85, 0.85, 0.8, 0.9, 0.8], 'Orchards and a busy sarai kitchen.'),
    stop('khyber', 'Khyber Pass', 'r3', 'none', false, null, [0, 0, 0, 0, 0], 'A post in the pass. No market.', { guard: [0, 2], scout: [0, 1] }),
    stop('peshawar', 'Peshawar', 'r4', 'large', true, 'north', [1, 1, 0.95, 1.05, 1], 'A crowded city of sarais and bazaars.'),
    stop('attock', 'Attock', 'r5', 'medium', false, null, [1, 1, 1, 1, 1.1], 'The fort above the Indus.'),
    stop('hasan_abdal', 'Hasan Abdal', 'r5', 'small', false, null, [0.95, 1, 1, 1, 1.1], 'A waypoint town (replaces Rawalpindi; VERIFY).'),
    stop('rohtas', 'Rohtas', 'r5', 'small', false, null, [1, 1, 1.05, 1, 1.1], 'A great fort.'),
    stop('jhelum', 'Jhelum', 'r5', 'medium', false, null, [1.05, 1.05, 1.05, 1.1, 1.15], 'A river town.'),
    stop('gujrat', 'Gujrat', 'r6', 'medium', false, null, [1.05, 1.1, 1.1, 1.1, 1.2], 'A market town near the Chenab.'),
    stop('lahore', 'Lahore', 'r6', 'great', true, 'north', [1.2, 1.35, 1.3, 1.35, 1.3], 'A great city. Winter option.'),
    stop('amritsar', 'Amritsar', 'r6', 'medium', false, null, [1.15, 1.2, 1.2, 1.25, 1.25], 'A route variant (VERIFY).'),
    stop('jalandhar', 'Jalandhar', 'r6', 'medium', false, null, [1.15, 1.15, 1.15, 1.2, 1.25], 'Between the Beas and the Sutlej.'),
    stop('ludhiana', 'Ludhiana', 'r6', 'medium', false, null, [1.15, 1.15, 1.15, 1.2, 1.25], 'On the Sutlej.'),
    stop('sirhind', 'Sirhind', 'r7', 'medium', false, null, [1.15, 1.2, 1.2, 1.2, 1.3], 'Added to the spine (VERIFY).'),
    stop('ambala', 'Ambala', 'r7', 'medium', false, null, [1.1, 1.2, 1.2, 1.2, 1.3], 'A waystation town.'),
    stop('karnal', 'Karnal', 'r7', 'small', false, null, [1.1, 1.1, 1.1, 1.15, 1.25], 'A small market.'),
    stop('panipat', 'Panipat', 'r7', 'medium', false, null, [1.15, 1.25, 1.25, 1.3, 1.3], 'A town of old battles.'),
    stop('delhi', 'Delhi', 'r7', 'great', true, 'north', [1.3, 1.5, 1.45, 1.5, 1.4], 'The imperial city. Checkpoint; winter option.'),
    stop('mathura', 'Mathura', 'r8', 'medium', false, null, [1.1, 1.2, 1.2, 1.25, 1.3], 'A town on the Jumna.'),
    stop('agra', 'Agra', 'r8', 'great', true, 'north', [1.2, 1.45, 1.4, 1.5, 1.4], 'A great city on the Jumna.'),
    stop('etawah', 'Etawah', 'r8', 'medium', false, null, [1.05, 1.15, 1.1, 1.2, 1.3], 'A long leg ahead (Kanpur ferry on the way).'),
    stop('fatehpur', 'Fatehpur', 'r8', 'medium', false, null, [1.05, 1.15, 1.1, 1.2, 1.3], 'Replaces Kanpur as a stop (VERIFY).'),
    stop('allahabad', 'Allahabad', 'r9', 'large', true, 'east', [1.1, 1.35, 1.3, 1.4, 1.4], 'The confluence of two rivers.'),
    stop('varanasi', 'Varanasi', 'r9', 'large', true, 'east', [1.1, 1.4, 1.35, 1.45, 1.4], 'Pilgrim crowds.'),
    stop('sasaram', 'Sasaram', 'r9', 'small', false, null, [1, 1.2, 1.1, 1.25, 1.3], 'A small town; the Son is ahead.'),
    stop('patna', 'Patna', 'r10', 'great', true, 'east', [1.1, 1.45, 1.35, 1.5, 1.45], 'A Ganga port city.'),
    stop('munger', 'Munger', 'r10', 'medium', false, null, [1, 1.3, 1.2, 1.35, 1.4], 'A river fort town.'),
    stop('bhagalpur', 'Bhagalpur', 'r10', 'medium', false, null, [1, 1.3, 1.2, 1.35, 1.4], 'A river town.'),
    stop('rajmahal', 'Rajmahal', 'r11', 'medium', false, null, [0.95, 1.3, 1.2, 1.35, 1.4], 'A former provincial capital (VERIFY).'),
    stop('makhsusabad', 'Makhsusabad', 'r11', 'large', true, 'east', [0.95, 1.4, 1.3, 1.45, 1.5], 'Later called Murshidabad (VERIFY).'),
    stop('dhaka', 'Dhaka', 'r12', 'great', true, 'east', [0.9, 1.5, 1.4, 1.5, 1.5], 'Provincial capital. The final market.'),
  ]);

  // ---------------------------------------------------------------------------
  // Legs. Waypoints (Rawalpindi, Kanpur) are events on a leg, not stops.
  // ---------------------------------------------------------------------------
  function leg(fromId, toId, kos, terrain, crossings, extra) {
    return Object.freeze({
      id: `${fromId}-${toId}`, from: fromId, to: toId, kos, terrain: terrain || ['plain'],
      crossings: crossings || [], waypoints: [], ...extra,
    });
  }

  const EDGES_RAW = [
    leg('kabul', 'jalalabad', 42, ['pass', 'hill']),
    leg('jalalabad', 'khyber', 20, ['plain']),
    leg('khyber', 'peshawar', 16, ['pass']),
    leg('peshawar', 'attock', 28, ['plain']),
    leg('attock', 'hasan_abdal', 11, ['plain'], [{ river: 'indus', atKos: 1 }], { sarai: 'regular' }),
    leg('hasan_abdal', 'rohtas', 40, ['hill'], [], { sarai: 'regular', waypoints: [{ name: 'Rawalpindi', atKos: 20 }] }),
    leg('rohtas', 'jhelum', 6, ['hill'], [], { sarai: 'regular' }),
    leg('jhelum', 'gujrat', 18, ['plain'], [{ river: 'jhelum', atKos: 1 }], { sarai: 'regular' }),
    leg('gujrat', 'lahore', 36, ['plain'], [{ river: 'chenab', atKos: 2 }]),
    leg('lahore', 'amritsar', 14, ['plain'], [{ river: 'ravi', atKos: 3 }]),
    leg('amritsar', 'jalandhar', 22, ['plain'], [{ river: 'beas', atKos: 18 }]),
    leg('jalandhar', 'ludhiana', 15, ['plain'], [{ river: 'sutlej', atKos: 12 }]),
    leg('ludhiana', 'sirhind', 14, ['plain']),
    leg('sirhind', 'ambala', 22, ['plain']),
    leg('ambala', 'karnal', 25, ['plain']),
    leg('karnal', 'panipat', 8, ['plain']),
    leg('panipat', 'delhi', 25, ['plain']),
    leg('delhi', 'mathura', 42, ['plain']),
    leg('mathura', 'agra', 15, ['plain'], [{ river: 'jumna', atKos: 2 }]),
    leg('agra', 'etawah', 36, ['plain']),
    leg('etawah', 'fatehpur', 61, ['plain'], [{ river: 'ganga', atKos: 45, name: 'the Ganga at the Kanpur ferry' }], { waypoints: [{ name: 'Kanpur', atKos: 45 }] }),
    leg('fatehpur', 'allahabad', 33, ['plain'], [{ river: 'jumna', atKos: 30 }]),
    leg('allahabad', 'varanasi', 33, ['plain'], [{ river: 'ganga', atKos: 3 }]),
    leg('varanasi', 'sasaram', 28, ['plain']),
    leg('sasaram', 'patna', 42, ['plain'], [{ river: 'son', atKos: 4 }]),
    leg('patna', 'munger', 42, ['plain'], [{ river: 'ganga', atKos: 2 }]),
    leg('munger', 'bhagalpur', 17, ['plain']),
    leg('bhagalpur', 'rajmahal', 44, ['plain']),
    leg('rajmahal', 'makhsusabad', 28, ['hill']),
    leg('makhsusabad', 'dhaka', 92, ['delta'], [{ river: 'padma', atKos: 60 }, { river: 'delta', atKos: 80, name: 'the delta channels' }], { region: 'r12' }),
  ];

  const EDGES = Object.freeze(EDGES_RAW.map((edge) => {
    const origin = NODES.find((node) => node.id === edge.from);
    return Object.freeze({ ...edge, region: edge.region || origin.region });
  }));

  const FIRST_NODE_ID = 'kabul';
  const FINAL_NODE_ID = 'dhaka';
  const TOTAL_KOS = EDGES.reduce((sum, edge) => sum + edge.kos, 0);

  // ---------------------------------------------------------------------------
  // Rivers. regime picks the calendar: snow-fed rivers are high Jun-Sep, plains rivers Jul-Oct.
  // levels by month index: 0 low, 1 normal, 2 high
  // ---------------------------------------------------------------------------
  const RIVER_REGIMES = Object.freeze({
    snow: [0, 0, 0, 1, 1, 2, 2, 2, 2, 0, 0, 0],
    monsoon: [0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 0],
  });

  const RIVERS = Object.freeze({
    indus: { id: 'indus', name: 'the Indus', regime: 'snow', ferryPrice: 30 },
    jhelum: { id: 'jhelum', name: 'the Jhelum', regime: 'snow', ferryPrice: 18 },
    chenab: { id: 'chenab', name: 'the Chenab', regime: 'snow', ferryPrice: 18 },
    ravi: { id: 'ravi', name: 'the Ravi', regime: 'snow', ferryPrice: 15 },
    beas: { id: 'beas', name: 'the Beas', regime: 'snow', ferryPrice: 15 },
    sutlej: { id: 'sutlej', name: 'the Sutlej', regime: 'snow', ferryPrice: 18 },
    jumna: { id: 'jumna', name: 'the Jumna', regime: 'monsoon', ferryPrice: 18 },
    ganga: { id: 'ganga', name: 'the Ganga', regime: 'monsoon', ferryPrice: 25 },
    son: { id: 'son', name: 'the Son', regime: 'monsoon', ferryPrice: 15 },
    padma: { id: 'padma', name: 'the Padma', regime: 'monsoon', ferryPrice: 40 },
    delta: { id: 'delta', name: 'the delta channels', regime: 'monsoon', ferryPrice: 25 },
  });

  // ---------------------------------------------------------------------------
  // Climate: weights over Config.WEATHER_STATES per profile and month band (GDD 6.2, VERIFY)
  // ---------------------------------------------------------------------------
  /** Band 0 Sep-Oct, 1 Nov, 2 Dec-Feb, 3 Mar-Apr, 4 May to 14 Jun, 5 mid-Jun to Aug. */
  const CLIMATE_SOURCE = {
    highland: ['clear 8 cold 1 rain 1', 'clear 5 cold 3 snow 2', 'cold 4 snow 4 clear 2', 'rain 4 clear 4 cold 2', 'clear 7 hot 2 rain 1', 'clear 6 hot 3 rain 1'],
    frontier: ['clear 6 hot 3 dust 1', 'clear 6 cold 3 rain 1', 'cold 4 rain 3 clear 3', 'clear 5 rain 3 hot 2', 'hot 6 extreme 2 dust 2', 'hot 5 extreme 3 dust 1 rain 1'],
    plateau: ['clear 6 hot 3 rain 1', 'clear 5 cold 4 fog 1', 'cold 4 rain 3 clear 2 fog 1', 'clear 6 rain 2 hot 2', 'hot 4 extreme 4 dust 2', 'rain 3 monsoon 2 hot 4 clear 1'],
    plainsN: ['clear 6 hot 3 rain 1', 'clear 4 fog 3 cold 3', 'fog 5 cold 4 clear 1', 'clear 6 hot 3 dust 1', 'extreme 4 hot 3 dust 3', 'monsoon 4 rain 3 hot 3'],
    doab: ['clear 5 hot 3 rain 2', 'clear 4 fog 3 cold 3', 'fog 4 cold 4 clear 2', 'hot 5 clear 3 dust 2', 'extreme 5 hot 3 dust 2', 'monsoon 5 rain 3 hot 2'],
    plainsE: ['rain 4 hot 3 clear 3', 'clear 6 hot 2 fog 2', 'fog 4 clear 4 cold 2', 'hot 5 rain 3 clear 2', 'hot 4 rain 3 extreme 3', 'monsoon 6 rain 3 hot 1'],
    delta: ['rain 5 monsoon 2 hot 3', 'clear 5 rain 3 hot 2', 'clear 6 fog 2 cold 1 hot 1', 'hot 5 rain 3 clear 2', 'rain 4 hot 4 monsoon 2', 'monsoon 6 rain 3 hot 1'],
  };

  /** @returns {number[]} weights in Config.WEATHER_STATES order */
  function parseWeights(text) {
    const weights = Config.WEATHER_STATES.map(() => 0);
    const words = text.split(' ');
    for (let index = 0; index < words.length; index += 2) weights[Config.WEATHER_STATES.indexOf(words[index])] = Number(words[index + 1]);
    return weights;
  }

  const CLIMATE = Object.freeze(Object.fromEntries(Object.entries(CLIMATE_SOURCE).map(([profile, bands]) => [profile, Object.freeze(bands.map(parseWeights))])));
  const WEATHER_PERSISTENCE = 0.55;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function findNode(nodeId) { return NODES.find((node) => node.id === nodeId) || null; }
  function findEdge(edgeId) { return EDGES.find((edge) => edge.id === edgeId) || null; }
  function getRegion(regionId) { return REGIONS[regionId] || null; }
  /** Edge leaving a node. The graph allows several in future; this version has one. */
  function getOutgoingEdges(nodeId) { return EDGES.filter((edge) => edge.from === nodeId); }
  function getNodeIndex(nodeId) { return NODES.findIndex((node) => node.id === nodeId); }

  /** @param {Date} date @returns {number} 0..5 */
  function getMonthBand(date) {
    const month = date.getUTCMonth();
    if (month === 8 || month === 9) return 0;
    if (month === 10) return 1;
    if (month === 11 || month === 0 || month === 1) return 2;
    if (month === 2 || month === 3) return 3;
    if (month === 4 || (month === 5 && date.getUTCDate() < 15)) return 4;
    return 5;
  }

  /** @returns {0|1|2} river regime level for a month (0 low, 1 normal, 2 high) */
  function getBaseRiverLevel(riverId, monthIndex) {
    return RIVER_REGIMES[RIVERS[riverId].regime][monthIndex];
  }

  /** Climate profile for a region id. */
  function getClimateWeights(regionId, band) {
    return CLIMATE[REGIONS[regionId].climate][band];
  }

  namespace.World = Object.freeze({
    REGIONS, NODES, EDGES, RIVERS, CLIMATE, WEATHER_PERSISTENCE, FIRST_NODE_ID, FINAL_NODE_ID, TOTAL_KOS,
    findNode, findEdge, getRegion, getOutgoingEdges, getNodeIndex, getMonthBand, getBaseRiverLevel, getClimateWeights,
  });
})(window.Karvanyan);
