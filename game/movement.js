(() => {
  'use strict';
  const BALANCE = Object.freeze({
    startMinute: 450, ticksPerMinute: 6, ticksPerSecond: 8,
    walkSpeed: 0.8, trainSpeed: 2.8, dwellTicks: 9, fare: 2, fareWeight: 2, startingCash: 80,
    morningSpread: 11, residentsPerHome: 3
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Near-side doors face away from the track: go around via the cross street.
  function doorPath(building, stop) {
    const door = building.entrance;
    return [door, building.y > stop.y ? { x: stop.x, y: door.y }
      : { x: door.x, y: stop.sidewalk.y }, stop.sidewalk];
  }

  function walkingPath(game, from, to) {
    const a = game.lookup.stops.get(from.stopId), b = game.lookup.stops.get(to.stopId);
    return [...doorPath(from, a), { x: b.x, y: a.sidewalk.y }, ...doorPath(to, b).reverse()];
  }
  function walkLeg(points) { return { type: 'walk', points, next: 0 }; }
  function planWalk(game, resident, from, to) {
    return { mode: 'walk', legs: [walkLeg(walkingPath(game, from, to))] };
  }

  const api = { BALANCE, distance, doorPath, walkingPath, walkLeg, planWalk };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
