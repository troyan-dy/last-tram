const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance, depart } = require('../game/simulation.js');
const network = require('../game/service.js');

const start = systems => startGame(createCity('Ива'), { demand() {}, ...systems });
const edge = (g, a, b) => g.city.edges.find(e => [e.a, e.b].includes(a) && [e.a, e.b].includes(b)).id;

test('buying a track opens no service; unavailable, duplicate and unaffordable purchases are atomic', () => {
  const g = start(), [a] = g.city.starterStops;
  const link = edge(g, a, 's:1:1'), closed = edge(g, a, 's:0:2');
  const before = g.cash, original = structuredClone(g.routes[0].stopIds);
  assert.equal(network.buildTrack(g, closed).ok, false);
  assert.equal(g.cash, before);
  assert.equal(network.buildTrack(g, link).ok, true);
  assert.ok(g.cash < before && g.trackIds.has(link));
  const paid = g.cash;
  assert.equal(network.buildTrack(g, link).ok, false);
  assert.equal(g.cash, paid);
  assert.deepEqual(g.routes[0].stopIds, original);
  g.cash = 0;
  const other = edge(g, 's:1:1', 's:2:1');
  assert.equal(network.buildTrack(g, other).ok, false);
  assert.equal(g.trackIds.has(other), false);
  assert.equal(g.cash, 0);
});
