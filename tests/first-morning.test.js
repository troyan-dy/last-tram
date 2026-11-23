const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');

test('a city seed restores the same districts and doors, including the unopened streets', () => {
  const city = createCity('Клён');
  assert.deepEqual(createCity('Клён'), city);
  const doors = (c, ring) => c.buildings.filter(b => b.ring === ring).map(b => b.entrance);
  for (const ring of [0, 1]) {
    assert.ok(doors(city, ring).length > 1);
    assert.notDeepEqual(doors(createCity('Ива'), ring), doors(city, ring));
  }
  assert.equal(new Set(city.buildings.map(b => b.id)).size, city.buildings.length);
  for (const b of city.buildings) {
    assert.ok(city.districts.some(d => d.id === b.districtId && d.ring === b.ring));
    assert.ok(city.stops.some(s => s.id === b.stopId && s.districtId === b.districtId));
  }
  const neighbors = new Map(city.stops.map(s => [s.id, []]));
  for (const { a, b } of city.edges) {
    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
  }
  const seen = new Set([city.stops.find(s => !s.ring).id]);
  for (const id of seen) for (const next of neighbors.get(id)) seen.add(next);
  assert.equal(seen.size, city.stops.length, 'future neighborhoods connect to the center');
});

test('without service a resident physically walks from the home door to the work door once', () => {
  const { startGame, advance, BALANCE } = require('../game/simulation.js');
  const game = startGame(createCity('Клён'));
  game.trains.length = 0;
  const person = game.residents[0];
  const { id, homeId, workId } = person;
  const from = game.city.buildings.find(b => b.id === homeId);
  const to = game.city.buildings.find(b => b.id === workId);
  assert.notEqual(homeId, workId);
  assert.deepEqual(person.position, from.entrance);
  let tookSteps = 0, started = false;
  for (let tick = 0; tick < 2000 && person.currentBuildingId !== workId; tick++) {
    const before = { ...person.position };
    advance(game, 1);
    const distance = Math.hypot(before.x - person.position.x, before.y - person.position.y);
    assert.ok(distance <= BALANCE.walkSpeed + 1e-8, 'no teleport at departure or arrival');
    if (distance) tookSteps++;
    if (person.journey) {
      started = true;
      assert.equal(person.currentBuildingId, null);
      assert.equal(person.journey.mode, 'walk');
      assert.equal(person.journey.destinationId, workId);
    }
  }
  assert.ok(started && tookSteps > 10);
  assert.deepEqual(person.position, to.entrance);
  assert.equal(person.currentBuildingId, workId);
  advance(game, 650);
  assert.deepEqual([person.id, person.homeId, person.workId, person.currentBuildingId], [id, homeId, workId, workId]);
});

test('the morning line carries a real resident to the far stop, then they walk to the work entrance', () => {
  const { startGame, advance, clockMinute } = require('../game/simulation.js');
  const game = startGame(createCity('Ива'));
  const minute = clockMinute(game), cash = game.cash;
  const a = game.residents[0];
  const train = game.trains[0];
  assert.ok(train && game.routes.some(r => r.id === train.routeId));
  let rode = false, walkedAfterRide = false;
  for (let t = 0; t < 900 && !a.lastJourney; t++) {
    const prev = { ...train.position };
    advance(game, 1);
    const j = a.journey;
    if (!j) continue;
    assert.equal(j.mode, 'tram', 'door-to-door choice remains stable');
    if (j.legs[j.leg].type === 'ride' && a.onTrainId === train.id) {
      assert.deepEqual(a.position, train.position);
      if (Math.hypot(prev.x - train.position.x, prev.y - train.position.y) > 0) rode = true;
    }
    if (rode && !a.onTrainId && j.legs[j.leg].type === 'walk') {
      walkedAfterRide = true;
      assert.equal(a.currentBuildingId, null);
    }
  }
  assert.ok(rode && walkedAfterRide);
  assert.equal(a.currentBuildingId, a.workId);
  assert.deepEqual(a.position, game.lookup.buildings.get(a.workId).entrance);
  assert.equal(a.lastJourney.mode, 'tram');
  assert.ok(game.cash >= cash + game.fare);
  assert.ok(clockMinute(game) > minute);
});

test('a new demand policy can send the same resident onward from their actual door', () => {
  const { startGame, advance, depart } = require('../game/simulation.js');
  const { planWalk } = require('../game/movement.js');
  const arrivals = [];
  const game = startGame(createCity('Клён'), { planJourney: planWalk, demand() {},
    onArrival(g, resident, trip) { arrivals.push({ id: resident.id, ...trip }); } });
  const r = game.residents[0];
  assert.ok(depart(game, r, r.workId));
  assert.equal(depart(game, r, r.homeId), false);
  advance(game, 900);
  assert.ok(depart(game, r, r.homeId));
  advance(game, 900);
  assert.deepEqual(arrivals.map(a => [a.id, a.originId, a.destinationId]), [
    [r.id, r.homeId, r.workId], [r.id, r.workId, r.homeId]
  ]);
  assert.deepEqual(r.position, game.lookup.buildings.get(r.homeId).entrance);
});
