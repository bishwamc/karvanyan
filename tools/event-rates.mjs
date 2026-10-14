/**
 * Counts how often each road storylet appears, by region, over seeded runs.
 * Usage: node tools/event-rates.mjs [runs=120]
 * Drives the engine with a simple policy: rest when asked, take the first available choice.
 * It is a rough measure of frequency, not a balance test; use tools/simulate.mjs for win rates.
 */
import { loadGame } from './simulate.mjs';

const { State, Engine, Events } = loadGame();
const runs = Number(process.argv[2] || 120);
const tally = {};

for (let seed = 1; seed <= runs; seed += 1) {
  const random = State.createRandomSource(seed ^ 0x9e3779b9);
  let state = State.createNewGame({
    archetypeId: 'persian', leaderName: 'Hadi', cargoShare: 0.35, candidateIds: ['naseer', 'hakim_jafar', 'sher_dil'],
    rationPacks: 8, feedPacks: 8, startMonthIndex: 9, subplotId: 'bandit', worldSeed: seed, animals: [], hires: [],
  });
  for (let step = 0; step < 4000 && state.phase !== 'ended'; step += 1) {
    if (state.pending) {
      const pending = state.pending;
      if (pending.id && pending.id.startsWith('road_')) {
        const key = `${pending.id}@${State.getRegionOfState(state).id}`;
        tally[key] = (tally[key] || 0) + 1;
      }
      if (pending.kind === 'provision') state = Engine.resolveProvision(state, random, null, { saraiPolicy: 'never' });
      else if (pending.kind === 'night') state = Engine.chooseNight(state, random, state.phase === 'stop' ? 'sarai' : 'camp', { saraiPolicy: 'never' });
      else if (pending.kind === 'jettison') { state = { ...Engine.autoJettison(state), pending: null }; if (state.phase === 'stop') state = Engine.beginLeg(state); }
      else {
        const view = Events.getView(state);
        const choice = view && view.choices.find((item) => !item.reason);
        const outcome = choice ? Events.choose(state, choice.id, random, { saraiPolicy: 'never' }) : null;
        if (!outcome) break;
        state = outcome.state;
      }
      continue;
    }
    if (state.phase === 'stop') { state = Engine.beginLeg(state); continue; }
    state = Engine.advanceDay(state, random, { saraiPolicy: 'never' });
  }
}

console.log(`Road storylets seen over ${runs} runs (count, by region):`);
Object.keys(tally).sort().forEach((key) => console.log(`  ${key.padEnd(22)} ${tally[key]}`));
