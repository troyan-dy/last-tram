const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance, clockMinute, BALANCE } = require('../game/simulation.js');

function until(game, absoluteMinute) {
  advance(game, (absoluteMinute - BALANCE.startMinute) * BALANCE.ticksPerMinute - game.tick);
}

test('the same commuter goes to work, visits another place, returns from that door and chooses again tomorrow', () => {
  const arrivals = [];
  const game = startGame(createCity('Ива'), {
    onArrival(g, resident, trip) {
      if (resident === g.residents[0]) arrivals.push({ ...trip, id: resident.id, position: { ...resident.position } });
    }
  });
  const r = game.residents[0], { homeId, workId, id } = r;
  until(game, 11 * 60);
  assert.equal(r.currentBuildingId, workId);
  assert.equal(arrivals[0].mode, 'tram');
  until(game, 17 * 60);
  const visit = r.currentBuildingId;
  assert.ok(visit && visit !== homeId && visit !== workId, 'arrived at a third door during off-peak hours');
  until(game, 23 * 60);
  assert.equal(r.currentBuildingId, homeId);
  game.fare = 1000;
  until(game, 24 * 60 + 11 * 60);
  assert.deepEqual(arrivals.map(a => [a.id, a.originId, a.destinationId]), [
    [id, homeId, workId], [id, workId, visit], [id, visit, homeId], [id, homeId, workId]
  ]);
  assert.equal(arrivals.at(-1).mode, 'walk', 'same commute, a new door-to-door choice');
  for (const a of arrivals) assert.deepEqual(a.position, game.lookup.buildings.get(a.destinationId).entrance);
  assert.deepEqual([r.id, r.homeId, r.workId], [id, homeId, workId]);
});
