(() => {
  'use strict';
  const { BALANCE, distance, platformPath, walkLeg, planWalk } =
    typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const { finalRun } = typeof module !== 'undefined' ? require('./service.js') : globalThis.LastTram;
  const ticks = points => Math.max(1,Math.ceil(points.reduce((n,p,i)=>
    n+(i ? distance(points[i-1],p) : 0),0)/BALANCE.walkSpeed));
  function exit(g,stop,building) {
    return [{x:stop.x,y:stop.y},...platformPath(g,building,stop).reverse()];
  }

  // Search actual boarding windows (including dwell) on each train's next advertised run.
  // Never offer a retiring timetable, or a train still travelling empty to its new line.
  function rides(train,from,ready) {
    const run=finalRun(train), {schedule,offset}=run, {calls,period}=schedule;
    const earliest=Math.max(ready,run.start), options=[];
    for (let i=0;i<calls.length;i++) {
      const c=calls[i];
      if (c.stopId!==from) continue;
      const begin=c.phase-offset+period*Math.ceil((earliest-c.phase+offset-BALANCE.dwellTicks)/period);
      const boardAt=Math.max(begin,earliest);
      for (let k=1;k<calls.length;k++) {
        const j=(i+k)%calls.length, next=calls[j];
        if (next.stopId===from) break;
        const alightAt=begin+next.phase-c.phase+(j<=i?period:0);
        options.push({trainId:train.id,routeId:run.routeId,from,to:next.stopId,boardAt,alightAt});
      }
    }
    return options;
  }
  function planJourney(g,resident,from,to) {
    const walk=planWalk(g,resident,from,to), walkTicks=ticks(walk.legs[0].points);
    const decision={walkTicks,fare:g.fare,farePenalty:g.fare*BALANCE.fareWeight,tramTicks:null,
      accessTicks:0,waitTicks:0,rideTicks:0,transferTicks:0,exitTicks:0,transfers:0,rides:[]};
    const labels=new Map(), pending=new Set();
    const stops=new Set(g.trains.flatMap(t=>finalRun(t).schedule.calls.map(c=>c.stopId)));
    for (const id of stops) {
      const approach=platformPath(g,from,g.lookup.stops.get(id)), at=g.tick+ticks(approach);
      labels.set(id,{at,approach,rides:[]}); pending.add(id);
    }
    let best;
    while (pending.size) {
      const id=[...pending].reduce((a,b)=>labels.get(a).at<=labels.get(b).at?a:b);
      pending.delete(id);
      const label=labels.get(id);
      for (const train of g.trains) for (const ride of rides(train,id,label.at+1)) {
        const stop=g.lookup.stops.get(ride.to), tail=exit(g,stop,to);
        const end=ride.alightAt+ticks(tail);
        const next={at:ride.alightAt,approach:label.approach,rides:[...label.rides,ride]};
        if (!best || end<best.end || (end===best.end && next.rides.length<best.rides.length))
          best={...next,end,tail};
        if (ride.alightAt < labels.get(ride.to).at) {
          labels.set(ride.to,next); pending.add(ride.to);
        }
      }
    }
    if (!best) return {...walk,decision};
    const first=best.rides[0], accessTicks=ticks(best.approach);
    Object.assign(decision,{tramTicks:best.end-g.tick,accessTicks,waitTicks:first.boardAt-g.tick-accessTicks,
      rideTicks:best.rides.reduce((n,l)=>n+l.alightAt-l.boardAt,0),
      transferTicks:best.rides.reduce((n,l,i)=>n+(i?l.boardAt-best.rides[i-1].alightAt:0),0),
      exitTicks:ticks(best.tail),transfers:best.rides.length-1,rides:best.rides});
    if (decision.tramTicks+decision.farePenalty >= walkTicks) return {...walk,decision};
    const legs=[walkLeg(best.approach)];
    for (const r of best.rides) legs.push(
      {type:'wait',stopId:r.from,trainId:r.trainId,routeId:r.routeId,boardAt:r.boardAt},
      {type:'ride',stopId:r.to,trainId:r.trainId,routeId:r.routeId,alightAt:r.alightAt});
    legs.push(walkLeg(best.tail));
    return {mode:'tram',legs,decision};
  }
  function stepTransit(g,p,j,leg) {
    const train=g.trains.find(t=>t.id===leg.trainId);
    if (leg.type==='wait') {
      if (g.tick<leg.boardAt || train.atStopId!==leg.stopId || train.routeId!==leg.routeId) return false;
      p.onTrainId=train.id; p.position={...train.position};
      if (j.paid===undefined) {
        j.boardStopId=train.atStopId;
        j.paid=j.decision.fare;
        g.cash+=j.paid; g.fareIncome+=j.paid;
        const ticket={tick:g.tick,amount:j.paid,residentId:p.id,trainId:train.id,
          routeId:train.routeId,originId:j.originId,destinationId:j.destinationId};
        g.history.recordFare(ticket);
        g.systems.onFare?.(g,p,ticket);
      }
      return true;
    }
    p.position={...train.position};
    if (g.tick<leg.alightAt || train.atStopId!==leg.stopId) return false;
    p.onTrainId=null;
    return true;
  }
  const api={planJourney,stepTransit};
  Object.assign(globalThis.LastTram ??= {},api);
  if (typeof module!=='undefined') module.exports=api;
})();
