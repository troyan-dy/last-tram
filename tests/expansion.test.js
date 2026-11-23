const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance } = require('../game/simulation.js');
const { setFare, buyTrain, buildTrack, setStops, createRoute } = require('../game/service.js');
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

test('three completed tram trips can earn the right with free tickets; boardings do not', () => {
  const events = [];
  const g = startGame(createCity('Клён'), {
    onArrival(game, resident, trip) { events.push({ id: resident.id, ...trip }); }
  });
  assert.ok(setFare(g, 0).ok);
  until(g, () => g.residents.some(r => r.onTrainId), 500);
  assert.equal(expansionStatus(g).centralTrips, 0);
  assert.equal(buyRing(g).ok, false);
  until(g, () => events.filter(j => j.mode === 'tram').length === 2, 1000);
  assert.equal(expansionStatus(g).centralTrips, 2);
  assert.equal(buyRing(g).ok, false);
  until(g, () => events.filter(j => j.mode === 'tram').length >= 3, 1000);
  assert.equal(g.fareIncome, 0);
  assert.equal(g.openRing, 0, 'promotion alone does not open the map');
  assert.ok(buyRing(g).ok);
  assert.equal(g.cash, 0);
});

test('one purchase opens all four sides of the original city while the built service and its passengers continue', () => {
  const events = [];
  const g = startGame(createCity('Клён'), {
    onFare(game, r, event) { events.push(event); },
    onArrival(game, r, trip) { events.push(trip); }
  });
  const savedCity = structuredClone(g.city);
  const addresses = [...g.city.buildings];
  assert.ok(buildTrack(g, 's:3:1/s:3:2').ok);
  const { routeId } = createRoute(g, ['s:1:2', 's:3:1']);
  assert.ok(buyTrain(g, routeId).ok);
  assert.ok(setFare(g, 8).ok);
  until(g, () => expansionStatus(g).canBuy && g.residents.some(r => r.onTrainId), 3600);
  const riding = g.residents.filter(r => r.onTrainId).map(r => ({
    r, dest: r.journey.destinationId, eta: r.journey.startedAt + r.journey.decision.tramTicks
  }));
  const before = () => structuredClone([g.tick, g.trackIds, g.routes, g.trains, g.residents, g.fareIncome, events]);
  const state = before();
  const bounds = () => {
    const visible = g.city.stops.filter(s => s.ring <= g.openRing);
    return ['x','y'].flatMap(k => [Math.min(...visible.map(s => s[k])), Math.max(...visible.map(s => s[k]))]);
  };
  const [w,e,n,s] = bounds();
  assert.ok(buyRing(g).ok);
  assert.deepEqual(before(), state);
  assert.deepEqual(g.city, savedCity);
  assert.ok(addresses.every(b => g.lookup.buildings.get(b.id) === b));
  const [ww,ee,nn,ss] = bounds();
  assert.ok(ww < w && ee > e && nn < n && ss > s);
  for (const {r,dest,eta} of riding.sort((a,b) => a.eta - b.eta)) {
    advance(g, eta - g.tick);
    assert.equal(r.currentBuildingId, dest);
    assert.deepEqual(r.position, g.lookup.buildings.get(dest).entrance);
    assert.equal(r.lastJourney.arrivedAt, eta);
  }
});

for (const service of ['existing tracks only', 'extend the line east', 'build a west feeder']) {
  test(`ring goal at the destination door: ${service}`, () => {
    const g = start();
    assert.ok(setFare(g, 6).ok);
    advance(g, 1620); // noon; same seed, money, clock and residents for all three choices
    assert.ok(buyRing(g).ok);
    assert.ok(setFare(g, 2).ok);
    const west = service === 'build a west feeder';
    if (west) {
      assert.ok(buildTrack(g, 's:0:2/s:1:2').ok);
      const { routeId } = createRoute(g, ['s:0:2','s:1:2']);
      assert.ok(buyTrain(g, routeId).ok);
    } else if (service === 'extend the line east') {
      assert.ok(buildTrack(g, 's:3:2/s:4:2').ok);
      assert.ok(setStops(g, 'line-1', [...g.city.starterStops, 's:4:2']).ok);
    }
    const p = g.residents.find(r => r.id === (west ? 'p:b:0:3:2:0' : 'p:b:4:2:2:0'));
    const destination = west ? 'b:3:2:1' : 'b:1:2:1';
    until(g, () => p.onTrainId, 3600);
    const stop = g.trains.find(t => t.id === p.onTrainId).atStopId;
    assert.equal(expansionStatus(g).ringTrips, 0, 'the ticket does not complete the goal');
    until(g, () => !p.onTrainId && p.journey?.legs[p.journey.leg].type === 'walk', 3600);
    assert.equal(expansionStatus(g).ringTrips, 0, 'getting off is still short of the door');
    until(g, () => p.currentBuildingId === destination, 3600);
    assert.deepEqual(p.position, g.lookup.buildings.get(destination).entrance);
    assert.equal(p.lastJourney.originId, p.homeId);
    assert.equal(p.lastJourney.mode, 'tram');
    const status = expansionStatus(g);
    if (service === 'existing tracks only') {
      assert.equal(g.lookup.stops.get(stop).ring, 0, 'Mark walked into the old zone to board');
      assert.equal(p.lastJourney.arrivedAt, 2642);
      assert.equal(status.ringTrips, 0);
      assert.equal(status.firstLink, null);
    } else {
      assert.equal(g.lookup.stops.get(stop).ring, 1);
      assert.equal(status.ringTrips, 1);
      const j = p.lastJourney;
      assert.deepEqual(status.firstLink, { residentId: p.id, originId: p.homeId, destinationId: destination,
        boardStopId: stop, arrivedAt: g.tick, savedTicks: j.decision.walkTicks - (g.tick - j.startedAt) });
      assert.ok(status.firstLink.savedTicks > 0);
      if (west) assert.equal(j.decision.transfers, 1);
      else {
        assert.ok(j.arrivedAt < 2642, 'the new stop really improved Mark’s journey');
        advance(g, 5040 - g.tick);
        assert.equal(p.currentBuildingId, p.homeId);
        assert.equal(p.lastJourney.mode, 'tram');
        assert.equal(p.lastJourney.originId, destination, 'Mark actually returned from the atelier');
        assert.equal(expansionStatus(g).ringTrips, 1, 'his home is in the ring but the return trip started in the center');
        assert.deepEqual(expansionStatus(g).firstLink, status.firstLink);
      }
    }
  });
}
