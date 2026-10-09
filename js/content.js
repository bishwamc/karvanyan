/**
 * content.js — writing and story data (GDD sections 9, 10, 11, 15).
 *
 * All characters are fictional. Reasons for going east are fiction, not history.
 * Cultural details are listed in docs/facts.md for the history reviewer.
 * Writing rules: 25 words per speech, 45 per paragraph, hedge uncertain history.
 *
 * Storylet fields: id, kind, icon, title, region/node, once, weight, salience, requires[],
 * text[], choices[{id,label,tone,requires[],effects[],result}]. Effects and requires are
 * interpreted by events.js. Hook names refer to custom code for the three matrix set pieces.
 */
(function (namespace) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Recruits (GDD 11.4). strength and flaw use the modifier keys of Config.ROLES.
  // ---------------------------------------------------------------------------
  const CANDIDATES = Object.freeze([
    { id: 'naseer', role: 'interpreter', name: 'Naseer', strength: { localStorylets: 1 }, flaw: { haggleBonus: -0.1 }, strengthText: 'Four languages; opens local storylets.', flawText: 'Nervous with officials: haggle bonus halved.', line: 'Naseer speaks four tongues and fears one thing: men in good coats.' },
    { id: 'mariam', role: 'interpreter', name: 'Mariam', strength: { tollMult: 0.9375 }, flaw: { theftMult: 1.1 }, strengthText: 'Tolls cost x0.75.', flawText: 'Draws attention: theft x1.1.', line: 'Mariam opens doors. Sometimes more doors than you wanted open.' },
    { id: 'tursun', role: 'interpreter', name: 'Tursun', strength: { northStorylets: 1 }, flaw: { eastHaggleLoss: 0.1 }, strengthText: 'Knows Central Asian caravan stories.', flawText: 'Poor Hindustani: haggle bonus halves east of Delhi.', line: 'Tursun knows the north road. Past Delhi he will be a guest like you.' },
    { id: 'hakim_jafar', role: 'healer', name: 'Hakim Jafar', strength: { cureBonus: 0.05 }, flaw: { appetite: 1 }, strengthText: 'Cure chance +20 points.', flawText: 'Appetite: eats 1.3 rations.', line: 'Hakim Jafar cures fevers and empties larders.' },
    { id: 'dai_sakina', role: 'healer', name: 'Dai Sakina', strength: { restMult: 1.1333 }, flaw: { frail: 1 }, strengthText: 'Rest recovery x1.7.', flawText: 'Frail: health capped at 80.', line: 'Sakina\'s hands mend the weak. The road may wear her down first.' },
    { id: 'vaidya_mohan', role: 'healer', name: 'Vaidya Mohan', strength: { thriftyTreatment: 1 }, flaw: { slow: 1 }, strengthText: 'Every second treatment uses no medicine.', flawText: 'Slow: speed -3%.', line: 'Mohan stretches medicine like a miser stretches coin, and walks like a monk.' },
    { id: 'bibi_gulnar', role: 'cook', name: 'Bibi Gulnar', strength: { rationMult: 0.9444 }, flaw: { heavyPots: 1 }, strengthText: 'Ration use x0.85.', flawText: 'Heavy pots: +1 LU load.', line: 'Gulnar feeds five on four portions and carries a kitchen.' },
    { id: 'karim', role: 'cook', name: 'Karim', strength: { kitchenMult: 0.6 }, flaw: { slow: 1 }, strengthText: 'Kitchen sickness x0.3.', flawText: 'Slow: speed -3%.', line: 'Karim has never poisoned a guest. He has also never hurried.' },
    { id: 'hira', role: 'cook', name: 'Hira', strength: { provisionFoodMult: 1.3 }, flaw: { frail: 1 }, strengthText: 'Provisioning food +30%.', flawText: 'Frail: health capped at 80.', line: 'Hira finds supper where others see scrub.' },
    { id: 'sher_dil', role: 'handler', name: 'Sher Dil', strength: { animalLossMult: 0.8333 }, flaw: { appetite: 1 }, strengthText: 'Animal loss x0.5.', flawText: 'Appetite: eats 1.3 rations.', line: 'Sher Dil nurses animals first and eats like three men.' },
    { id: 'nurbibi', role: 'handler', name: 'Nurbibi', strength: { camelCapMult: 1.1 }, flaw: { horseFeedMult: 1.1 }, strengthText: 'Camels carry +10%.', flawText: 'Horses need 10% more feed.', line: 'Nurbibi speaks to camels. Horses she does not trust.' },
    { id: 'bahram', role: 'handler', name: 'Bahram', strength: { smallCapMult: 1.15 }, flaw: { camelLossMult: 1.2 }, strengthText: 'Mule, ox and donkey loads +15%.', flawText: 'Camel loss x1.2.', line: 'Bahram makes mules carry more than they think they can.' },
    { id: 'munshi_kishan', role: 'accountant', name: 'Munshi Kishan', strength: { buyMult: 0.9783 }, flaw: { bribeLocked: 1 }, strengthText: 'Buy prices x0.9.', flawText: 'Refuses bribes: bribe options locked.', line: 'Kishan counts honestly. Never ask him to count crookedly.' },
    { id: 'khwaja_sarhad', role: 'accountant', name: 'Khwaja Sarhad', strength: { saleBonus: 0.03 }, flaw: { theftMult: 1.2 }, strengthText: 'Cargo sales +3%.', flawText: 'Draws attention: theft x1.2.', line: 'Sarhad gets good prices and a good deal of attention.' },
    { id: 'bibi_roshan', role: 'accountant', name: 'Bibi Roshan', strength: { buyMult: 0.9783 }, flaw: { slow: 1 }, strengthText: 'Buy prices x0.9.', flawText: 'Slow: speed -3%.', line: 'Roshan saves coin at every bazaar and loses a morning at each.' },
    { id: 'gul_zaman', role: 'hunter', name: 'Gul Zaman', strength: { huntMult: 1 }, flaw: { appetite: 1 }, strengthText: 'Hunting yield x1.5.', flawText: 'Appetite: eats 1.3 rations.', line: 'Gul Zaman brings meat, and eats half before camp.' },
    { id: 'amina', role: 'hunter', name: 'Amina', strength: { forageMult: 1.44 }, flaw: { frail: 1 }, strengthText: 'Forage yield x1.8.', flawText: 'Frail: health capped at 80.', line: 'Amina reads roots and leaves like a ledger.' },
    { id: 'dilawar', role: 'hunter', name: 'Dilawar', strength: { fishMult: 1.44 }, flaw: { coldMult: 1.3 }, strengthText: 'Fish yield x1.8.', flawText: 'Feels the cold: exposure x1.3.', line: 'Dilawar can find fish in a puddle and catches colds in a breeze.' },
  ]);

  /** Curated first-run offers (GDD 11.4); each offer is three candidate ids from three roles. */
  const FIRST_RUN_OFFERS = Object.freeze([
    ['naseer', 'hakim_jafar', 'bibi_gulnar'],
    ['sher_dil', 'munshi_kishan', 'gul_zaman'],
  ]);

  // ---------------------------------------------------------------------------
  // Opening (GDD 9.2, 11.2, 11.3). Every speech is 25 words or fewer.
  // ---------------------------------------------------------------------------
  const DAULAT_BEG = Object.freeze({
    beats: [
      'Sit. I knew your relative thirty years ago. The road east eats the careless, so we will prepare you properly.',
      'Goods earn money. Coins keep you alive. Choose your share. You cannot buy more of this cargo once you leave.',
      'Three will walk with you. I cannot send replacements, so choose as if each one might not return.',
      'Animals carry everything. Each has a load limit and eats every day. Buy more here, where the market is large.',
      'Count your days. The bar below shows how long your food and fodder will last. If it is short, you will starve.',
      'When you leave decides what you meet. Late departure means winter in the passes. Early means river water.',
      'Walk fast and you arrive tired. Eat little and you arrive weak. Set both, then watch the road.',
      'A scout knows the next stretch. He goes only as far as the next city. I will pay for the first.',
      'Everyone has a private reason. Tell me yours, and I will tell no one.',
      'Go with God, and with your eyes open. Write to me from Dhaka.',
    ],
    reasons: {
      persian: 'Your house has sent goods by sea for years. The agents there take too much. This time, someone from the family walks the road.',
      armenian: 'Your cousin in Agra died in spring. His buyers wait in Bengal. No one in your house has met them. You must.',
      pashtun: 'You know the passes better than any man alive here. Yet you have never taken a load past Lahore. Your family\'s debt will not wait.',
      uzbek: 'Bukhara\'s lambskin sells dear in Delhi, but your old buyer is dead. A new market lies further east, in Bengal.',
      yarkandi: 'The Kashgar road is shut by snow and quarrels. Your silk has no road but this one, and no buyer nearer than Delhi. Go farther.',
    },
    privateReasons: [
      { id: 'book', label: 'I am writing a book of this road.' },
      { id: 'spy', label: 'I carry a letter I must not lose.' },
      { id: 'lover', label: 'I am looking for someone who left.' },
      { id: 'government', label: 'A friend of my family has a post in Bengal.' },
    ],
    verdicts: {
      ruin: 'You came back thinner and wiser. Not every road pays. The living still count.',
      fair: 'You covered your costs and kept your people. Many do less.',
      good: 'A real profit, and most of your party with you. I will tell the others.',
      great: 'Better than I dared hope. The road has a new name in Kabul: yours.',
    },
  });

  const SUBPLOTS = Object.freeze({
    book: { id: 'book', label: 'The traveller\'s book', quality: 'entries', qualityLabel: 'Book entries' },
    spy: { id: 'spy', label: 'The sealed letter', quality: 'exposure', qualityLabel: 'Exposure' },
    lover: { id: 'lover', label: 'The one who left', quality: 'clues', qualityLabel: 'Clues' },
    government: { id: 'government', label: 'A post in Bengal', quality: 'reputation', qualityLabel: 'Reputation' },
  });

  // ---------------------------------------------------------------------------
  // Vignettes (GDD 9.5): short scenes that hint at weather, threats or fodder.
  // kind matches tomorrow's weather class or a threat; "calm" has no hint.
  // ---------------------------------------------------------------------------
  const VIGNETTES = Object.freeze({
    rain: ['The wind smells of rain.', 'Frogs are loud in the ditches tonight.', 'Swallows skim low over the road.', 'Mules lift their heads and snort at a heavy sky.'],
    heat: ['Heat shimmers on the road before noon.', 'Even the crows sit panting in the shade.', 'The water skins already feel warm.', 'Dust hangs still. Nothing moves in the fields.'],
    cold: ['Frost glitters on the thorn bushes.', 'Your breath hangs in the air at dawn.', 'Ice rims the water jars.', 'The mountains look sharp and close. A cold wind follows.'],
    fog: ['A white mist lies in the low fields.', 'Villagers light fires early, speaking softly of fog.', 'Bells sound but their source is hidden.', 'The far trees melt into grey.'],
    bandit: ['Crows circle a ridge ahead.', 'A herd boy runs off the moment he sees you.', 'Cold ashes of a camp lie off the track.', 'Fresh hoofprints cross the road, heading into the scrub.'],
    wildlife: ['Pug marks pad across the wet sand.', 'The animals shy at something unseen.', 'Jackals call from the dry stream.', 'A villager warns of a hungry tiger or wolf near the ford.'],
    fodder: ['A dry well and burnt grass: forage will be thin.', 'The stubble fields have been grazed bare.', 'A farmer sells green fodder cheaply from a cart.', 'Fresh grass fills the roadside. The animals look content.'],
    calm: [],
  });

  /** One calm line or two per region, used when no hint is drawn. */
  const REGION_FLAVOUR = Object.freeze({
    r1: ['Snow-streaked ridges frame the narrow track.', 'Goat bells echo down the gorge.'],
    r2: ['Orange blossom scents the evening air.', 'Irrigation channels glitter between orchards.'],
    r3: ['Rock walls close in. Voices carry far.', 'A watch fire flickers high on a ledge.'],
    r4: ['Bazaar noise drifts over the walls.', 'Pilgrims and merchants share the wide road.'],
    r5: ['Dry ravines cut the plateau into folds.', 'The great river runs wide and quiet below.'],
    r6: ['Wheat and mustard stretch in every direction.', 'A ferryman sings across the water.'],
    r7: ['Wells with creaking wheels line the road.', 'Grand tombs rise out of the haze.'],
    r8: ['Peacocks scream from the mango groves.', 'The Jumna glints beyond the tamarisk.'],
    r9: ['Pilgrims bathe at dawn in the sacred waters.', 'Smoke from cooking fires hangs over the villages.'],
    r10: ['Rice fields glitter under standing water.', 'Boats cross the plain on flooded channels.'],
    r11: ['Low hills fold into green jungle.', 'Egrets stand in the paddy like white flags.'],
    r12: ['Channels braid across the horizon.', 'Boatmen call out in a new dialect.'],
  });

  // ---------------------------------------------------------------------------
  // Storylets. Effects: money, rations, feeds, medicine, covers, pursePct, cargoPct, hpAll,
  // hp{target,amount,cause}, sick, card, quality[name,delta], flag, wait (city days), animalLoss,
  // guardLoss, chance[{p,effects,result}], lostDay. Requires: money, rations, feeds, medicine,
  // role, archetype, subplot, quality, card, flag, flagNot, weather, node, region, month.
  // ---------------------------------------------------------------------------
  const ROAD_STORYLETS = [
    { id: 'stranger_trade', kind: 'road', icon: '🐪', title: 'A passing trader', weight: 1.2, once: false,
      text: ['A small caravan heading west stops to talk. Their leader has food to spare and news of the road.'],
      choices: [
        { id: 'buy', label: 'Buy 10 rations', tone: 'safe', requires: [{ money: '>=9' }], effects: [{ money: -9 }, { rations: 10 }], result: 'A fair price. You tighten the straps on the new sacks.' },
        { id: 'news', label: 'Ask for news of the road', tone: 'safe', effects: [{ quality: ['clues', 0] }], result: 'He shrugs. "Same as ever. Keep your people close."' },
        { id: 'go', label: 'Nod and move on', tone: 'safe', effects: [], result: 'You nod and keep your pace.' }] },
    { id: 'stranger_help', kind: 'road', icon: '🤝', title: 'A traveller in trouble', weight: 0.8, once: false,
      text: ['A lone traveller sits by the road, pale and shaking. They ask if you can spare a dose of medicine.'],
      choices: [
        { id: 'help', label: 'Give a dose of medicine', tone: 'safe', requires: [{ medicine: '>=1' }], effects: [{ medicine: -1 }, { quality: ['reputation', 1] }], result: 'They bless you and press a coin into your hand.' },
        { id: 'water', label: 'Share some water and food', tone: 'safe', requires: [{ rations: '>=3' }], effects: [{ rations: -3 }, { quality: ['reputation', 1] }], result: 'They eat slowly, then thank you quietly.' },
        { id: 'pass', label: 'Pass by', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'You hear nothing behind you but the wind.' }] },
    { id: 'water_trouble', kind: 'road', icon: '💧', title: 'A cloudy stream', weight: 1, once: false,
      text: ['The only water in sight is brown and slow. Your people are thirsty and so are the animals.'],
      choices: [
        { id: 'guide', label: 'Pay a herder to lead you to a clean spring', tone: 'safe', requires: [{ money: '>=15' }], effects: [{ money: -15 }, { chance: [{ p: 0.04, effects: [{ sick: 'dysentery' }], result: 'The spring is clean, but a cup was dirty.' }] }], result: 'The herder leads you to a cold spring.' },
        { id: 'strain', label: 'Strain it through cloth and rest half a day', tone: 'safe', effects: [{ rations: -2 }, { chance: [{ p: 0.1, effects: [{ sick: 'dysentery' }], result: 'It was not quite enough.' }] }], result: 'You strain it twice and let it settle.' },
        { id: 'drink', label: 'Drink it as it is', tone: 'danger', effects: [{ chance: [{ p: 0.35, effects: [{ sick: 'dysentery' }], result: 'By evening someone has the bloody flux (pechish).' }] }], result: 'You drink and move on quickly.' }] },
    { id: 'animal_lame', kind: 'road', icon: '🐫', title: 'A lame animal', weight: 0.8, once: false,
      text: ['One of the pack animals is limping badly. It cannot keep this pace much longer.'],
      choices: [
        { id: 'rest', label: 'Wrap the leg and rest a while', tone: 'safe', effects: [{ animalHp: 10 }, { rations: -3 }], result: 'After a rest it walks without a limp.' },
        { id: 'leave', label: 'Leave it at a village', tone: 'risky', effects: [{ animalLoss: 1 }], result: 'You redistribute the load and leave it behind.' }] },
    { id: 'traveller_news', kind: 'road', icon: '📜', title: 'A talkative pilgrim', weight: 0.9, once: false,
      text: ['A pilgrim falls in step beside you, full of rumours about the road ahead.'],
      choices: [
        { id: 'listen', label: 'Listen carefully', tone: 'safe', effects: [{ rumour: 1 }], result: 'Some of it sounds useful. Some of it sounds like gossip.' },
        { id: 'ignore', label: 'Walk on', tone: 'safe', effects: [], result: 'You keep your counsel and your pace.' }] },
  ];

  const SET_PIECES = [
    { id: 'jalalabad_kitchen', kind: 'arrival', node: 'jalalabad', icon: '🍊', title: 'The sarai kitchen', once: true,
      text: ['After the cold gorges the valley smells of oranges and sugarcane. The sarai kitchen is busy and the cook is cheerful.'],
      choices: [
        { id: 'own', label: 'Eat from your own rations', tone: 'safe', effects: [{ rations: -4 }], result: 'Plain food, plain sleep. Nobody falls ill.' },
        { id: 'eat', label: 'Eat well at the kitchen', tone: 'risky', effects: [{ money: -8 }, { hpAll: 5 }, { chance: [{ p: 0.12, kitchen: true, effects: [{ sick: 'dysentery' }], result: 'By midnight someone regrets the stew.' }] }, { card: 'jal_fruit' }], result: 'Hot rice, fruit and sweet tea. Everyone feels stronger.' },
        { id: 'ask', label: 'Ask the cook where the clean water is', tone: 'safe', effects: [{ card: 'jal_dysentery' }], result: 'She points upstream. "Running water, never the standing pools."' }] },
    { id: 'peshawar_sarai', kind: 'arrival', node: 'peshawar', icon: '🏮', title: 'The crowded sarai', once: true,
      text: ['Every courtyard in Peshawar is full. Rumour travels fast here, and so do fevers.'],
      choices: [
        { id: 'camp', label: 'Camp outside the walls', tone: 'safe', effects: [{ rations: -3 }], result: 'Quiet, cold and clean. You miss the gossip.' },
        { id: 'sarai', label: 'Take a corner and listen', tone: 'risky', effects: [{ money: -6 }, { rumour: 2 }, { chance: [{ p: 0.1, kitchen: true, effects: [{ sick: 'dysentery' }], result: 'Crowds and cooking pots take their toll.' }, { p: 0.08, effects: [{ pursePct: -0.03 }], result: 'A light-fingered neighbour finds your purse.' }] }], result: 'Long talk, strong tea, and a few useful names.' }] },
    { id: 'lahore_market', kind: 'arrival', node: 'lahore', icon: '🏙️', title: 'Lahore, a great market', once: true,
      text: ['Lahore is the largest market you have seen. A broker offers to tell you what Delhi will pay, for a small fee.'],
      choices: [
        { id: 'broker', label: 'Pay the broker for market news', tone: 'safe', requires: [{ money: '>=10' }], effects: [{ money: -10 }, { rumour: 3 }], result: 'He names three buyers and a price range for each.' },
        { id: 'skip', label: 'Trust your own eyes', tone: 'safe', effects: [], result: 'You walk the bazaar and count what you see.' }] },
    { id: 'delhi_winter', kind: 'arrival', node: 'delhi', icon: '🌫️', title: 'Delhi, fog and the winter question', once: true, requires: [{ month: [10, 11, 0, 1] }],
      text: ['Delhi is a great market, but fog and cold hold the road from December to February. A seasoned merchant says winter here is cheaper than a mistake on the road.'],
      choices: [
        { id: 'press', label: 'Press on through the fog', tone: 'risky', effects: [{ foggy: 1 }], result: 'You set out into grey air. Lost days become more likely.' },
        { id: 'stay10', label: 'Stay ten days', tone: 'safe', effects: [{ wait: 10 }], result: 'Ten days of rest, fresh prices and a long list of bills.' },
        { id: 'spring', label: 'Stay until spring', tone: 'safe', effects: [{ waitUntilMonth: 2 }], result: 'You winter in the city. Safer, and costly.' },
        { id: 'sell', label: 'Sell most of your cargo here and go light', tone: 'safe', effects: [{ sellShare: 0.7 }], result: 'Cash up, load down, profit lower.' }] },
    { id: 'agra_prices', kind: 'arrival', node: 'agra', icon: '🕌', title: 'Agra, a rich market', once: true,
      text: ['Agra pays well, but so does the east. A cloth broker hints that Patna will pay more.'],
      choices: [
        { id: 'ask', label: 'Ask what Patna pays', tone: 'safe', effects: [{ rumour: 2 }], result: 'He names a range and a warning about the floods.' },
        { id: 'go', label: 'Keep your own counsel', tone: 'safe', effects: [], result: 'You smile and say nothing.' }] },
    { id: 'varanasi_pilgrims', kind: 'arrival', node: 'varanasi', icon: '🛕', title: 'Pilgrims and fever', once: true,
      text: ['Thousands of pilgrims crowd the streets. Many are sick and some beg for medicine.'],
      choices: [
        { id: 'help', label: 'Give a dose of medicine', tone: 'safe', requires: [{ medicine: '>=1' }], effects: [{ medicine: -1 }, { quality: ['reputation', 1] }], result: 'Word spreads. A stranger bows to you in the street.' },
        { id: 'pass', label: 'Look away and keep your stock', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'You keep your medicine and carry the thought with you.' }] },
    { id: 'patna_flood', kind: 'arrival', node: 'patna', icon: '🌊', title: 'The floodplain', once: true, requires: [{ weather: ['rain', 'monsoon'] }],
      text: ['The Ganga has spilled across the lowlands. Boatmen offer to help, for a price.'],
      choices: [
        { id: 'wait', label: 'Wait out the flood', tone: 'safe', effects: [{ wait: 4 }], result: 'The water falls after four days.' },
        { id: 'boat', label: 'Hire boats for the cargo', tone: 'safe', requires: [{ money: '>=25' }], effects: [{ money: -25 }, { conditionSafe: 1 }], result: 'The cargo rides dry above the water.' },
        { id: 'push', label: 'Push on through the water', tone: 'danger', effects: [{ cargoWet: 2 }, { hpAll: -4 }], result: 'You wade for two days. Everything is wet.' }] },
    { id: 'rajmahal_fever', kind: 'arrival', node: 'rajmahal', icon: '🤒', title: 'The fever hills', once: true,
      text: ['The hills around Rajmahal are green, humid and full of mosquitoes. Locals call it fever season.'],
      choices: [
        { id: 'rest', label: 'Rest three days and rebuild strength', tone: 'safe', effects: [{ wait: 3 }], result: 'Three quiet days. Everyone breathes easier.' },
        { id: 'push', label: 'Push through the fever season', tone: 'risky', effects: [{ chance: [{ p: 0.5, effects: [{ sick: 'fever' }], result: 'Fever takes one of your people.' }] }], result: 'You press on, counting days.' }] },
  ];

  /** One dilemma per region, once, feeding reputation (GDD 9.6). Triggered on the first road day in the region. */
  const DILEMMAS = [
    { id: 'dil_r1', kind: 'dilemma', region: 'r1', icon: '🔥', title: 'A family in the cold', once: true, text: ['A stranded family shivers beside a dead fire. They ask to share your fuel.'],
      choices: [{ id: 'share', label: 'Share your fuel', tone: 'safe', effects: [{ rations: -2 }, { quality: ['reputation', 1] }], result: 'They share their last dried apricots with you.' }, { id: 'keep', label: 'Keep your fuel', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'You keep warm. They do not.' }] },
    { id: 'dil_r2', kind: 'dilemma', region: 'r2', icon: '🍊', title: 'A fruit seller\'s price', once: true, text: ['A fruit seller asks a fair price. You could bargain very hard, or simply take what you like.'],
      choices: [{ id: 'fair', label: 'Pay a fair price', tone: 'safe', effects: [{ money: -6 }, { quality: ['reputation', 1] }], result: 'She adds an extra handful for luck.' }, { id: 'bully', label: 'Bully her down', tone: 'risky', effects: [{ money: -2 }, { quality: ['reputation', -1] }], result: 'You win the price and lose the smile.' }] },
    { id: 'dil_r3', kind: 'dilemma', region: 'r3', icon: '🐫', title: 'A stranded caravan', once: true, text: ['A stranded caravan begs for fodder. Your own stock is thin.'],
      choices: [{ id: 'share', label: 'Share 10 feeds', tone: 'safe', requires: [{ feeds: '>=10' }], effects: [{ feeds: -10 }, { quality: ['reputation', 1] }], result: 'They give you directions in return.' }, { id: 'keep', label: 'Keep your fodder', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'They move on without a word.' }] },
    { id: 'dil_r4', kind: 'dilemma', region: 'r4', icon: '🤒', title: 'A sick stranger', once: true, text: ['A sick stranger asks to share your corner of the sarai.'],
      choices: [{ id: 'allow', label: 'Make room', tone: 'risky', effects: [{ quality: ['reputation', 1] }, { chance: [{ p: 0.2, effects: [{ sick: 'fever' }], result: 'The fever spreads in the night.' }] }], result: 'You give them a blanket and a corner.' }, { id: 'refuse', label: 'Refuse politely', tone: 'safe', effects: [{ quality: ['reputation', -1] }], result: 'They find another corner.' }] },
    { id: 'dil_r5', kind: 'dilemma', region: 'r5', icon: '⛵', title: 'A ferryman\'s demand', once: true, text: ['A ferryman demands double the usual fare, with a shrug.'],
      choices: [{ id: 'pay', label: 'Pay double', tone: 'safe', requires: [{ money: '>=30' }], effects: [{ money: -30 }], result: 'You cross dry and poorer.' }, { id: 'argue', label: 'Argue the price down', tone: 'risky', effects: [{ chance: [{ p: 0.5, effects: [{ money: -15 }], result: 'He relents at a fair price.' }, { p: 0.5, effects: [{ money: -30 }, { quality: ['reputation', -1] }], result: 'He charges the double fare anyway, and sulks.' }] }], result: 'You haggle on the bank.' }] },
    { id: 'dil_r6', kind: 'dilemma', region: 'r6', icon: '✉️', title: 'A stranger\'s letter', once: true, text: ['A stranger asks you to carry a sealed letter east. You know nothing of the writer.'],
      choices: [{ id: 'carry', label: 'Carry the letter', tone: 'risky', effects: [{ quality: ['reputation', 1] }, { quality: ['exposure', 1] }], result: 'You tuck it away and hope.' }, { id: 'refuse', label: 'Decline', tone: 'safe', effects: [], result: 'He looks disappointed and finds another carrier.' }] },
    { id: 'dil_r7', kind: 'dilemma', region: 'r7', icon: '💰', title: 'An official\'s hint', once: true, text: ['An official hints that a small gift would ease your passage.'],
      choices: [{ id: 'refuse', label: 'Refuse politely', tone: 'safe', effects: [{ quality: ['reputation', 1] }, { chance: [{ p: 0.3, effects: [{ lostDay: 1 }], result: 'Your papers are "examined" for a day.' }] }], result: 'He smiles thinly.' }, { id: 'gift', label: 'Offer a gift of 20 rupees', tone: 'risky', requires: [{ money: '>=20' }, { noRole: 'bribeLocked' }], effects: [{ money: -20 }, { quality: ['reputation', -1] }, { quality: ['exposure', -1] }], result: 'The way opens at once.' }] },
    { id: 'dil_r8', kind: 'dilemma', region: 'r8', icon: '⛓️', title: 'A captured thief', once: true, text: ['Villagers hold a thief who begs you to speak for him.'],
      choices: [{ id: 'speak', label: 'Speak for him', tone: 'risky', effects: [{ quality: ['reputation', 1] }, { chance: [{ p: 0.3, effects: [{ pursePct: -0.05 }], result: 'He steals from you on the way out.' }] }], result: 'They let him go with a beating.' }, { id: 'silent', label: 'Say nothing', tone: 'safe', effects: [], result: 'You keep walking.' }] },
    { id: 'dil_r9', kind: 'dilemma', region: 'r9', icon: '💧', title: 'Pilgrims short of water', once: true, text: ['A group of pilgrims has run short of water.'],
      choices: [{ id: 'share', label: 'Share your water', tone: 'safe', effects: [{ rations: -3 }, { quality: ['reputation', 1] }], result: 'They bless you in three languages.' }, { id: 'sell', label: 'Sell them water', tone: 'risky', effects: [{ money: 10 }, { quality: ['reputation', -1] }], result: 'You take their coins.' }] },
    { id: 'dil_r10', kind: 'dilemma', region: 'r10', icon: '🌊', title: 'Flood refugees', once: true, text: ['Flood refugees ask for passage on your road.'],
      choices: [{ id: 'help', label: 'Let them walk with you a day', tone: 'safe', effects: [{ rations: -5 }, { quality: ['reputation', 1] }], result: 'They leave you with a blessing.' }, { id: 'refuse', label: 'Decline', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'You go on alone.' }] },
    { id: 'dil_r11', kind: 'dilemma', region: 'r11', icon: '🧒', title: 'A feverish child', once: true, text: ['A feverish child lies in a village doorway. You have limited medicine.'],
      choices: [{ id: 'give', label: 'Give a dose of medicine', tone: 'safe', requires: [{ medicine: '>=1' }], effects: [{ medicine: -1 }, { quality: ['reputation', 1] }], result: 'The mother touches your feet.' }, { id: 'keep', label: 'Keep your medicine', tone: 'risky', effects: [{ quality: ['reputation', -1] }], result: 'You walk on.' }] },
    { id: 'dil_r12', kind: 'dilemma', region: 'r12', icon: '⛈️', title: 'The last ferry', once: true, text: ['The last ferry before a storm wants triple price. Waiting means rain.'],
      choices: [{ id: 'pay', label: 'Pay triple', tone: 'safe', requires: [{ money: '>=60' }], effects: [{ money: -60 }], result: 'You cross in rising wind.' }, { id: 'wait', label: 'Wait out the storm', tone: 'safe', effects: [{ wait: 2 }], result: 'Two days of rain. The price falls.' }] },
  ];

  // ---------------------------------------------------------------------------
  // Subplot beats (GDD 9.3). Fewer than the GDD estimate: three beats per subplot plus an ending.
  // ---------------------------------------------------------------------------
  function subplotBeat(id, subplot, node, icon, title, text, choices) {
    return { id, kind: 'subplot', subplot, node, icon, title, once: true, salience: 10, text, choices };
  }

  const SUBPLOT_BEATS = [
    subplotBeat('book_1', 'book', 'jalalabad', '📖', 'An old storyteller', ['An old storyteller at the sarai offers to tell you the tale of this road, if you give him an evening.'], [
      { id: 'listen', label: 'Spend the evening and write it down', tone: 'safe', effects: [{ rations: -2 }, { quality: ['entries', 1] }], result: 'You fill four pages by lamplight.' },
      { id: 'pay', label: 'Pay him a few coins for the short version', tone: 'safe', requires: [{ money: '>=5' }], effects: [{ money: -5 }, { quality: ['entries', 1] }], result: 'He talks fast. You write faster.' },
      { id: 'skip', label: 'Rest instead', tone: 'safe', effects: [], result: 'You sleep, and the story goes unrecorded.' }]),
    subplotBeat('book_2', 'book', 'lahore', '📖', 'A rival writer', ['A scholar in Lahore keeps notes on every road in the empire. He will show you his pages, for a favour.'], [
      { id: 'trade', label: 'Trade a day of notes for his', tone: 'safe', effects: [{ wait: 1 }, { quality: ['entries', 2] }], result: 'You copy until your wrist aches.' },
      { id: 'pay', label: 'Pay 15 rupees for a copy', tone: 'safe', requires: [{ money: '>=15' }], effects: [{ money: -15 }, { quality: ['entries', 1] }], result: 'The copy is smudged, but useful.' },
      { id: 'skip', label: 'Move on', tone: 'safe', effects: [], result: 'You hope your own notes will do.' }]),
    subplotBeat('book_3', 'book', 'varanasi', '📖', 'Rain on the notebook', ['Rain soaks a pack. Your notebook is at risk.'], [
      { id: 'save', label: 'Dry the pages with your own cloth', tone: 'safe', effects: [{ rations: -1 }, { quality: ['entries', 1] }], result: 'The pages survive.' },
      { id: 'ignore', label: 'Save the cargo first', tone: 'risky', effects: [{ quality: ['entries', -1] }], result: 'You lose some pages to damp.' }]),
    subplotBeat('spy_1', 'spy', 'jalalabad', '✉️', 'A watcher at the post', ['A thin man in a good coat watches you from across the sarai yard. He looks away when you meet his eye.'], [
      { id: 'confront', label: 'Walk over and greet him', tone: 'risky', effects: [{ quality: ['exposure', 1] }], result: 'He mumbles an excuse. He knows your face now.' },
      { id: 'avoid', label: 'Avoid him and move your bags', tone: 'safe', effects: [], result: 'He loses interest by morning.' },
      { id: 'bribe', label: 'Pay a groom to watch him', tone: 'safe', requires: [{ money: '>=8' }], effects: [{ money: -8 }, { quality: ['exposure', -1] }], result: 'The groom whispers who the watcher serves.' }]),
    subplotBeat('spy_2', 'spy', 'lahore', '✉️', 'A drop in Lahore', ['A shopkeeper in Lahore says the right words. It is time to hand over part of the letter\'s purpose.'], [
      { id: 'deliver', label: 'Pass the signal', tone: 'risky', effects: [{ quality: ['exposure', 1] }, { flag: 'spy_drop' }], result: 'He nods. You feel watched all evening.' },
      { id: 'wait', label: 'Wait a day and watch', tone: 'safe', effects: [{ wait: 1 }, { quality: ['exposure', -1] }], result: 'Nobody follows you. You pass the signal at dusk.' }]),
    subplotBeat('spy_3', 'spy', 'varanasi', '✉️', 'A double agent?', ['A pilgrim asks to see your letter. He knows too much to be a stranger.'], [
      { id: 'refuse', label: 'Refuse and leave quickly', tone: 'safe', effects: [{ quality: ['exposure', 1] }], result: 'He does not follow, but others may.' },
      { id: 'burn', label: 'Burn the letter\'s outer wrapper', tone: 'risky', effects: [{ quality: ['exposure', -1] }, { flag: 'spy_burned' }], result: 'The flames die. Your hands shake.' }]),
    subplotBeat('lover_1', 'lover', 'jalalabad', '🔎', 'A traveller\'s word', ['A traveller says he saw a caravan with a woman who matched your description heading south, weeks ago.'], [
      { id: 'ask', label: 'Ask for every detail', tone: 'safe', effects: [{ rations: -1 }, { quality: ['clues', 1] }], result: 'He draws a rough map in the dust.' },
      { id: 'doubt', label: 'Thank him and doubt him', tone: 'safe', effects: [], result: 'You carry the story without believing it.' }]),
    subplotBeat('lover_2', 'lover', 'lahore', '🔎', 'A letter at Lahore', ['A merchant hands you a note from your own family. It says only: "Not Lahore. Try Delhi."'], [
      { id: 'follow', label: 'Believe the note', tone: 'safe', effects: [{ quality: ['clues', 1] }], result: 'You fold it carefully.' },
      { id: 'question', label: 'Question the merchant', tone: 'risky', effects: [{ chance: [{ p: 0.5, effects: [{ quality: ['clues', 2] }], result: 'He lets slip a name and a price.' }, { p: 0.5, effects: [{ quality: ['clues', -1] }], result: 'He lied, and you realise too late.' }] }], result: 'You press him.' }]),
    subplotBeat('lover_3', 'lover', 'varanasi', '🔎', 'A near miss', ['In a crowded ghat you glimpse a face that could be hers. The crowd swallows it.'], [
      { id: 'chase', label: 'Push through the crowd', tone: 'risky', effects: [{ chance: [{ p: 0.4, effects: [{ quality: ['clues', 2] }], result: 'You find a boatman who knew her.' }, { p: 0.6, effects: [{ hpAll: -2 }], result: 'You find only a stranger. You are bruised and tired.' }] }], result: 'You shove forward.' },
      { id: 'ask', label: 'Ask the boatmen quietly', tone: 'safe', requires: [{ money: '>=6' }], effects: [{ money: -6 }, { quality: ['clues', 1] }], result: 'They say a pair of travellers went east.' }]),
    subplotBeat('government_1', 'government', 'jalalabad', '📜', 'The acquaintance\'s letter', ['The letter says: "Come to Dhaka. A man of good name is needed in the governor\'s office."'], [
      { id: 'honour', label: 'Resolve to be honest on the road', tone: 'safe', effects: [{ quality: ['reputation', 1] }], result: 'You fold the letter into your coat.' },
      { id: 'shrug', label: 'Think it over later', tone: 'safe', effects: [], result: 'You carry on.' }]),
    subplotBeat('government_2', 'government', 'lahore', '📜', 'A city official hears of you', ['A Lahore official has heard that your caravan is honest, or perhaps just lucky.'], [
      { id: 'greet', label: 'Call on him with a small gift', tone: 'risky', requires: [{ money: '>=12' }], effects: [{ money: -12 }, { quality: ['reputation', 1] }], result: 'He writes your name in a ledger.' },
      { id: 'avoid', label: 'Avoid the attention', tone: 'safe', effects: [], result: 'You pass through unnoticed.' }]),
    subplotBeat('government_3', 'government', 'varanasi', '📜', 'A moral test', ['A guard offers to let you jump a long queue of pilgrims for a bribe. Your name might be remembered.'], [
      { id: 'queue', label: 'Wait in the queue', tone: 'safe', effects: [{ wait: 1 }, { quality: ['reputation', 1] }], result: 'The queue takes a day. People notice.' },
      { id: 'bribe', label: 'Pay the bribe', tone: 'danger', requires: [{ money: '>=15' }, { noRole: 'bribeLocked' }], effects: [{ money: -15 }, { quality: ['reputation', -1] }], result: 'You jump the queue. Several eyes follow.' }]),
  ];

  // ---------------------------------------------------------------------------
  // Codex (GDD 15). Every card carries source and confidence. City cards were spot-checked
  // (see docs/facts.md); a subject expert still has to review them (source TBD). Low-confidence cards are hedged. Unlock: arrival at the node, or
  // by asking around at that node.
  // ---------------------------------------------------------------------------
  function card(id, nodeId, unlock, title, text, confidence) {
    return { id, nodeId, unlock, title, text, confidence, source: 'TBD' };
  }

  const CODEX = Object.freeze([
    card("kab_crossroads", "kabul", 'arrival', "Kabul: gate to Central Asia", "In the 1660s, Kabul lay in a high Hindu Kush valley, the Mughal Empire's northwestern gate to Persia and Central Asia. Beneath the Bala Hisar citadel, the arched Chahar Chatta bazaar and the orchard tomb-garden of Emperor Babur drew Persian-speaking merchants, imperial officers and Sufi pilgrims. Caravan drivers packed raisins and dried apricots into sacks, shared pulao from copper dishes, and led their camels down the river gorge toward Jalalabad.", "moderate"),
    card("jal_fruit", "jalalabad", 'arrival', "Jalalabad: the warm valley", "In the 1660s, Jalalabad stood in a warm basin beside the Kabul River, a garden town founded under Akbar as the last comfortable halt before the Khyber. Babur had once praised the sugarcane and citrus of this plain, and Mughal relay posts called dak chowkis kept couriers running letters along the road while elders prayed in mud-brick mosques. Weary traders pressed sugarcane into brass cups, bit into tart oranges and set off east toward the Khyber.", "moderate"),
    card("khy_pass", "khyber", 'arrival', "The Khyber Pass", "In the 1660s, the Khyber Pass was a narrow, stony gorge climbing from the Kabul River basin toward the Peshawar plain, the Mughal Empire's most contested doorway. Afridi and Shinwari clansmen watched from stone towers and collected passage fees that Mughal officials paid or disputed, while Pashtun custom bound them to shelter any guest and Sufi pirs settled quarrels. Footsore merchants tore strips of dried mutton, ate flatbread baked on hot stones and descended through red-brown defiles toward Peshawar.", "moderate"),
    card("pes_sarai", "peshawar", 'arrival', "Peshawar: the frontier market", "In the 1660s, Peshawar sat in a fertile plain below the Khyber, a walled Mughal city and the last great market before the Indus. Its Gor Khatri caravanserai, raised in 1641 by Princess Jahanara, and Mahabat Khan's mosque sheltered Pashtun, Persian and Hindu traders beside the imperial road, which brick kos minars measured. Hungry travellers tore hot naan from clay ovens, ate charcoal-grilled lamb from iron skewers and rode east across the plain toward Attock.", "moderate"),
    card("att_fort", "attock", 'arrival', "Attock: the fort on the Indus", "In the 1660s, Attock guarded the deep, narrow gorge where the Indus squeezed between hills, the Mughal Empire's great river barrier on the northwest road. Akbar's fortress, raised in the early 1580s, commanded the ferries, boatmen prayed to the river saint Khwaja Khizr, and tradition said the name itself meant an obstacle. Tired caravan men grilled Indus fish on reed skewers, ate it with flatbread and ferried their animals east toward Hasan Abdal.", "moderate"),
    card("has_waypoint", "hasan_abdal", 'arrival', "Hasan Abdal: spring and shrine", "In the 1660s, Hasan Abdal nestled in a spring-watered hollow beneath wooded hills, the first cool halt for caravans east of the Indus. Mughal emperors had camped in its gardens on the way to Kashmir, Muslims climbed to Baba Wali Qandhari's hilltop shrine, and Sikh tradition held that Guru Nanak left his handprint on a rock here. Travellers dipped flatbread in lentil dal, drank from the spring's stone tank and followed the road east across the red Potohar plateau.", "moderate"),
    card("roh_fort", "rohtas", 'arrival', "Rohtas: the fort of Sher Shah", "In the 1660s, Rohtas stood on a hill-country ridge near the Jhelum, where Sher Shah Suri's fort, begun in the 1540s against the Gakhar chiefs, still closed the road behind twelve gates and a wall about four kilometres long. Sher Shah had also laid the highway and its sarais, and travellers passed under the Sohail Gate, said to be named for a Sufi saint. Muleteers chewed millet flatbread with buttermilk, filled their waterskins at the fort's wells and dropped toward the Jhelum.", "moderate"),
    card("jhe_river", "jhelum", 'arrival', "Jhelum: the river of timber", "In the 1660s, Jhelum spread along a broad, braided river where the Himalayan foothills met the Punjab plain, a boat-building town on the road to Lahore. Deodar logs floated down from Kashmir were lashed into rafts and ferries beside its landing steps, and Muslim shrines and Hindu bathing ghats faced each other across the current. Ferrymen shared fried river fish and hot flatbread with waiting merchants before poling them across the water toward Gujrat.", "low"),
    card("guj_chenab", "gujrat", 'arrival', "Gujrat: between two rivers", "In the 1660s, Gujrat stood on the fertile plain between the Jhelum and the Chenab, a fortified town renewed under Akbar that fed the highway to Lahore. Brick kos minars and a walled sarai marked the road, and the Sufi saint Shah Daula, then in old age, drew villagers to his hospice. Camel drivers ate wheat roti dripping with ghee and jaggery, drank cold buttermilk from clay pots and crossed the Chenab's wide channels toward Lahore.", "low"),
    card("lah_city", "lahore", 'arrival', "Lahore: the garden capital", "In the 1660s, Lahore rose above the Ravi in the Punjab plain, a provincial capital of the Mughal Empire and one of the richest cities on the road between Kabul and Delhi. Shah Jahan's Shalimar Gardens, the tiled Wazir Khan Mosque and the shrine of the saint Data Ganj Bakhsh gave the city its glitter and its devotion, while sarais and couriers kept the highway moving. Travellers bought saffron halwa and stuffed kulchas in the bazaars, then crossed the Ravi toward Amritsar.", "moderate"),
    card("ami_variant", "amritsar", 'arrival', "Amritsar: the pool of nectar", "In the 1660s, Amritsar was a young Sikh pilgrim town on the Punjab plain, founded in 1577 around a sacred pool and a short ride off the highway between Lahore and Jalandhar. Sikh devotion centred on the Harmandir Sahib, which Guru Arjan completed in 1604, and its langar, a free kitchen, fed any traveller regardless of faith. Pilgrims and grain merchants ate lentils, flatbread and sweet karah prasad before crossing the Beas toward Jalandhar.", "moderate"),
    card("jal_beas", "jalandhar", 'arrival', "Jalandhar: the Doab town", "In the 1660s, Jalandhar lay in the fertile Doab between the Beas and Sutlej rivers, a Mughal administrative seat where a faujdar kept order on the highway. Brick kos minars, one every two kos, and sarais founded under Sher Shah and Akbar lined the road, while Sufi dargahs and Hindu temples shared the town's bazaars. Drovers munched lumps of golden jaggery, sipped sugarcane juice and walked east toward the Sutlej crossing.", "moderate"),
    card("lud_sutlej", "ludhiana", 'arrival', "Ludhiana: the Sutlej landing", "In the 1660s, Ludhiana stood above the Sutlej, a modest river town founded by Lodi nobles in 1480 and a busy ferry stage on the Lahore to Delhi highway. Boatmen poled travellers across the wide river beneath brick kos minars and Sufi dargahs, while Mughal officials levied dues at the landing. Drovers roasted chickpeas on iron pans, ate them with jaggery and followed the road east toward Sirhind through fields of wheat and sugarcane.", "moderate"),
    card("sir_added", "sirhind", 'arrival', "Sirhind: the saint and the wall", "In the 1660s, Sirhind rose from the open plain as a fortified Mughal city on the highway between Lahore and Delhi, ringed by brick walls and royal gardens. The Naqshbandi saint Sheikh Ahmad Sirhindi, called the Mujaddid, had lain in his tomb here since 1624, and pilgrims arrived from across the empire to pray beside it. Travellers ate hot chapatis with spiced chickpeas, drank buttermilk from clay cups and left for Ambala under a wide, flat sky.", "moderate"),
    card("amb_town", "ambala", 'arrival', "Ambala: a halt on the plain", "In the 1660s, Ambala was a modest market town on the plain between the Ghaggar and the Yamuna, a halting place on the imperial road to Delhi. Brick kos minars stood at every second kos and sarais stabled the animals, while pilgrims bound for the holy tanks at Thanesar shared the road with merchants. Wagoners ate millet roti with warm milk, drank sweet buttermilk and rolled east across level fields toward Karnal.", "low"),
    card("kar_town", "karnal", 'arrival', "Karnal: a small road market", "In the 1660s, Karnal lay on the flat alluvial plain near the Yamuna, a small road market beside the pilgrim country of Kurukshetra. Local tradition tied its name to Karna, the warrior of the Mahabharata, while brick kos minars and the sarais founded by Sher Shah steered travellers past fields of sugarcane. Cart drivers ate parched gram with jaggery, filled their gourds at village wells and pressed on to nearby Panipat.", "low"),
    card("pan_town", "panipat", 'arrival', "Panipat: the field of battles", "In the 1660s, Panipat was a brick market town on the flat plain north of Delhi, remembered for two battles that decided India's fate: Babur's victory in 1526 and the Mughal victory of 1556 under the boy emperor Akbar. Babur's Kabuli Bagh mosque and the shrine of the Sufi saint Bu Ali Shah Qalandar marked the town, and kos minars led travellers on. Camel drivers drank salted yoghurt, ate sesame-and-jaggery sweets and marched south toward Delhi.", "moderate"),
    card("del_city", "delhi", 'arrival', "Delhi: Shahjahanabad", "In the 1660s, Delhi was the capital of Emperor Aurangzeb, a walled river city on the Yamuna that his father Shah Jahan had rebuilt as Shahjahanabad in the 1640s. The Red Fort's Lahori Gate opened onto Chandni Chowk, whose canal ran down the middle, and the Jama Masjid, finished in 1656, towered over the bazaars while pilgrims visited Nizamuddin's shrine. Travellers ate hot jalebis fried in ghee, drank sherbet and set out southeast toward Mathura.", "moderate"),
    card("mat_jumna", "mathura", 'arrival', "Mathura: Krishna's city", "In the 1660s, Mathura stood on a bend of the Yamuna in Braj country, an ancient pilgrim city revered as the birthplace of Krishna. Its tall Keshava Deva temple, raised under Bir Singh Deo in 1618, and the bathing steps of Vishram Ghat drew Vaishnava devotees, while Mughal kos minars kept the road to Agra in order. Travellers sipped thick milk from clay cups, ate sweet pedas and rode south along the river.", "moderate"),
    card("agr_city", "agra", 'arrival', "Agra: the former capital", "In the 1660s, Agra spread along the Yamuna as the Mughal Empire's former capital, still gleaming with Akbar's red-sandstone fort and Shah Jahan's white marble Taj Mahal. Inside the fort the old emperor lived on as the prisoner of his son Aurangzeb, said to gaze toward his wife's tomb, while Sufi dargahs and Hindu temples filled the old city around the bazaars. Travellers bought hot pooris with spiced lentils, drank sugarcane juice and set out southeast across the Doab toward Etawah.", "moderate"),
    card("eta_town", "etawah", 'arrival', "Etawah: the last market for days", "In the 1660s, Etawah stood on a high bank of the Yamuna in the dry southern Doab, a river town at the edge of the Chambal's ravines. Sixty-one kos of road, with brick kos minars and few markets, lay ahead to Fatehpur and the Ganga, so couriers and merchants stocked up here beside Hindu temples and Sufi shrines. Cart drivers ate roasted gram, rotis and curd, filled their water jars and rolled southeast across thorn and dust.", "low"),
    card("fat_town", "fatehpur", 'arrival', "Fatehpur: a Doab market", "In the 1660s, Fatehpur stood on the fertile plain between the Ganga and the Yamuna, a market town where the highway to Allahabad gathered farmers' grain and imperial toll collectors. Mango groves shaded its sarai, brick kos minars counted the distance east, and temple bells answered the call to prayer from Sufi mosques. Wagoners ate hot rotis with fresh curd and green chillies, drank cold well water from brass pots and drove on toward Allahabad and the Jumna ferry.", "low"),
    card("all_confluence", "allahabad", 'arrival', "Allahabad: where two rivers meet", "In the 1660s, Allahabad commanded the sangam, the meeting of the Ganga and the Yamuna, where Akbar's red fortress, raised in the 1580s, enclosed an ancient Ashoka pillar that Jahangir had later inscribed. Hindu pilgrims bathed at the confluence and honoured the sacred Akshayavat tree, while Mughal governors, Sufi lodges and boatmen kept the highway and ferries working. Travellers bought roasted chickpeas, sugar drops and puris from pilgrim stalls before riding east beside the Ganga toward Varanasi.", "moderate"),
    card("var_pilgrims", "varanasi", 'arrival', "Varanasi: the city of Shiva", "In the 1660s, Varanasi crowded the high west bank of the Ganga, the holiest city of Hindu India, a long crescent of ghats climbing from the water to temple spires. The Vishwanath temple, rebuilt in the 1580s, drew pilgrims, scholars and silk-brocade weavers, while Sufi lodges served Muslim craftsmen and Mughal officers watched the river road. Pilgrims drank thick lassi from clay cups, ate hot kachoris and walked southeast toward Sasaram and the Kaimur hills.", "moderate"),
    card("sas_town", "sasaram", 'arrival', "Sasaram: Sher Shah's home", "In the 1660s, Sasaram sat below the Kaimur hills at the western edge of Bihar, the ancestral seat of Sher Shah Suri, whose road carried travellers through it. His great sandstone tomb rose from the middle of a lake, an octagonal mausoleum under a wide dome, and keepers of nearby Sufi shrines kept lamps burning. Muleteers baked sattu-stuffed litti in embers, ate it with ghee and set out across the plain toward the Son river and Patna.", "moderate"),
    card("pat_port", "patna", 'arrival', "Patna: the river port", "In the 1660s, Patna stretched for miles along the Ganga, the great river port of Bihar and a Mughal provincial seat, where Dutch and English factors bought saltpetre, opium and fine rice. Its Pathar ki Masjid, built in 1626, looked over the ghats, while Hindu temples and Sufi lodges lined the bazaars. River crews stirred roasted-barley sattu into water with salt and green chilli, then travelled east along the Ganga toward Munger.", "moderate"),
    card("mun_fort", "munger", 'arrival', "Munger: the fort on the bluff", "In the 1660s, Munger rose on a rocky bluff above the Ganga, a river fort town that held a Mughal garrison and watched the water road between Bihar and Bengal. Its hilltop fort and the shrine of the Sufi saint Pir Shah Nafah anchored the town, while Hindu pilgrims bathed at the hot springs of Sita Kund nearby. Boatmen and carters ate flattened rice soaked in curd with jaggery and rowed or rode east toward Bhagalpur.", "low"),
    card("bha_town", "bhagalpur", 'arrival', "Bhagalpur: the weavers' bank", "In the 1660s, Bhagalpur lay on the southern bank of the Ganga in the flood plain of eastern Bihar, a river town of weavers, boatmen and grain dealers on the road to Bengal. Hindu temples and Sufi shrines clustered along its ghats, and tradition linked the town to the ancient kingdom of Anga and the silk-weaving craft. Travellers ate rice with lentils and river fish, drank water boiled and cooled in clay jars, and pushed east across the flood plain toward Rajmahal.", "low"),
    card("raj_capital", "rajmahal", 'arrival', "Rajmahal: the old capital", "In the 1660s, Rajmahal clung to the Ganga where the Rajmahal Hills crowd the river, a former capital of Bengal under Man Singh and later Prince Shah Shuja. Shah Shuja's stone hall, the Sangi Dalan, and his wharves recalled the years when Bengal was governed from here, while Mughal officers kept the river road and hill people traded honey and wax. Travellers ate fried river fish with rice and mustard oil, then crossed forested hills toward Makhsusabad.", "moderate"),
    card("mak_name", "makhsusabad", 'arrival', "Makhsusabad: the silk market", "In the 1660s, Makhsusabad spread along the Bhagirathi, a river market town in western Bengal that would later be renamed Murshidabad, close to the silk factories of Kasimbazar. Raw silk bales from nearby weavers passed through its bazaar to Dutch and English buyers, while Hindu temples and Sufi mosques stood on the river bank. Boatmen ate puffed rice with date-palm jaggery and set off southeast along the river, then across the delta's channels toward Dhaka.", "moderate"),
    card("dha_capital", "dhaka", 'arrival', "Dhaka: the eastern capital", "In the 1660s, Dhaka stood above the Buriganga in the Bengal delta, the Mughal Empire's eastern capital since 1610, governed by Shaista Khan from 1664. Its Bara Katra caravanserai, built in the 1640s beside the river, sheltered merchants buying Dhaka muslin so fine the imperial court prized it, while Sufi dargahs and Hindu temples anchored the city's faiths. Boat crews ate steaming rice with fried hilsa and mustard oil on the wharves, ready to unload at the end of the long road east.", "moderate"),
    // Ask around: one per stop, in the traveller's own voice (first person).
    card("att_water", "kabul", 'ask', "Rivers and the seasons", "Before we left Kabul, an old ferryman warned me about the rivers ahead. They run highest in summer, when snow melts and the monsoon rains fall. In autumn and winter the water drops, and crossing is usually safer.", "high"),
    card("jal_dysentery", "jalalabad", 'ask', "Dysentery on the road", "The sarai cook warned me about pechish, which the English call the bloody flux: dysentery. It spreads through dirty water and food, she said. Since then I drink only from clean, running water, or water I have boiled.", "moderate"),
    card("kab_rahdari", "khyber", 'ask', "Rahdari: the road toll", "At the Khyber post I grumbled about rahdari, the road fees. A merchant laughed. Aurangzeb ordered many such taxes ended around 1659, he said, but local officials still collect them. A paper order does not empty a guard's palm.", "moderate"),
    card("pes_hakim", "peshawar", 'ask', "The hakim", "When my stomach turned, I visited a hakim in the bazaar. He practised Unani medicine, the Greek and Arab healing of the Muslim world, and sold me herbs and a bitter syrup. Help on the road, he warned, can be days away.", "moderate"),
    card("khy_khushal", "attock", 'ask', "A poet in prison", "On the road from Peshawar we passed through Khattak country. A guard spoke proudly of Khushal Khan Khattak, his chief and a poet. The Mughals arrested him around 1664, he said, and he is still a prisoner.", "moderate"),
    card("pes_sarai_what", "hasan_abdal", 'ask', "What is a sarai?", "Tonight we slept in a sarai, a walled inn built around a courtyard. Our animals stood in the yard and we took a small room along the wall. Over supper, strangers traded prices, rumours and warnings about the road.", "moderate"),
    card("road_sher_shah", "rohtas", 'ask', "Sher Shah's road", "Under the walls of Rohtas, an old soldier told me that Sher Shah Suri, who ruled in the 1540s, improved this long road from Bengal toward the Indus and built sarais along it. People still argue how far west it reached.", "moderate"),
    card("jhe_ferries", "jhelum", 'ask', "Ferries and boatmen", "We waited a day at the Jhelum for a boat. The boatmen set their fares by the season and the height of the water. When the river rises, careful travellers wait; the impatient sometimes lose their animals.", "moderate"),
    card("guj_kashmir", "gujrat", 'ask', "The emperors' road to Kashmir", "A muleteer pointed north to the hills and told me the Mughal court rode to Kashmir from here, by way of Bhimber and the Pir Panjal passes. The emperor Jahangir died on that road in 1627, coming back from his beloved valley.", "high"),
    card("lah_shahdara", "lahore", 'ask', "Across the Ravi", "From the Ravi ferry I saw the gardens of Shahdara. The emperor Jahangir lies there in a tomb finished in the 1630s. Nearby rests his powerful wife, Nur Jahan, who outlived him and died in Lahore in 1645.", "high"),
    card("ami_anandpur", "amritsar", 'ask', "News of the ninth Guru", "A Sikh pilgrim told me that Tegh Bahadur, who became the ninth Guru last year, has bought land in the Shivalik hills to found a new town. In the Harmandir, he said, the Adi Granth has been kept since 1604.", "moderate"),
    card("kab_kos", "jalandhar", 'ask', "Kos and kos minars", "Every few kos we pass a round brick pillar by the road: a kos minar, a Mughal milestone. A kos is a road distance of two to four kilometres, depending on the region. Our caravan reckons about 3.6 km.", "moderate"),
    card("lud_dak", "ludhiana", 'ask', "The dak runners", "At night a runner sped past us, bells jingling on his staff. A clerk explained the dak to me: relays of runners and riders at posts along the road, carrying letters and reports to the emperor faster than any caravan moves.", "moderate"),
    card("sir_newswriters", "sirhind", 'ask', "The emperor's ears", "In Sirhind I met a waqia-navis, a news-writer. Men like him send regular reports to the court about prices, crimes and the doings of local officers. 'The emperor knows what happens on his road,' he said, without smiling.", "high"),
    card("amb_kurukshetra", "ambala", 'ask', "The holy tanks of Thanesar", "Pilgrims beside us were bound for Thanesar and Kurukshetra, the plain where the Mahabharata's great battle is said to have been fought. Crowds bathe in its sacred tanks, they told me, above all during an eclipse of the sun.", "high"),
    card("kar_gur", "karnal", 'ask', "How gur is made", "Outside Karnal I watched oxen walk in circles round a wooden press, crushing sugarcane. The juice was boiled in wide iron pans until it thickened into gur, the brown sugar we carry and that sweetens every roadside snack.", "high"),
    card("pan_guns", "panipat", 'ask', "Why armies meet here", "An old man at Panipat told me armies meet here because this open plain is the road every invader from the northwest must take to Delhi. In 1526 Babur used guns and a wall of carts to beat a far larger army.", "high"),
    card("hundi", "delhi", 'ask', "Paper instead of silver", "In Delhi a merchant-banker offered me a hundi, a written order to pay. I could leave my silver with him and collect it from his partner far down the road. Safer than carrying coins, if the banker can be trusted.", "moderate"),
    card("mat_vrindavan", "mathura", 'ask', "The temple at Vrindavan", "Pilgrims led me north of Mathura to Vrindavan, the forest town of Krishna's childhood. There Raja Man Singh, Akbar's great general, raised the red-sandstone temple of Govind Dev in 1590. Its towers rose above the trees.", "high"),
    card("agr_rupee", "agra", 'ask', "The silver rupee", "Changing money in Agra, I learned the rupee's story. Sher Shah Suri struck a silver rupiya of about eleven grams, and the Mughals kept it. Small things are paid in copper dams; under Akbar, forty dams made a rupee.", "high"),
    card("eta_ravines", "etawah", 'ask', "The ravines", "South of Etawah the land breaks into deep ravines cut by the Chambal and its streams. Our guide hurried us past. Robbers hide in those gullies, he said, and a caravan that strays from the road may not come out.", "moderate"),
    card("fat_kanpur", "fatehpur", 'ask', "The Ganga crossing", "Before Fatehpur we crossed the Ganga at the Kanpur ferry, then only a small landing place. Boats carried our bales one load at a time while the animals swam beside them, led by boatmen. The crossing took all morning.", "moderate"),
    card("all_magh", "allahabad", 'ask', "The Magh fair", "A priest at the confluence told me that every year, in the month of Magh, around January and February, pilgrims camp in their thousands on the river sands to bathe at the sangam, where the Ganga meets the Yamuna.", "high"),
    card("var_tulsidas", "varanasi", 'ask', "The poets of Kashi", "A boatman on the ghats recited verses for me. Kabir, the weaver-poet, lived here long ago, he said, and Tulsidas wrote his Ramcharitmanas, the story of Rama in Hindi verse, in this city. Tulsidas died here in 1623.", "high"),
    card("sas_karmanasa", "sasaram", 'ask', "The cursed river", "Before Sasaram we crossed the Karmanasa. My Hindu companions lifted their feet and kept its water off their skin: they believe this river washes away the merit of good deeds. A Muslim carter splashed straight through, laughing.", "high"),
    card("pat_saltpetre", "patna", 'ask', "Saltpetre", "At the Patna wharves I watched Dutch and English agents weigh grey crystals of saltpetre, scraped from village soils and boiled clean. It is the main ingredient of gunpowder, and boats carry it down the Ganga for ships bound for Europe.", "high"),
    card("mun_dolphin", "munger", 'ask', "The river dolphins", "Below Munger's fort I saw grey backs rolling in the Ganga. The boatmen call them susu: river dolphins, almost blind, that hunt fish by sound in the muddy water. Nobody on our boat would harm one.", "high"),
    card("bha_vikramashila", "bhagalpur", 'ask', "A ruined university", "Near Bhagalpur a villager showed me mounds of old brick. A great Buddhist monastery and school called Vikramashila once stood near here, he said, where monks came even from Tibet to study. It was destroyed over four centuries ago.", "high"),
    card("raj_shuja", "rajmahal", 'ask', "The prince who vanished", "In Rajmahal an old servant told me about Prince Shah Shuja, who governed Bengal from here. In the war for the throne he lost to Aurangzeb's general Mir Jumla, fled to Arakan in 1660 and was never heard of again.", "high"),
    card("mak_silk", "makhsusabad", 'ask', "Silk from worms", "At Kasimbazar I watched women drop cocoons into hot water and reel out threads finer than hair. The raw silk is wound into skeins, and Dutch and English agents buy it by the bale for their ships.", "high"),
    card("dha_chittagong", "dhaka", 'ask', "War boats on the river", "On the Buriganga I saw shipwrights building war boats. The new governor, Shaista Khan, means to strike Chittagong, a soldier told me, where Arakanese and Portuguese raiders shelter and sell captives taken from Bengal's villages.", "high"),
  ]);

  const LESSONS = Object.freeze({
    hunger: 'Food ran out. Caravans counted days of food against kos of road, and bought more where it was cheap.',
    fever: 'Fever struck. Travellers carried remedies and rested the sick.',
    dysentery: 'Dysentery (pechish) spread through bad water. Clean, running water mattered more than speed.',
    heat: 'Heat wore people down. Many caravans travelled in the cooler hours.',
    exposure: 'Cold and snow killed. Late-autumn travellers faced snow in the high passes.',
    exhaustion: 'Too much speed, too little rest. Hard marching breaks people before it breaks roads.',
    violence: 'Robbers or armed men took lives. Caravans paid guards, travelled together and paid for safe passage.',
    drowning: 'The river took the caravan. Crossing at the wrong season is among the oldest dangers of the road.',
    general: 'The road was long. Preparation, patience and local knowledge decided who arrived.',
  });

  namespace.Content = Object.freeze({
    CANDIDATES, FIRST_RUN_OFFERS, DAULAT_BEG, SUBPLOTS, VIGNETTES, REGION_FLAVOUR,
    STORYLETS: Object.freeze([...ROAD_STORYLETS, ...SET_PIECES, ...DILEMMAS, ...SUBPLOT_BEATS]),
    CODEX, LESSONS,
  });
})(window.Karvanyan);
