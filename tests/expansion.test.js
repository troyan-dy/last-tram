const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance } = require('../game/simulation.js');
const { setFare, buyTrain } = require('../game/service.js');
const { buyRing, expansionStatus } = require('../game/expansion.js');

const start = () => startGame(createCity('Клён'));
function until(game, predicate, limit) {
  while (!predicate() && game.tick < limit) advance(game);
  assert.ok(predicate(), `condition not reached by tick ${limit}`);
}

test('the player needs both a promotion and the price; the same ring cannot be sold twice', () => {
  const g = start();
  assert.equal(g.cash, 80);
  assert.match(buyRing(g).message, /цель/i);
  assert.deepEqual([g.cash, g.openRing], [80, 0]);

  // Earn the revenue alternative with an actual ticket, before anyone finishes by tram.
  assert.ok(setFare(g, 16).ok);
  until(g, () => g.fareIncome >= 16, 500);
  assert.equal(g.residents.some(r => r.lastJourney?.mode === 'tram'), false);
  assert.ok(expansionStatus(g).canBuy);
  assert.ok(buyTrain(g, g.routes[0].id).ok);
  assert.ok(buyTrain(g, g.routes[0].id).ok);
  const cash = g.cash;
  assert.ok(cash < 80);
  assert.match(buyRing(g).message, /не хватает/i);
  assert.deepEqual([g.cash, g.openRing], [cash, 0]);

  until(g, () => g.cash >= 80, 1620);
  const before = g.cash, gross = g.fareIncome;
  assert.ok(expansionStatus(g).canBuy);
  assert.deepEqual(buyRing(g), { ok: true });
  assert.equal(g.openRing, 1);
  assert.equal(g.cash, before - 80);
  assert.match(buyRing(g).message, /открыт/i);
  assert.deepEqual([g.cash, g.fareIncome, g.openRing], [before - 80, gross, 1]);
});
