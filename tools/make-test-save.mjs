/**
 * Writes a stop-phase game state, as JSON, for the browser journey test.
 * Usage: node tools/make-test-save.mjs <stopId> > state.json   (e.g. jhelum, makhsusabad)
 */
import { loadGame } from './simulate.mjs';

const stopId = process.argv[2] || 'kabul';
const { State } = loadGame();
const fresh = State.createNewGame({
  archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.35, candidateIds: ['naseer', 'hakim_jafar', 'sher_dil'],
  rationPacks: 40, feedPacks: 40, startMonthIndex: 9, subplotId: 'bandit', worldSeed: 99, animals: [], hires: [],
});
process.stdout.write(JSON.stringify({ ...fresh, nodeId: stopId, edgeId: null, kosOnEdge: 0, pending: null, queue: [], dayStage: null }));
