/** Tests for version 2.8: Delhi stays keep stores, daytime road threats, and the stay-cost preview. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../tools/simulate.mjs';

const { State, Engine, Events, Content, Config } = loadGame();

const freshState = (nodeId, extra) => {
  const base = State.createNewGame({
    archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.35, candidateIds: ['naseer', 'hakim_jafar', 'sher_dil'],
    rationPacks: 8, feedPacks: 8, startMonthIndex: 9, subplotId: 'bandit', worldSeed: 77, animals: [], hires: [],
  });
  return { ...base, nodeId, money: 5000, ...(extra || {}) };
};
const seededRandom = (seed) => State.createRandomSource(seed);

test('Delhi stay with keepSupplies: lodging is paid, rations and feeds are the same at the end', () => {
  const start = freshState('delhi');
  const random = seededRandom(5);
  const days = 4;
  const kept = Engine.passCityDays(start, random, days, { keepSupplies: true });
  assert.equal(kept.supplies.rations, start.supplies.rations, 'rations unchanged');
  assert.equal(kept.supplies.feeds, start.supplies.feeds, 'feeds unchanged');
  assert.ok(kept.money < start.money, 'lodging is charged');
});

test('the same stay without keepSupplies eats through stock (the control)', () => {
  const start = freshState('delhi');
  const eaten = Engine.passCityDays(start, seededRandom(5), 4);
  assert.ok(eaten.supplies.rations < start.supplies.rations || eaten.supplies.feeds < start.supplies.feeds);
});

test('the stay-cost preview matches what the stay actually charges', () => {
  const start = freshState('delhi');
  const estimate = Engine.estimateStayCost(start, 4);
  const after = Engine.passCityDays(start, seededRandom(9), 4, { keepSupplies: true });
  assert.equal(start.money - after.money, estimate.money);
});

test('Khyber has no lodging charge, so the preview is free there', () => {
  assert.equal(Engine.estimateStayCost(freshState('khyber'), 10).money, 0);
});

test('a stay the player cannot afford is flagged before they choose it', () => {
  const poor = freshState('delhi', { money: 3 });
  assert.equal(Engine.estimateStayCost(poor, 10).isMoneyShort, true);
});

test('the Delhi stay choices carry the keep-supplies flag', () => {
  const winter = Content.STORYLETS.find((item) => item.choices.some((choice) => choice.id === 'spring'));
  const stay = winter.choices.find((choice) => choice.id === 'stay10');
  const spring = winter.choices.find((choice) => choice.id === 'spring');
  assert.ok(stay.effects.some((effect) => effect.keepSupplies), 'stay ten days');
  assert.ok(spring.effects.some((effect) => effect.keepSupplies), 'stay until spring');
});

test('the choice view shows the stay price and that stores are kept', () => {
  const winter = Content.STORYLETS.find((item) => item.choices.some((choice) => choice.id === 'spring'));
  const state = { ...freshState('delhi'), pending: { kind: 'storylet', id: winter.id } };
  const view = Events.getView(state);
  const spring = view.choices.find((choice) => choice.id === 'spring');
  assert.ok(spring.chips.some((chip) => /About \d+ days in the city/.test(chip)), 'stay length and price');
  assert.ok(spring.chips.some((chip) => /stores kept/.test(chip)), 'stores kept note');
});

const ROAD_THREATS = ['road_ambush', 'road_wildlife', 'road_flood'];
const KNOWN_EFFECT_KEYS = new Set(['money', 'pursePct', 'cargoPct', 'cargoWet', 'rations', 'feeds', 'medicine', 'covers', 'hp', 'hpAll', 'sick',
  'animalLoss', 'animalHp', 'guardLoss', 'rumour', 'wait', 'waitUntilMonth', 'keepSupplies', 'chance', 'card', 'quality', 'flag',
  'foggy', 'sellShare', 'conditionSafe', 'waitUntilMonth']);

test('the three daytime threat storylets exist, are on the road, and have only supported effects', () => {
  ROAD_THREATS.forEach((id) => {
    const storylet = Content.STORYLETS.find((item) => item.id === id);
    assert.ok(storylet, id);
    assert.equal(storylet.kind, 'road', id);
    assert.ok(storylet.choices.length >= 2, `${id} offers a choice`);
    storylet.choices.forEach((choice) => {
      (choice.effects || []).forEach((effect) => {
        Object.keys(effect).forEach((key) => assert.ok(KNOWN_EFFECT_KEYS.has(key), `${id}/${choice.id} unknown effect ${key}`));
      });
    });
    storylet.text.forEach((paragraph) => assert.ok(paragraph.trim().split(/\s+/).length <= 45, `${id} paragraph too long`));
  });
});

test('the road pools reach their storylets (ambush, wildlife, flood)', () => {
  const state = freshState('attock');
  const random = seededRandom(3);
  const picked = { ambush: Events.pickRoadStorylet(state, 'ambush', random), wildlife: Events.pickRoadStorylet(state, 'wildlife', random), flood: Events.pickRoadStorylet(state, 'flood', random) };
  assert.equal(picked.ambush, 'road_ambush');
  assert.equal(picked.wildlife, 'road_wildlife');
  assert.equal(picked.flood, 'road_flood');
});

test('choosing "Stay until spring" in Delhi keeps rations and feeds through the real choice path', () => {
  const winter = Content.STORYLETS.find((item) => item.choices.some((choice) => choice.id === 'spring'));
  const start = { ...freshState('delhi'), pending: { kind: 'storylet', id: winter.id } };
  const outcome = Events.choose(start, 'spring', seededRandom(21), { saraiPolicy: 'never' });
  assert.ok(outcome, 'choice accepted');
  assert.equal(outcome.state.supplies.rations, start.supplies.rations, 'rations kept');
  assert.equal(outcome.state.supplies.feeds, start.supplies.feeds, 'feeds kept');
  assert.ok(outcome.state.money < start.money, 'lodging paid');
});
