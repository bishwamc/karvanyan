/**
 * tests/v402.test.mjs — v4.0.2 margin rules (Engine.computeMargin). Run: node --test tests/v402.test.mjs
 * The margin must agree with the stop screen's readiness check, work on the road, and change nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../tools/simulate.mjs';

const { State, Engine, Config, World } = loadGame();
const setup = (extra) => ({ archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.4, candidateIds: ['hakim_jafar', 'sher_dil', 'bibi_gulnar'], rationPacks: 8, feedPacks: 8, startMonthIndex: 9, subplotId: 'book', worldSeed: 77, scout: true, ...extra });
const newGame = (extra) => State.createNewGame(setup(extra));
const quiet = { saraiPolicy: 'never' };
const copyState = (state) => JSON.parse(JSON.stringify(state));

test('margin agrees with the readiness check for every merchant and many stockpiles', () => {
  let compared = 0;
  Config.ARCHETYPES.forEach((archetype) => {
    [0, 1, 3, 5, 8].forEach((packs) => {
      const state = newGame({ archetypeId: archetype.id, rationPacks: packs, feedPacks: packs });
      const margin = Engine.computeMargin(state);
      const readiness = Engine.getLegReadiness(state);
      assert.equal(margin.needDays, readiness.food.needDays, `${archetype.id}/${packs}: needDays`);
      assert.equal(margin.food.haveDays, readiness.food.haveDays, `${archetype.id}/${packs}: food days`);
      assert.equal(margin.feed.haveDays, readiness.feed.haveDays, `${archetype.id}/${packs}: feed days`);
      assert.equal(margin.food.status === 'ok', readiness.food.isOk, `${archetype.id}/${packs}: food ok flag`);
      assert.equal(margin.feed.status === 'ok', readiness.feed.isOk, `${archetype.id}/${packs}: feed ok flag`);
      compared += 1;
    });
  });
  assert.equal(compared, Config.ARCHETYPES.length * 5);
});

test('status boundaries: short below the trip, tight between trip and spare days, ok at the need', () => {
  const state = newGame();
  const base = Engine.computeMargin(state);
  const perDay = State.getRationsPerDay(state);
  const withRations = (days) => { const next = copyState(state); next.supplies.rations = perDay * days + 0.1; return Engine.computeMargin(next).food; };
  assert.equal(withRations(base.legDays - 1).status, 'short');
  assert.equal(withRations(base.legDays).status, 'tight');
  assert.equal(withRations(base.needDays - 1).status, 'tight');
  assert.equal(withRations(base.needDays).status, 'ok');
  assert.equal(withRations(0).status, 'short');
  assert.equal(withRations(0).haveDays, 0);
});

test('zero rations per day never divides by zero', () => {
  const state = copyState(newGame());
  state.supplies.rations = 0;
  const margin = Engine.computeMargin(state);
  assert.equal(margin.food.haveDays, 0);
  assert.ok(Number.isFinite(margin.food.haveDays) && Number.isFinite(margin.feed.haveDays));
});

test('on the road it counts only the kos still to go, and it never grows as the caravan walks', () => {
  let state = Engine.beginLeg(newGame());
  const random = State.createRandomSource(5);
  const first = Engine.computeMargin(state);
  assert.equal(first.isOnRoad, true);
  let previous = first.legDays;
  for (let step = 0; step < 4 && state.phase === 'road'; step += 1) {
    state = Engine.advanceDay(state, random, quiet);
    if (state.pending || state.phase !== 'road') break;
    const margin = Engine.computeMargin(state);
    assert.ok(margin.legDays <= previous + 1, `legDays jumped from ${previous} to ${margin.legDays}`);
    previous = margin.legDays;
  }
  assert.ok(previous <= first.legDays + 1);
});

test('at the end of the road (no road ahead) there is no margin', () => {
  const lastNodeId = World.NODES.map((node) => node.id).find((id) => World.getOutgoingEdges(id).length === 0);
  assert.ok(lastNodeId, 'the world has a final stop');
  const state = copyState(newGame());
  state.nodeId = lastNodeId;
  state.edgeId = null;
  assert.equal(Engine.computeMargin(state), null);
});

test('computeMargin changes nothing', () => {
  const state = newGame();
  const before = JSON.stringify(state);
  Engine.computeMargin(state);
  Engine.computeMargin(Engine.beginLeg(state));
  assert.equal(JSON.stringify(state), before);
});
