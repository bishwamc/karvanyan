/**
 * content.js — writing and story data (GDD sections 9, 10, 11, 15).
 *
 * All characters are fictional. Reasons for going east are fiction, not history.
 * Cultural details are placeholders to be checked in the fact register (VERIFY).
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
  // Codex (GDD 15). Every card carries source and confidence. NONE has been checked against
  // sources yet (source TBD). Low-confidence cards are hedged. Unlock: arrival at the node, or
  // by asking around at that node.
  // ---------------------------------------------------------------------------
  function card(id, nodeId, unlock, title, text, confidence) {
    return { id, nodeId, unlock, title, text, confidence, source: 'TBD' };
  }

  const CODEX = Object.freeze([
    card('kab_crossroads', 'kabul', 'arrival', 'A city of crossroads', 'Kabul stood where roads from Central Asia, Persia and India met. Horses, fruit and cloth passed through its markets. In 1665 it belonged to the Mughal Empire.', 'moderate'),
    card('kab_rahdari', 'kabul', 'ask', 'Rahdari: the road toll', 'Rahdari were fees charged on roads. Tradition says Aurangzeb ordered many such taxes ended around 1659. Local officials often kept collecting anyway, so a paper order did not always change life on the road.', 'moderate'),
    card('kab_kos', 'kabul', 'ask', 'What is a kos?', 'A kos was a road distance, usually between two and four kilometres. It changed with the time and place. This game uses about 3.6 km to a kos. Travellers counted trips in kos and in days of walking.', 'low'),
    card('road_sher_shah', 'kabul', 'ask', 'The road and its sarais', 'The rule of Sher Shah Suri in the 1540s is remembered for improving the long road from Bengal toward the Indus and for building sarais along it. Sources differ on how far west the road reached.', 'moderate'),
    card('jal_fruit', 'jalalabad', 'arrival', 'The warm valley', 'The valley near Jalalabad is warmer than Kabul and grew sugarcane and citrus. Babur wrote about this warmer country in his memoir. Travellers felt the change in climate within days.', 'moderate'),
    card('jal_dysentery', 'jalalabad', 'ask', 'Dysentery on the road', 'Dysentery is called the "bloody flux" in English and, travellers\' accounts suggest, pechish in Persian and Hindustani. It spread through dirty water and food. Travellers tried to drink from clean, running water.', 'moderate'),
    card('khy_pass', 'khyber', 'arrival', 'The Khyber Pass', 'The Khyber Pass is a narrow mountain route between Afghanistan and the Indus plain. Caravans, armies and pilgrims used it for centuries. Local tribes watched the road closely.', 'high'),
    card('khy_khushal', 'khyber', 'ask', 'A poet in prison', 'Khushal Khan Khattak was a Pashtun chief and poet. He was arrested by the Mughals around 1664 and was still a prisoner in 1665. This made the northwest road a tense place.', 'moderate'),
    card('pes_sarai', 'peshawar', 'arrival', 'The sarai', 'A sarai was a walled inn for people and animals. Large towns had several. Travellers often slept in the courtyard beside their animals and traded news over the evening meal.', 'moderate'),
    card('pes_hakim', 'peshawar', 'ask', 'The hakim', 'Hakims were physicians trained in Unani medicine. Large towns often had hakims and bazaars selling herbs. Travellers carried remedies because real help could be days away.', 'moderate'),
    card('att_fort', 'attock', 'arrival', 'The fort on the Indus', 'Akbar had a fort built at Attock in the 1580s to guard the Indus crossing. Armies and caravans both needed it. Crossing a great river was never routine.', 'moderate'),
    card('att_name', 'attock', 'ask', 'What is in a name?', 'Tradition says the name Attock means "blocked" or "forbidden", and that some travellers once feared crossing the Indus. This is a folk explanation, and scholars may not agree on it.', 'low'),
    card('att_water', 'kabul', 'ask', 'Rivers and the seasons', 'The big rivers of the north run highest in summer, when snow melts and monsoon rain falls. In autumn and winter the water is lower, and crossing is usually safer.', 'high'),
    card('has_waypoint', 'hasan_abdal', 'arrival', 'A waypoint', 'Hasan Abdal lies on the road east of the Indus. This game uses it as the stop before Rohtas. Travellers also passed Rawalpindi, which was a small place then. These details need checking.', 'low'),
    card('roh_fort', 'rohtas', 'arrival', 'Rohtas fort', 'The great fort of Rohtas is usually credited to Sher Shah Suri in the 1540s. It guarded the road through hill country. Its walls and gates are still standing today.', 'moderate'),
    card('jhe_river', 'jhelum', 'arrival', 'Ferries and boatmen', 'The rivers of the Punjab were crossed by ferry or ford. Fares and risk changed with the season. Travellers waited for boats, and sometimes for water to fall.', 'moderate'),
    card('guj_chenab', 'gujrat', 'arrival', 'A town on the Chenab road', 'Towns along the Punjab rivers lived by trade, ferries and farming. Merchants stopped to rest animals and sell goods before the next crossing.', 'low'),
    card('lah_city', 'lahore', 'arrival', 'A great city', 'Lahore was one of the great cities of the Mughal Empire, with large markets, gardens and buildings. Merchants from many regions came to trade here.', 'moderate'),
    card('ami_variant', 'amritsar', 'arrival', 'A route variant', 'The exact route of the road through the Punjab varied with period and sources. The game uses Amritsar as a stop. This choice is provisional.', 'low'),
    card('jal_beas', 'jalandhar', 'arrival', 'Between two rivers', 'The Beas and the Sutlej cross this part of the Punjab. Ferries were important and water levels changed with the seasons.', 'moderate'),
    card('lud_sutlej', 'ludhiana', 'arrival', 'The Sutlej', 'The Sutlej was one of the great rivers of the Punjab. Crossing it was part of any journey from Lahore toward Delhi.', 'moderate'),
    card('sir_added', 'sirhind', 'arrival', 'A town on the plain', 'Sirhind was an important town on the road between the Punjab and Delhi. Its place in this game\'s route is provisional.', 'low'),
    card('amb_town', 'ambala', 'arrival', 'A road town', 'Towns like Ambala grew around the road, serving travellers with food, lodging and fodder. Markets were small but busy.', 'low'),
    card('kar_town', 'karnal', 'arrival', 'A small market', 'Small markets on the road sold fodder, grain and simple goods. They were often the last chance for supplies before a long stage.', 'low'),
    card('pan_town', 'panipat', 'arrival', 'A town of old battles', 'Panipat was the site of famous battles in earlier centuries. By the 1660s it was a market town on the road to Delhi.', 'moderate'),
    card('del_city', 'delhi', 'arrival', 'The imperial city', 'In the 1660s Delhi was a great city of the Mughal Empire, with palaces, markets and officials who checked travellers. Fog and cold could slow the winter roads.', 'moderate'),
    card('mat_jumna', 'mathura', 'arrival', 'A town on the Jumna', 'Mathura lies on the Jumna and is an old pilgrimage place. Ferries crossed the river near the towns of Braj.', 'moderate'),
    card('agr_city', 'agra', 'arrival', 'A great market on the river', 'Agra was a great Mughal city with large markets. Merchants compared prices here before going east. The Taj Mahal, completed in the 1650s, was already a landmark.', 'moderate'),
    card('eta_town', 'etawah', 'arrival', 'A long road ahead', 'The road beyond Etawah runs a long way before the next big town. Travellers stocked up on food and fodder before setting out.', 'low'),
    card('fat_town', 'fatehpur', 'arrival', 'A town on the Ganga plain', 'Fatehpur is used in this game in place of Kanpur as a stop. Kanpur was a small ferry place then. This choice needs checking.', 'low'),
    card('all_confluence', 'allahabad', 'arrival', 'Where two rivers meet', 'At Allahabad (Prayag) two great rivers meet and the place is holy to many Hindus. Akbar had a fort built here in the 1580s.', 'moderate'),
    card('var_pilgrims', 'varanasi', 'arrival', 'A city of pilgrims', 'Varanasi has long drawn pilgrims. Crowds, heat and shared water made illness easy to spread in such places.', 'moderate'),
    card('sas_town', 'sasaram', 'arrival', 'A small town before the Son', 'Sasaram lay on the road to Patna. The river Son lay ahead and could be difficult in high water.', 'low'),
    card('pat_port', 'patna', 'arrival', 'A port on the Ganga', 'Patna was a busy river port and trading city. European trading companies also bought goods there, according to later records.', 'moderate'),
    card('mun_fort', 'munger', 'arrival', 'A river fort town', 'Munger had a fort above the Ganga. River towns lived by ferries, boats and the road.', 'low'),
    card('bha_town', 'bhagalpur', 'arrival', 'A river town', 'Bhagalpur sits on the Ganga plain. Floods and heavy rain made the monsoon months hard for travellers.', 'low'),
    card('raj_capital', 'rajmahal', 'arrival', 'A former capital', 'Rajmahal served as a provincial capital of Bengal at different times. The hills and humid air nearby were known for fevers.', 'moderate'),
    card('mak_name', 'makhsusabad', 'arrival', 'A name that changed', 'Makhsusabad was later called Murshidabad. The name in this game is the one used in the 1660s, according to some sources; check before relying on it.', 'low'),
    card('dha_capital', 'dhaka', 'arrival', 'The provincial capital', 'Dhaka was a provincial capital of Bengal. Shaista Khan became governor in 1664, and the French traveller Tavernier visited Dhaka in early 1666, according to his account.', 'moderate'),
    card('beyond_dhaka', 'dhaka', 'ask', 'Places beyond the road\'s end', 'Sonargaon, Comilla and Chittagong lie further east and south-east. The road in this game ends at Dhaka, and nothing beyond it can be travelled.', 'moderate'),
    card('hundi', 'delhi', 'ask', 'Paper instead of silver', 'Merchant-bankers moved money by hundi, a written order to pay. A hundi was safer than carrying coins, but the banker had to be trusted. This is not yet in the game.', 'low'),
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
