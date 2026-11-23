(() => {
  'use strict';
  const BALANCE = Object.freeze({
    startMinute: 450, ticksPerMinute: 6, ticksPerSecond: 8,
    walkSpeed: 0.8, trainSpeed: 2.8, dwellTicks: 9, fare: 2, fareWeight: 2, startingCash: 80,
    morningSpread: 11, residentsPerHome: 3, trackCost: 12, trainCost: 36, maxFare: 99
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Near-side doors face away from the track: go around via the cross street.
  function doorPath(building, stop) {
    const door = building.entrance;
    return [door, building.y > stop.y ? { x: stop.x, y: door.y }
      : { x: door.x, y: stop.sidewalk.y }, stop.sidewalk];
  }

  // The drawn driveway meets either an east-west sidewalk or a north-south
  // cross street at its first bend. The platform is a junction, not a mandatory detour.
  function entrance(game,b) {
    const s=game.lookup.stops.get(b.stopId);
    return {point:doorPath(b,s)[1], axis:b.y>s.y?'y':'x'};
  }
  function streetPath(game,a,b) {
    const p=a.point, q=b.point, axis=a.axis, cross=axis==='x'?'y':'x';
    if (axis!==b.axis) return [p,{[axis]:q[axis],[cross]:p[cross]},q];
    if (p[cross]===q[cross]) return [p,q];
    // Two parallel streets: any crossing between the attachments is optimal;
    // otherwise use the nearest real cross street, even in another district.
    let best=Infinity, at;
    for (const stop of game.city.stops) {
      if (stop.ring>game.openRing) continue;
      const k=stop.sidewalk[axis], d=Math.abs(p[axis]-k)+Math.abs(q[axis]-k);
      if (d<best) { best=d; at=k; }
    }
    return [p,{[axis]:at,[cross]:p[cross]},{[axis]:at,[cross]:q[cross]},q];
  }
  function walkingPath(game, from, to) {
    if(game.city.study)return game.city.study.walking(from.entrance,to.entrance);
    return [from.entrance,...streetPath(game,entrance(game,from),entrance(game,to)),to.entrance];
  }
  function platformPath(game,building,stop) {
    if(game.city.study)return game.city.study.walking(building.entrance,stop.sidewalk);
    const a=entrance(game,building);
    return [building.entrance,...streetPath(game,a,{point:stop.sidewalk,axis:a.axis==='x'?'y':'x'})];
  }
  function walkLeg(points) { return { type: 'walk', points, next: 0 }; }
  function planWalk(game, resident, from, to) {
    return { mode: 'walk', legs: [walkLeg(walkingPath(game, from, to))] };
  }

  const api = { BALANCE, distance, doorPath, walkingPath, platformPath, walkLeg, planWalk };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
