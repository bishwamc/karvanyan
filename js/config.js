/**
 * config.js — static rules and tuning (GDD sections 3, 4, 6, 7, 8, 14).
 *
 * Every number the designer may want to tune lives in this file (the GDD calls it
 * balance.json). Values marked TUNE are placeholders measured by tools/simulate.mjs.
 * This file never touches the DOM, so Node can load it for tests and bots.
 *
 * Scripts share one namespace (window.Karvanyan) so the game opens by double-click.
 */
(function (namespace) {
  'use strict';

  const GAME_VERSION = '0.2.0';
  const SAVE_SCHEMA_VERSION = 2;

  const STORAGE_KEYS = Object.freeze({
    SAVE: 'karvanyan.save.v2', GRAVES: 'karvanyan.graves.v1', TOP_SCORES: 'karvanyan.top.v2',
    SETTINGS: 'karvanyan.settings.v2', LAST_SETUP: 'karvanyan.lastsetup.v1',
  });

  const LIMITS = Object.freeze({
    MAX_NAME_LENGTH: 16, MAX_EPITAPH_LENGTH: 60, MAX_GRAVES: 8, MAX_TOP_SCORES: 10,
    MAX_LOG_ENTRIES: 80, MAX_PARTY_SIZE: 4, MAX_ANIMALS: 24, MAX_AMOUNT: 99999, MAX_DAYS: 1200,
  });

  const CANVAS = Object.freeze({ LOGICAL_WIDTH: 320, LOGICAL_HEIGHT: 180 });

  const CALENDAR = Object.freeze({
    JOURNEY_YEAR: 1665,
    START_DAY_OF_MONTH: 15,
    MONTH_NAMES: Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']),
    START_OPTIONS: Object.freeze([
      { monthIndex: 8, label: '15 September', consequence: 'Early: warm lowlands and high rivers.' },
      { monthIndex: 9, label: '15 October', consequence: 'Balanced: rivers falling, cold coming.' },
      { monthIndex: 10, label: '15 November', consequence: 'Late: snow in the passes, safe rivers.' },
    ]),
  });

  const PACES = Object.freeze({
    steady: Object.freeze({ id: 'steady', label: 'Steady', kosPerDay: 6.5, speedFactor: 1, strain: 0, animalStrain: 0, help: 'About 6 kos a day in fair weather. No strain.' }),
    hard: Object.freeze({ id: 'hard', label: 'Hard', kosPerDay: 6, speedFactor: 1.3, strain: 2, animalStrain: 1, help: 'x1.3 speed. -2 health a day, animals tire.' }),
    forced: Object.freeze({ id: 'forced', label: 'Forced', kosPerDay: 6, speedFactor: 1.6, strain: 5, animalStrain: 3, help: 'x1.6 speed. -5 health a day, animals suffer.' }),
  });

  const RATIONS = Object.freeze({
    filling: Object.freeze({ id: 'filling', label: 'Filling', perPerson: 1, hpLoss: 0, help: '1 ration per person a day.' }),
    meagre: Object.freeze({ id: 'meagre', label: 'Meagre', perPerson: 0.75, hpLoss: 2, help: '0.75 ration, -2 health a day.' }),
    bare: Object.freeze({ id: 'bare', label: 'Bare bones', perPerson: 0.5, hpLoss: 5, help: '0.5 ration, -5 health a day. Guards desert.' }),
  });

  /** Weather states and their effects (GDD 6.3). */
  const WEATHER_STATES = Object.freeze(['clear', 'hot', 'extreme', 'cold', 'snow', 'rain', 'monsoon', 'fog', 'dust']);
  const WEATHER = Object.freeze({
    clear: { label: 'Clear', icon: '☀️', speed: 1, hp: 0, animalHp: 0, fodder: 1, sick: 1, wet: false, heavyRain: false, neighbours: ['hot', 'cold', 'fog'] },
    hot: { label: 'Hot', icon: '🌡️', speed: 0.95, hp: -2, animalHp: 0, fodder: 1.1, sick: 1.2, wet: false, heavyRain: false, neighbours: ['clear', 'extreme', 'rain'] },
    extreme: { label: 'Extreme heat', icon: '🔥', speed: 0.8, hp: -5, animalHp: -3, fodder: 1.2, sick: 2, wet: false, heavyRain: false, neighbours: ['hot', 'dust'] },
    cold: { label: 'Cold', icon: '🥶', speed: 1, hp: -2, animalHp: 0, fodder: 1.1, sick: 1, wet: false, heavyRain: false, neighbours: ['clear', 'snow', 'fog'] },
    snow: { label: 'Snow or cold snap', icon: '❄️', speed: 0.6, hp: -6, animalHp: -4, fodder: 1.2, sick: 1, wet: false, heavyRain: false, neighbours: ['cold', 'rain'] },
    rain: { label: 'Rain', icon: '🌧️', speed: 0.92, hp: -1, animalHp: 0, fodder: 1, sick: 1.2, wet: true, heavyRain: false, neighbours: ['clear', 'monsoon', 'fog'] },
    monsoon: { label: 'Heavy rain', icon: '⛈️', speed: 0.6, hp: -2, animalHp: -2, fodder: 1, sick: 1.5, wet: true, heavyRain: true, neighbours: ['rain', 'hot'] },
    fog: { label: 'Fog', icon: '🌫️', speed: 0.88, hp: 0, animalHp: 0, fodder: 1, sick: 1, wet: false, heavyRain: false, neighbours: ['clear', 'cold', 'rain'] },
    dust: { label: 'Dust or wind', icon: '🌬️', speed: 0.92, hp: -1, animalHp: 0, fodder: 1.05, sick: 1, wet: false, heavyRain: false, neighbours: ['clear', 'hot', 'extreme'] },
  });

  /** Health lost per day for each illness (GDD 7.4). */
  const ILLNESSES = Object.freeze({
    fever: { label: 'Fever', hp: 4, medicineCure: 1, restRecovery: 0.35 },
    dysentery: { label: 'Dysentery (pechish)', hp: 6, medicineCure: 0.7, restRecovery: 0.25 },
    heat: { label: 'Heat sickness', hp: 5, medicineCure: 0, restRecovery: 0.5 },
  });

  /** Load units (GDD 3.2). 1 LU is about 10 kg. */
  const UNITS = Object.freeze({ RATION_LU: 0.1, FEED_LU: 0.25, MEDICINE_LU: 0.1, COVER_LU: 2 });

  const ANIMALS = Object.freeze({
    donkey: { id: 'donkey', label: 'Donkey', capacity: 6, feed: 0.6, speed: 0.9, price: 60, coldDamage: 1, mud: 1, heat: 1 },
    ox: { id: 'ox', label: 'Ox', capacity: 10, feed: 1.2, speed: 0.8, price: 90, coldDamage: 1, mud: 0.7, heat: 1 },
    mule: { id: 'mule', label: 'Mule', capacity: 12, feed: 1, speed: 1, price: 150, coldDamage: 1, mud: 1, heat: 1 },
    camel: { id: 'camel', label: 'Camel', capacity: 20, feed: 0.7, speed: 1, price: 200, coldDamage: 2, mud: 2, heat: 0.6 },
    horse: { id: 'horse', label: 'Horse', capacity: 8, feed: 1.5, speed: 1.2, price: 400, coldDamage: 1, mud: 1, heat: 1 },
  });

  /** Signature cargoes (GDD 3.6, 6.7). `fragile` is condition lost per day of exposure. */
  const CARGO = Object.freeze({
    lambskin: { id: 'lambskin', label: 'Lambskin', basePrice: 45, lu: 1, seasonCold: 1.2, seasonHot: 0.8, fragile: { wet: 0.02, heat: 0.01, cold: 0 } },
    silk: { id: 'silk', label: 'Chinese silk', basePrice: 90, lu: 0.5, seasonCold: 1, seasonHot: 1, fragile: { wet: 0.03, heat: 0.005, cold: 0 } },
    carpets: { id: 'carpets', label: 'Fine carpets', basePrice: 80, lu: 2, seasonCold: 1.1, seasonHot: 0.9, fragile: { wet: 0.02, heat: 0, cold: 0 } },
    cloth: { id: 'cloth', label: 'Cloth and small jewellery', basePrice: 110, lu: 0.5, seasonCold: 1, seasonHot: 1, fragile: { wet: 0.02, heat: 0, cold: 0 } },
    fruit: { id: 'fruit', label: 'Dried fruit and nuts', basePrice: 30, lu: 1, seasonCold: 1.1, seasonHot: 0.9, fragile: { wet: 0.015, heat: 0.01, cold: 0 } },
  });
  const CARGO_DEMAND_INDEX = Object.freeze({ lambskin: 0, silk: 1, carpets: 2, cloth: 3, fruit: 4 });

  /**
   * Role effects (GDD 4.2). Modifier keys ending in `Mult` multiply together; keys ending in
   * `Bonus` add together. Candidate strengths and flaws use the same keys.
   */
  const ROLES = Object.freeze({
    interpreter: { id: 'interpreter', label: 'Interpreter', effects: { tollMult: 0.8, haggleBonus: 0.2, rumourBonus: 0.1 }, absent: 'Authority events run at base odds.' },
    healer: { id: 'healer', label: 'Healer', effects: { cureBonus: 0.15, restMult: 1.5, illnessSlowMult: 0.7 }, absent: 'Base cure and recovery.' },
    cook: { id: 'cook', label: 'Cook', effects: { rationMult: 0.9, kitchenMult: 0.5 }, absent: 'Base ration use and kitchen risk.' },
    handler: { id: 'handler', label: 'Animal handler', effects: { animalLossMult: 0.6, feedMult: 0.9, overloadMult: 0.5 }, absent: 'Base animal risk.' },
    accountant: { id: 'accountant', label: 'Accountant', effects: { buyMult: 0.92, haggleBonus: 0.1, hasAccountant: 1 }, absent: 'Surplus sells at a loss.' },
    hunter: { id: 'hunter', label: 'Hunter or gatherer', effects: { provisionMult: 1.5, wildlifeDefenceBonus: 0.1, targetSizeMult: 1.25 }, absent: 'Base provisioning yield.' },
  });

  /** Hired hands (GDD 4.4). `base` is rupees; tiers scale the price. */
  const SERVICES = Object.freeze({
    scout: { id: 'scout', label: 'Scout', base: 15, tiers: [
      { id: 'green', label: 'Green', priceMult: 0.7, accuracy: 0.8 },
      { id: 'steady', label: 'Steady', priceMult: 1, accuracy: 0.9 },
      { id: 'veteran', label: 'Veteran', priceMult: 1.6, accuracy: 0.97 }] },
    guard: { id: 'guard', label: 'Guard', base: 20, tiers: [
      { id: 'raw', label: 'Raw', priceMult: 0.7, strength: 1 },
      { id: 'seasoned', label: 'Seasoned', priceMult: 1, strength: 2 },
      { id: 'veteran', label: 'Veteran', priceMult: 1.6, strength: 3 }] },
    guide: { id: 'guide', label: 'Guide', base: 40, perDay: 5, tiers: [
      { id: 'local', label: 'Local', priceMult: 1, accuracy: 0.95 },
      { id: 'renowned', label: 'Renowned', priceMult: 1.8, accuracy: 0.99 }] },
  });

  const PRICES = Object.freeze({
    RATION_PACK_SIZE: 10, RATION_PACK_BASE: 10, FEED_PACK_SIZE: 10, FEED_PACK_BASE: 10,
    MEDICINE_BASE: 8, COVER_BASE: 12, LODGING_BASE: 3, LODGING_PER_ANIMAL: 0.3,
    ANIMAL_SALE_FACTOR: Object.freeze({ plain: 0.55, accountant: 0.85 }),
    SURPLUS_SALE_FACTOR: Object.freeze({ plain: 0.4, accountant: 0.7 }),
    ANIMAL_BODY_VALUE_FACTOR: 0.6,
    SURVIVOR_VALUE: 0,
  });

  const MARKET = Object.freeze({
    BAND: 0.2, SATURATION_PER_UNIT: 0.02, SATURATION_RECOVERY_PER_DAY: 0.004, WINDOW_DAYS: 14,
    DHAKA_SEASON_POWER: 2, LOT_FRACTIONS: Object.freeze([0.1, 0.25, 0.5, 1]),
  });

  const PROVISION = Object.freeze({
    DURATION_SECONDS: 20, ASSIST_TIME_FACTOR: 1.3, ASSIST_TARGET_FACTOR: 1.3, HIT_RADIUS_CSS_PIXELS: 40,
    NEAR_MISS_CSS_PIXELS: 70, MIN_TARGET_CSS_PIXELS: 48, HUNT_ATTEMPTS: 8, MAX_HITS: 6,
    SKIN_YIELD: Object.freeze({ hunt: 1, fish: 0.9, forage: 0.6 }),
    CITY_RATING_FACTOR: 0.25, MAX_SESSION_FRACTION_OF_DAY: 0.8, STOCK_COST_BASE: 0.12, STOCK_COST_PER_SCORE: 0.2,
    STOCK_REGROWTH_PER_DAY: 0.02, BOT_EXPECTED_SCORE: 0.55,
  });

  const TUNING = Object.freeze({
    DAY_DURATION_MILLISECONDS: 1400,
    GRAZE_SHARE: Object.freeze({ none: 0, scarce: 0.2, ok: 0.45, plentiful: 0.65 }),
    FEED_PRICE_MULT: Object.freeze({ none: 3, scarce: 2, ok: 1, plentiful: 0.6 }),
    SARAI_CHANCE: Object.freeze({ none: 0, sparse: 0.25, regular: 0.5, dense: 0.95 }),
    FOOD_SHORT_HP: 6, FEED_SHORT_HP: 6, FEED_SHORT_LAME_CHANCE: 0.1, FEED_SHORT_LAME_HP: 15,
    ANIMAL_REST_RECOVERY: 5, WEAK_HP: 40, WEAK_SPEED_PENALTY: 0.05, MIN_LOAD_FACTOR: 0.4, OVERLOAD_PENALTY: 0.6,
    REST_HP: Object.freeze({ city: 10, sarai: 8, camp: 6 }),
    CAMP_EXPOSURE_FACTOR: 1.6, SARAI_ATTACK_FACTOR: 0.5, CAMP_ATTACK_FACTOR: 2, SARAI_THEFT_FACTOR: 1.2,
    EVENT_BASE_CHANCE: 0.1, SCOUT_EVENT_REDUCTION: 0.3, STRANGER_CHANCE: 0.05, WATER_TROUBLE_CHANCE: 0.03, ANIMAL_TROUBLE_CHANCE: 0.03,
    CHECKPOINT_CHANCE_PER_THREAT: 0.008, LOST_DAY_CHANCE: 0.03, FOG_LOST_DAY_FACTOR: 1.5,
    ATTACK_BASE: 0.02, REPEL_BASE: 0.2, REPEL_PER_THREAT: 0.12, DEFENCE_RATE: 0.35,
    ATTACK_LOSS_PURSE: Object.freeze([0.1, 0.3]), ATTACK_LOSS_CARGO: Object.freeze([0.05, 0.15]),
    SICK_BASE_PER_PERSON: 0.006, SICK_BAD_WATER: 0.8, SICK_CROWD: 0.8, SICK_WET: 0.25,
    HEAT_SICK_CHANCE: 0.06, SARAI_KITCHEN_DYSENTERY: 0.03, KITCHEN_SECOND_NIGHT_SKIP: 0.5,
    GUARD_DESERT_DAYS: 2, GUIDE_SPEED_BONUS: 0.15, DEFAULT_FORECAST_ACCURACY: 0.75,
    COLD_FUEL_RATIONS: 1, EXHAUSTION_HP: 40,
    LEADER_SUCCESSION_SCORE_FACTOR: 0.9, SUBPLOT_BONUS_CAP: 150, CODEX_POINTS: 2, CODEX_CAP_FRACTION: 0.15,
    DEATH_SCORE_FRACTION: 0.12, SCORE_SCALE: 1000, SURVIVOR_BASE_WEIGHT: 0.6,
    MIN_PRICE_RUPEES: 1,
  });

  /**
   * Archetypes (GDD 4.3). Cargo, capital and animals are PROPOSED placeholders (VERIFY).
   * expert and weakness use the same modifier keys as roles.
   */
  const ARCHETYPES = Object.freeze([
    { id: 'persian', label: 'Persian merchant', difficultyLabel: 'Easiest', scoreMultiplier: 0.8, capital: 4600, cargoId: 'carpets', animals: { camel: 3, mule: 2 },
      expert: { saleBonus: 0.06 }, weakness: { lostDayMult: 1.3 }, expertText: 'Sharp bargainer: +6% on cargo sales.', weaknessText: 'Poor road sense without a scout or guide.',
      names: ['Hadi', 'Farhad', 'Jahandar', 'Shirin', 'Mahin'], homeText: 'Isfahan or Shiraz. Persian, some Turkic.', hasFarman: true },
    { id: 'armenian', label: 'Armenian merchant', difficultyLabel: 'Easy', scoreMultiplier: 0.95, capital: 3800, cargoId: 'cloth', animals: { camel: 2, mule: 2, horse: 1 },
      expert: { tollMult: 0.85, rumourBonus: 0.1 }, weakness: { theftMult: 1.2 }, expertText: 'Networked: tolls x0.85, better rumours.', weaknessText: 'A rich target: theft x1.2.',
      names: ['Sarhad', 'Nazar', 'Hovhannes', 'Mariam', 'Anahit'], homeText: 'New Julfa. Armenian, Persian, some Hindustani.', hasFarman: false },
    { id: 'pashtun', label: 'Pashtun trader', difficultyLabel: 'Hard', scoreMultiplier: 1.1, capital: 4800, cargoId: 'fruit', animals: { camel: 1, mule: 2, donkey: 3 },
      expert: { lostDayMult: 0.5, pashtunTollMult: 0.5 }, weakness: { outsideHaggleBonus: -0.1 }, expertText: 'Road-wise: rarely loses the way. Lower tolls in Pashtun lands (a game simplification).', weaknessText: 'Weaker haggling with officials far from home.',
      names: ['Gul Mohammad', 'Sher Dil', 'Ahmad Gul', 'Zarghuna', 'Hajira'], homeText: 'Hills near Peshawar or Kabul. Pashto, Persian.', hasFarman: false },
    { id: 'uzbek', label: 'Uzbek trader', difficultyLabel: 'Hard', scoreMultiplier: 1.18, capital: 3500, cargoId: 'lambskin', animals: { camel: 3, mule: 1 },
      expert: { animalLossMult: 0.7, feedMult: 0.9 }, weakness: { dysenteryMult: 1.3 }, expertText: 'Animal-wise: fewer animal losses, less feed.', weaknessText: 'Unfamiliar water: dysentery x1.3.',
      names: ['Qurban', 'Murad', 'Rustam', 'Gulnar', 'Zebo'], homeText: 'Bukhara. Uzbek, Persian.', hasFarman: false },
    { id: 'yarkandi', label: 'Yarkandi trader', difficultyLabel: 'Hardest', scoreMultiplier: 1.27, capital: 3300, cargoId: 'silk', animals: { camel: 2, mule: 2 },
      expert: { coldMult: 0.6 }, weakness: { lowlandHeatMult: 1.3 }, expertText: 'Cold-hardy: cold damage x0.6.', weaknessText: 'Humid lowland heat: health loss x1.3.',
      names: ['Tursun', 'Abdurahman', 'Mamat', 'Nurbibi', 'Gulsum'], homeText: 'Yarkand or Kashgar. Turkic, some Persian.', hasFarman: false },
  ]);

  /** Presets for the cargo-versus-purse slider (share of capital put into cargo). */
  const CARGO_PRESETS = Object.freeze([
    { id: 'cautious', label: 'Cautious', share: 0.35 },
    { id: 'balanced', label: 'Balanced', share: 0.55 },
    { id: 'greedy', label: 'Greedy', share: 0.75 },
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    textSizePercent: 100, theme: 'auto', reducedMotion: 'auto', hasScanlines: true,
    hasAssists: false, saraiDefault: 'ask', hasSeenIntro: false,
  });

  namespace.Config = Object.freeze({
    GAME_VERSION, SAVE_SCHEMA_VERSION, STORAGE_KEYS, LIMITS, CANVAS, CALENDAR, PACES, RATIONS,
    WEATHER_STATES, WEATHER, ILLNESSES, UNITS, ANIMALS, CARGO, CARGO_DEMAND_INDEX, ROLES, SERVICES,
    PRICES, MARKET, PROVISION, TUNING, ARCHETYPES, CARGO_PRESETS, DEFAULT_SETTINGS,
  });
})((window.Karvanyan = window.Karvanyan || {}));
