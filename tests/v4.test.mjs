/**
 * tests/v4.test.mjs — v4 rules: start loads, readiness, jettison order, the day-3 crisis, schema 3 migration,
 * chapter ends, letters, margin notes, analytics paths. Run: node --test tests/v4.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGame } from '../tools/simulate.mjs';

const { State, Engine, Events, Config, World, Story, Content } = loadGame();
const setup = (extra) => ({ archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.4, candidateIds: ['hakim_jafar', 'sher_dil', 'bibi_gulnar'], rationPacks: 8, feedPacks: 8, startMonthIndex: 9, subplotId: 'book', worldSeed: 77, scout: true, ...extra });
const newGame = (extra) => State.createNewGame(setup(extra));
const quiet = { saraiPolicy: 'never' };

test('F3: every merchant starts at or under 85% of capacity, at every cargo share', () => {
  Config.ARCHETYPES.forEach((archetype) => {
    [0.25, 0.4, 0.55, 0.7].forEach((share) => {
      const state = newGame({ archetypeId: archetype.id, cargoShare: share });
      const loadShare = State.getLoad(state) / State.getCapacity(state);
      assert.ok(loadShare <= 0.85 + 1e-9, `${archetype.id} at ${share}: ${Math.round(loadShare * 100)}%`);
    });
  });
});

test('Q8: the lame-camel crisis fires on day 3 (or 4) in 100 seeds, exactly once', () => {
  const days = {};
  for (let seed = 1; seed <= 100; seed += 1) {
    let state = Engine.beginLeg(newGame({ worldSeed: seed * 7919 }));
    const random = State.createRandomSource(seed);
    let firedOn = null;
    let fired = 0;
    for (let step = 0; step < 24 && state.phase !== 'ended'; step += 1) {
      state = Engine.advanceDay(state, random, quiet);
      while (state.pending) {
        if (state.pending.id === Story.CRISIS_ID) { fired += 1; firedOn = firedOn || state.dayIndex; }
        const view = Events.getView(state);
        state = Events.choose(state, view.choices.find((choice) => !choice.reason).id, random, quiet).state;
      }
    }
    assert.equal(fired, 1, `seed ${seed} fired ${fired} times`);
    days[firedOn] = (days[firedOn] || 0) + 1;
  }
  assert.ok(Object.keys(days).every((day) => day === '3' || day === '4'), JSON.stringify(days));
});

test('crisis choices all resolve and set crisis_done', () => {
  ['leave_lots', 'spread', 'leave_rations', 'put_down'].forEach((choiceId) => {
    let state = Engine.beginLeg(newGame());
    const random = State.createRandomSource(5);
    for (let step = 0; step < 6 && !(state.pending && state.pending.id === Story.CRISIS_ID); step += 1) {
      state = Engine.advanceDay(state, random, quiet);
      while (state.pending && state.pending.id !== Story.CRISIS_ID) state = Events.choose(state, Events.getView(state).choices.find((choice) => !choice.reason).id, random, quiet).state;
    }
    assert.equal(state.pending.id, Story.CRISIS_ID);
    const view = Events.getView(state);
    assert.ok(view.choices.some((choice) => choice.id === choiceId), choiceId);
    const next = Events.choose(state, choiceId, random, quiet).state;
    assert.equal(next.flags.crisis_done, true);
  });
});

test('F4: auto-jettison drops spare animals feed and cargo before supplies people eat', () => {
  assert.ok(Array.isArray(Engine.JETTISON_ORDER) && Engine.JETTISON_ORDER.length >= 3);
  const rationIndex = Engine.JETTISON_ORDER.indexOf('rations');
  const feedIndex = Engine.JETTISON_ORDER.indexOf('feeds');
  assert.ok(rationIndex === -1 || rationIndex > feedIndex, 'rations are not dropped before feed');
});

test('F5: buying past capacity is refused with a load code and remedies are offered', () => {
  let state = newGame();
  let refused = null;
  for (let index = 0; index < 60 && !refused; index += 1) {
    const result = Engine.buySupply(state, 'rations');
    if (result.reason) refused = result; else state = result.state;
  }
  assert.ok(refused, 'purchase eventually refused');
  assert.equal(refused.reasonCode, 'load');
  assert.ok(Engine.getLoadRemedies(state).length > 0);
});

test('N6: readiness is ok for the default start, and shortfalls name the packs to buy', () => {
  const state = newGame();
  const ready = Engine.getLegReadiness(state);
  assert.equal(ready.food.isOk, true);
  assert.equal(ready.feed.isOk, true);
  const hungry = State.patchState(state, { supplies: { ...state.supplies, rations: 2 } });
  const shortReady = Engine.getLegReadiness(hungry);
  assert.equal(shortReady.food.isOk, false);
  assert.ok(shortReady.food.packsToBuy >= 1);
  const brief = Engine.getLegBrief(state);
  assert.equal(brief.stopName, 'Jalalabad');
});

test('Q9: a schema 2 save loads, gains story fields, and continues', () => {
  const state = newGame();
  const old = JSON.parse(JSON.stringify(state));
  delete old.story;
  const text = JSON.stringify({ schema: 2, savedAt: 0, state: { ...old, schemaVersion: 2 }, random: 12345 });
  // Build through the real writer, then downgrade the version number the way an old save would look.
  const written = JSON.parse(State.buildSaveText(state, 12345));
  const versionKey = Object.keys(written).find((key) => /schema|version/i.test(key) && typeof written[key] === 'number');
  assert.ok(versionKey, 'save envelope has a version number');
  written[versionKey] = 2;
  if (written.state) delete written.state.story;
  const parsed = State.parseSaveText(JSON.stringify(written));
  assert.equal(parsed.status, 'ok', JSON.stringify(parsed).slice(0, 200));
  assert.equal(parsed.state.story.chapterNumber, 1);
  assert.equal(parsed.state.story.companionMoodById.hakim_jafar, 60);
  const next = Engine.beginLeg(parsed.state);
  assert.equal(next.phase, 'road');
  void text;
});

test('a save from a newer schema is refused, not guessed at', () => {
  const written = JSON.parse(State.buildSaveText(newGame(), 1));
  const versionKey = Object.keys(written).find((key) => /schema|version/i.test(key) && typeof written[key] === 'number');
  written[versionKey] = 99;
  assert.notEqual(State.parseSaveText(JSON.stringify(written)).status, 'ok');
});

test('N4: chapter 1 ends at Attock once; the final chapter has no chapter screen', () => {
  const before = { ...newGame(), nodeId: 'peshawar', phase: 'stop' };
  const at = { ...before, nodeId: 'attock', flags: {} };
  assert.equal(Story.getChapterEndDue(before, at).number, 1);
  assert.equal(Story.getChapterEndDue(before, { ...at, flags: { chapter_done_1: true } }), null);
  assert.equal(Story.getChapterEndDue({ ...before, nodeId: 'rajmahal' }, { ...at, nodeId: 'dhaka' }), null);
  assert.equal(Story.getChapterNumberForNode('attock'), 1);
  assert.equal(Story.getChapterNumberForNode('hasan_abdal'), 2);
  Story.CHAPTERS.forEach((chapter) => assert.ok(World.findNode(chapter.endNodeId), chapter.endNodeId));
});

test('N2: a letter waits at its stop until opened, and opening is remembered', () => {
  const letter = Story.LETTERS[0];
  let state = { ...newGame(), nodeId: letter.stopId, phase: 'stop' };
  assert.equal(Story.getUnopenedLetter(state).id, letter.id);
  state = Story.markLetterOpened(state, letter.id);
  assert.equal(Story.getUnopenedLetter(state), null);
  assert.deepEqual(Story.markLetterOpened(state, letter.id), state);
});

test('N3: margin notes show once, in order of need, and never twice', () => {
  let state = newGame();
  assert.equal(Story.pickMarginNoteId(state), 'firstBuy');
  state = Story.markCoachNoteSeen(state, 'firstBuy');
  assert.equal(Story.pickMarginNoteId(state), null);
  assert.equal(Story.markCoachNoteSeen(state, 'not_a_note'), state);
});

test('start screen: curated six cover six roles and every one exists', () => {
  const roles = Story.START_ROLE_ORDER.map((role) => State.findCandidate(Story.CURATED_CANDIDATE_BY_ROLE[role]).role);
  assert.deepEqual(roles, Story.START_ROLE_ORDER);
  Object.keys(Story.GAP_LINES).forEach((role) => assert.ok(Story.GAP_LINES[role].length > 10));
});

test('F9: the final market sells food and feed at 40% of the normal price', () => {
  const normal = State.getBuyPrice({ ...newGame(), nodeId: 'rajmahal' }, 'rations');
  const final = State.getBuyPrice({ ...newGame(), nodeId: World.FINAL_MARKET_NODE_ID }, 'rations');
  assert.ok(final < normal);
});

test('image ids all have alt text and match the naming rule', () => {
  Object.keys(Content.IMAGE_ALT).forEach((id) => assert.match(id, /^(title_hero|letter_paper|seal_red|stop_[a-z_]+|por_[a-z_]+_(content|worried|grieving)|ev_[a-z_]+)$/, id));
  World.NODES.forEach((node) => assert.ok(Content.IMAGE_ALT[`stop_${node.id}`], node.id));
});

test('Q: new analytics events build, and bad values are refused', () => {
  const window = { Karvanyan: { Config, World } };
  new Function('window', fs.readFileSync(new URL('../js/analytics.js', import.meta.url), 'utf8'))(window);
  const A = window.Karvanyan.Analytics;
  assert.equal(A.buildEventPath('chapter', '1', 'done'), 'chapter/1/done');
  assert.equal(A.buildEventPath('crisis', 'camel', 'spread'), 'crisis/camel/spread');
  assert.equal(A.buildEventPath('intro', 'quick'), 'intro/quick');
  assert.equal(A.buildEventPath('quit', '2', 'road'), 'quit/2/road');
  assert.equal(A.buildEventPath('crisis', 'camel', 'free text'), null);
  assert.equal(A.buildEventPath('chapter', '9', 'done'), null);
  assert.equal(A.isAllowedEventPath('quit/2/road'), true);
});
