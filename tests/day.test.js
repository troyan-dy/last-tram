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

test('a wait across midnight keeps its original journey and gets no duplicate or expired appointment', () => {
  const trips = [];
  const game = startGame(createCity('Ива'), {
    onArrival(g, person, trip) { if (person === g.residents[0]) trips.push(trip); }
  });
  const r = game.residents[0], service = game.systems.service;
  // Keep the real shuttle at its initial location, far from this passenger's platform.
  game.systems.service = () => {};
  until(game, 10 * 60);
  const outbound = r.journey, platform = { ...r.position };
  assert.equal(outbound.legs[outbound.leg].type, 'wait');
  until(game, 24 * 60);
  assert.equal(r.journey, outbound);
  assert.deepEqual(r.position, platform);
  assert.equal(r.currentBuildingId, null);
  assert.equal(trips.length, 0);
  game.systems.service = service;
  until(game, 24 * 60 + 11 * 60);
  assert.deepEqual(trips.map(a => [a.startedAt, a.originId, a.destinationId]), [
    [outbound.startedAt, r.homeId, r.workId]
  ]);
  assert.equal(r.currentBuildingId, r.workId);
});

test('opening the ring at noon starts local daytime visits from home, never a replay of the morning', () => {
  const game = startGame(createCity('Клён'));
  const outside = game.residents.filter(r => game.lookup.buildings.get(r.homeId).ring === 1);
  until(game, 12 * 60);
  assert.ok(outside.length > 0 && outside.every(r => r.currentBuildingId === r.homeId && !r.lastJourney));
  game.openRing = 1;
  until(game, 17 * 60 + 20);
  const visitors = outside.filter(r => r.lastJourney);
  assert.ok(visitors.length > 0 && visitors.length < outside.length);
  for (const r of visitors) {
    assert.equal(r.lastJourney.originId, r.homeId);
    assert.notEqual(r.currentBuildingId, r.workId);
    assert.deepEqual(r.position, game.lookup.buildings.get(r.lastJourney.destinationId).entrance);
  }
  until(game, 24 * 60);
  assert.ok(outside.every(r => r.currentBuildingId === r.homeId && !r.journey));
  until(game, 24 * 60 + 11 * 60 + 59);
  assert.ok(outside.every(r => r.currentBuildingId === r.workId));
});

test('single ticks and accelerated batches record identical journeys, fleet and fares through midnight', () => {
  const play = (singleSteps) => {
    const arrivals = [];
    const game = startGame(createCity('Ива'), {
      onArrival(g, r, trip) { arrivals.push([r.id, g.tick, trip]); }
    });
    const runTo = minute => {
      if (singleSteps) while (clockMinute(game) < minute) advance(game);
      else until(game, minute);
    };
    runTo(24 * 60); // Activate residents right on the boundary between days.
    game.openRing = 1;
    runTo(24 * 60 + 11 * 60 + 59);
    assert.ok(game.residents.filter(r => game.lookup.buildings.get(r.homeId).ring === 1)
      .every(r => r.currentBuildingId === r.workId && r.lastJourney.originId === r.homeId));
    return { tick: game.tick, minute: clockMinute(game), cash: game.cash, fleet: game.trains, residents: game.residents, arrivals };
  };
  assert.deepEqual(play(true), play(false));
});
