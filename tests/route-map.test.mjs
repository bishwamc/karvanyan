/**
 * Tests for the journey map geometry and the region-change rule. Run: node --test tests/route-map.test.mjs
 * Loads the real js files into a fake window, so the tests use the shipped data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadNamespace(files) {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx, { filename: file }));
  return ctx.Karvanyan;
}
const K = loadNamespace(['config.js', 'world.js', 'content.js', 'route-map.js']);
const { World, RouteMap } = K;

test('every stop has approximate coordinates', () => {
  World.NODES.forEach((node) => {
    const coords = RouteMap.APPROX_COORDS[node.id];
    assert.ok(coords, `missing coords for ${node.id}`);
    assert.ok(coords[0] > 20 && coords[0] < 36 && coords[1] > 65 && coords[1] < 95, `${node.id} out of South Asia bounds`);
  });
});

test('the full route visits every stop in order, from Kabul to Dhaka', () => {
  const ids = RouteMap.getFullRouteIds();
  assert.equal(ids.length, World.NODES.length);
  assert.equal(ids[0], 'kabul');
  assert.equal(ids[ids.length - 1], 'dhaka');
});

test('at the start the trail is one stop and no kos are travelled', () => {
  const trail = RouteMap.getJourneyTrail({ nodeId: 'kabul', edgeId: null, kosOnEdge: 0, phase: 'stop' });
  assert.equal(trail.stops.length, 1);
  assert.deepEqual(trail.head, RouteMap.APPROX_COORDS.kabul);
  assert.equal(trail.kosTravelled, 0);
  assert.equal(trail.isFinished, false);
});

test('mid-road the head sits part-way along the edge and kos match', () => {
  const edge = World.getOutgoingEdges('kabul')[0];
  const half = edge.kos / 2;
  const trail = RouteMap.getJourneyTrail({ nodeId: 'kabul', edgeId: edge.id, kosOnEdge: half, phase: 'road' });
  const [fromLat, fromLon] = RouteMap.APPROX_COORDS.kabul;
  const [toLat, toLon] = RouteMap.APPROX_COORDS[edge.to];
  assert.ok(Math.abs(trail.head[0] - (fromLat + toLat) / 2) < 1e-9);
  assert.ok(Math.abs(trail.head[1] - (fromLon + toLon) / 2) < 1e-9);
  assert.equal(trail.kosTravelled, Math.round(half * 10) / 10);
});

test('kos travelled counts every finished leg before the current stop', () => {
  const second = World.getOutgoingEdges('kabul')[0];
  const third = World.getOutgoingEdges(second.to)[0];
  // Standing at the stop after the second leg: first and second legs are finished.
  const trail = RouteMap.getJourneyTrail({ nodeId: third.to, edgeId: null, kosOnEdge: 0, phase: 'stop' });
  assert.equal(trail.kosTravelled, Math.round((second.kos + third.kos) * 10) / 10);
  assert.equal(trail.stops.length, 3);
});

test('a finished run has no head marker and counts all regions it passed', () => {
  const trail = RouteMap.getJourneyTrail({ nodeId: 'dhaka', edgeId: null, kosOnEdge: 0, phase: 'ended' });
  assert.equal(trail.isFinished, true);
  assert.equal(trail.stops.length, World.NODES.length);
  assert.equal(trail.regionsReached, new Set(World.NODES.map((node) => node.region)).size);
});

test('region change fires only when the stop moves into a different region', () => {
  assert.equal(RouteMap.getRegionChange('kabul', 'jalalabad').name, World.getRegion('r2').name);
  assert.equal(RouteMap.getRegionChange('attock', 'hasan_abdal'), null, 'same region r5');
  assert.equal(RouteMap.getRegionChange('panipat', 'delhi'), null, 'same region r7');
  assert.equal(RouteMap.getRegionChange('jhelum', 'gujrat').name, World.getRegion('r6').name);
  assert.equal(RouteMap.getRegionChange('kabul', 'kabul'), null);
  assert.equal(RouteMap.getRegionChange(null, 'kabul'), null);
});

test('painter draws the travelled line in red and never throws on a finished trail', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return () => ({ width: 40 });
      return (...args) => { calls.push([String(key), args]); return undefined; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  ctx.strokeStyle = '';
  const trail = RouteMap.getJourneyTrail({ nodeId: 'lahore', edgeId: null, kosOnEdge: 0, phase: 'ended' });
  assert.doesNotThrow(() => RouteMap.paintJourneyMap(ctx, trail, 640, 400));
  assert.ok(calls.some(([name]) => name === 'fillRect'), 'background painted');
  assert.ok(calls.some(([name]) => name === 'stroke'), 'lines stroked');
});
