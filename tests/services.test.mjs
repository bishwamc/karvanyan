/** Tests for the services seam. Run: node --test tests/services.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'services.js'), 'utf8'), ctx);
const { Services } = ctx.Karvanyan;

function fakeStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), data };
}

test('exposes every method the game calls, in both modes', () => {
  const local = Services.createServices({ storage: fakeStorage() });
  Services.METHOD_NAMES.forEach((name) => assert.equal(typeof local[name], 'function', name));
  assert.equal(local.mode, 'local');
});

test('journey starts and ends are counted and survive a new instance', async () => {
  const storage = fakeStorage();
  const first = Services.createServices({ storage });
  await first.recordJourneyStart({ archetypeId: 'persian' });
  await first.recordJourneyStart({ archetypeId: 'armenian' });
  await first.recordJourneyEnd({ stopId: 'dhaka' });
  const second = Services.createServices({ storage });
  const stats = await second.getPublicStats();
  assert.equal(stats.journeysStarted, 2);
  assert.equal(stats.journeysEnded, 1);
  assert.equal(stats.scope, 'this-browser', 'local counts must say they are not global');
});

test('blocked or broken storage never throws; counts continue in memory', async () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const services = Services.createServices({ storage: broken });
  await assert.doesNotReject(services.recordJourneyStart({}));
  const stats = await services.getPublicStats();
  assert.equal(stats.journeysStarted, 1);
});

test('corrupt stored JSON is treated as empty, not a crash', async () => {
  const storage = fakeStorage();
  storage.setItem('karvanyan.local-stats.v1', '{not json');
  const services = Services.createServices({ storage });
  const stats = await services.getPublicStats();
  assert.equal(stats.journeysStarted, 0);
});

test('score submission reports not-configured instead of pretending to send', async () => {
  const services = Services.createServices({ storage: fakeStorage() });
  const result = await services.submitScore({ name: 'Hadi', score: 1234 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-configured');
});

test('a remote adapter replaces the local one, and its failures become statuses', async () => {
  const remote = {
    recordJourneyStart: async () => ({ ok: true, source: 'remote' }),
    submitScore: async () => { throw new Error('offline'); },
  };
  const services = Services.createServices({ storage: fakeStorage(), remote });
  assert.equal(services.mode, 'remote');
  const started = await services.recordJourneyStart({});
  assert.equal(started.ok, true);
  assert.equal(started.source, 'remote');
  const failed = await services.submitScore({});
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'remote-error');
  // A method the remote does not provide falls back to local.
  const fallback = await services.getPublicStats();
  assert.equal(fallback.scope, 'this-browser');
});
