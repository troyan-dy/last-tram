// The opening shuttle uses the same tracks, stops and vehicles exposed to later service commands.
(() => {
  'use strict';
  const { BALANCE, distance, doorPath, walkLeg, planWalk } =
    typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const lengthOf = points => points.reduce((sum, p, i) => i ? sum + distance(points[i - 1], p) : 0, 0);

  function openLine(game) {
    const stopIds = [...game.city.starterStops];
    const route = { id: 'line-1', name: 'Линия 01', stopIds };
    game.routes.push(route);
    for (let i = 1; i < stopIds.length; i++) {
      const edge = game.city.edges.find(e => e.a === stopIds[i - 1] && e.b === stopIds[i]);
      game.trackIds.add(edge.id);
    }
    const index = stopIds.length - 1, start = game.lookup.stops.get(stopIds[index]);
    game.trains.push({ id: 'train-1', routeId: route.id, cars: 1, position: { x: start.x, y: start.y },
      index, direction: -1, dwell: 0, atStopId: null });
  }

  function moveTrains(game) {
    for (const t of game.trains) {
      const route = game.routes.find(r => r.id === t.routeId);
      if (!route || route.stopIds.length < 2) continue;
      if (t.dwell > 0) { t.dwell--; continue; }
      t.atStopId = null;
      const next = t.index + t.direction, stop = game.lookup.stops.get(route.stopIds[next]);
      const d = distance(t.position, stop);
      if (d <= BALANCE.trainSpeed) {
        t.position = { x: stop.x, y: stop.y };
        t.index = next;
        t.atStopId = stop.id;
        t.dwell = BALANCE.dwellTicks;
        if (!next || next === route.stopIds.length - 1) t.direction *= -1;
      } else {
        t.position = { x: t.position.x + (stop.x - t.position.x) * BALANCE.trainSpeed / d,
          y: t.position.y + (stop.y - t.position.y) * BALANCE.trainSpeed / d };
      }
    }
  }

  function planMorning(game, r, from, to) {
    const walk = planWalk(game, r, from, to);
    const walkTicks = lengthOf(walk.legs[0].points) / BALANCE.walkSpeed;
    const route = game.routes[0];
    const fleet = game.trains.filter(t => t.routeId === route?.id);
    if (!fleet.length) return walk;
    const a = route.stopIds.indexOf(from.stopId), b = route.stopIds.indexOf(to.stopId);
    if (a < 0 || b < 0 || a === b) return walk;
    const stops = route.stopIds.map(id => game.lookup.stops.get(id));
    const approach = doorPath(from, stops[a]), exit = doorPath(to, stops[b]).reverse();
    const wait = (lengthOf(stops) / BALANCE.trainSpeed + (stops.length - 1) * BALANCE.dwellTicks) / fleet.length;
    const ride = lengthOf(stops.slice(Math.min(a, b), Math.max(a, b) + 1)) / BALANCE.trainSpeed
      + (Math.abs(b - a) - 1) * BALANCE.dwellTicks;
    const total = (lengthOf(approach) + lengthOf(exit)) / BALANCE.walkSpeed + wait + ride;
    if (total + game.fare * BALANCE.fareWeight >= walkTicks) return walk;
    return { mode: 'tram', legs: [walkLeg(approach),
      { type: 'wait', routeId: route.id, stopId: from.stopId, direction: Math.sign(b - a) },
      { type: 'ride', stopId: to.stopId }, walkLeg(exit)] };
  }

  function stepTransit(game, r, journey, leg) {
    if (leg.type === 'wait') {
      const train = game.trains.find(t => t.routeId === leg.routeId && t.atStopId === leg.stopId
        && t.direction === leg.direction);
      if (!train) return false;
      r.onTrainId = train.id;
      r.position = { ...train.position };
      game.cash += game.fare;
      return true;
    }
    const t = game.trains.find(t => t.id === r.onTrainId);
    r.position = { ...t.position };
    if (t.atStopId !== leg.stopId) return false;
    r.onTrainId = null;
    return true;
  }

  const api = { openLine, moveTrains, planMorning, stepTransit };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
