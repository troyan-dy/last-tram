(() => {
  'use strict';
  const { BALANCE, distance } = typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const fail = message => ({ ok: false, message });
  const open = (g, id) => g.lookup.stops.get(id)?.ring <= g.openRing;

  function buildTrack(g, edgeId) {
    const e = g.lookup.edges.get(edgeId);
    if (!e || !open(g, e.a) || !open(g, e.b)) return fail('Участок вне зоны обслуживания.');
    if (g.trackIds.has(edgeId)) return fail('Путь уже построен.');
    if (g.cash < BALANCE.trackCost) return fail('Недостаточно денег на путь.');
    g.cash -= BALANCE.trackCost;
    g.trackIds.add(edgeId);
    return { ok: true };
  }

  // Shortest physical path over purchased edges, independently of the stops a line calls at.
  function railPath(g, a, b, excluded) {
    const pending = new Set([a]), costs = new Map([[a, 0]]), prev = new Map();
    while (pending.size) {
      const here = [...pending].reduce((x,y) => costs.get(x) <= costs.get(y) ? x : y);
      pending.delete(here);
      if (here === b) {
        const path = [b];
        while (path[0] !== a) path.unshift(prev.get(path[0]));
        return path;
      }
      for (const id of g.trackIds) {
        if (excluded?.has(id)) continue;
        const e = g.lookup.edges.get(id), next = e.a === here ? e.b : e.b === here ? e.a : null;
        if (!next) continue;
        const cost = costs.get(here) + distance(g.lookup.stops.get(here), g.lookup.stops.get(next));
        if (cost >= (costs.get(next) ?? Infinity)) continue;
        costs.set(next, cost); prev.set(next, here); pending.add(next);
      }
    }
    return null;
  }

  const xy = ({x,y}) => ({x,y});
  const trackAxis = (from,to) => Math.abs(to.y-from.y) > Math.abs(to.x-from.x) ? 'y' : 'x';
  function segment(frames, a, b, from, to, includeEnd) {
    const n = Math.ceil(distance(from, to) / BALANCE.trainSpeed);
    const axis = trackAxis(from,to);
    for (let k = 1; k <= n - Number(!includeEnd); k++) {
      frames.push({ a, b, axis, atStopId: null, position: {
        x: from.x + (to.x-from.x)*k/n, y: from.y + (to.y-from.y)*k/n } });
    }
  }

  // A closed service needs a real return track rather than the shuttle's reversed path.
  function loopPaths(g, stops) {
    if (stops.length<3 || new Set(stops).size!==stops.length) return null;
    const paths=[], used=new Set();
    for (let i=0;i<stops.length;i++) {
      const path=railPath(g,stops[i],stops[(i+1)%stops.length],used);
      if (!path) return null;
      for (let j=1;j<path.length;j++) {
        const a=path[j-1], b=path[j];
        used.add(g.city.edges.find(e=>(e.a===a && e.b===b)||(e.a===b && e.b===a)).id);
      }
      paths.push(path);
    }
    return paths;
  }
  function timetable(g, stops, loop=false) {
    if (!Array.isArray(stops) || stops.length < 2 || new Set(stops).size !== stops.length
      || !stops.every(s => open(g,s))) return null;
    const paths = [];
    for (let i=1; i<stops.length; i++) {
      const path = railPath(g, stops[i-1], stops[i]);
      if (!path) return null;
      paths.push(path);
    }
    const frames = [], calls = [];
    const trips = loop ? loopPaths(g,stops) : [...paths, ...paths.slice().reverse().map(p => [...p].reverse())];
    if (!trips) return null;
    for (const [i,path] of trips.entries()) {
      const id = path[0], direction = loop || i < paths.length ? 1 : -1;
      const incoming = trips[(i+trips.length-1)%trips.length];
      const axis = trackAxis(g.lookup.stops.get(incoming.at(-2)), g.lookup.stops.get(id));
      calls.push({ stopId: id, phase: frames.length, direction });
      for (let dwell = BALANCE.dwellTicks; dwell >= 0; dwell--)
        frames.push({ a:id, b:id, axis, position:xy(g.lookup.stops.get(id)), atStopId:id, dwell, direction });
      for (let j=1; j<path.length; j++) {
        const a=path[j-1], b=path[j];
        segment(frames, a, b, g.lookup.stops.get(a), g.lookup.stops.get(b), j < path.length-1);
      }
    }
    return { frames, calls, period: frames.length };
  }
  const mod = (v,n) => ((v%n)+n)%n;
  const routeOf = (g,id) => g.routes.find(r => r.id === id);
  const name = (label, n) => `${label} ${String(n).padStart(2,'0')}`;
  function createRoute(g, stopIds, loop=false) {
    const schedule = timetable(g, stopIds, loop);
    if (!schedule) return fail('Нужны разные остановки, соединённые построенными путями.');
    const n = g.routes.length+1, id = `line-${n}`;
    g.routes.push({ id, name:name('Линия',n), stopIds:[...stopIds], ...(loop?{loop:true}:{}), schedule, anchor:-g.tick });
    return { ok:true, routeId:id };
  }
  function setStops(g, id, stopIds, loop=false) {
    const r = routeOf(g,id), schedule = timetable(g,stopIds,loop);
    if (!r || !schedule) return fail('Остановки должны быть соединены путями и не повторяться.');
    if (r.stopIds.join() === stopIds.join() && !!r.loop===loop) return { ok:true };
    if (fleet(g,r).some(t=>!attachment(g,stateAt(t,releaseTick(g,t)),{schedule})))
      return fail('Нет пути для перегона поезда.');
    r.stopIds = [...stopIds]; r.loop=loop; r.schedule = schedule; r.anchor=-g.tick;
    distribute(g,r);
    return { ok:true };
  }
  const finalRun = t => t.runs.at(-1);
  function operatingStops(g) {
    const result=new Map();
    for (const t of g.trains) {
      const run=t.runs.findLast(s=>s.start<=g.tick);
      for (const call of run.schedule?.calls??[]) {
        if (!result.has(call.stopId)) result.set(call.stopId,new Set());
        result.get(call.stopId).add(run.routeId);
      }
    }
    return result;
  }
  function stateAt(t,tick) {
    const run = t.runs.findLast(s => s.start<=tick);
    const f = run.schedule ? run.schedule.frames[mod(tick+run.offset,run.schedule.period)]
      : run.frames[tick-run.start];
    return { ...f, routeId:run.routeId, direction:f.direction??null, dwell:f.dwell??0 };
  }
  function sample(g,t) {
    Object.assign(t,stateAt(t,g.tick));
  }
  function addTrain(g,r,offset) {
    const n=g.trains.length+1, id=`train-${n}`;
    const train={ id, name:name('Поезд',n), assignedRouteId:r.id, cars:1,
      runs:[{ routeId:r.id, schedule:r.schedule, offset, start:g.tick }] };
    g.trains.push(train);
    sample(g,train);
    return id;
  }
  // Keep every promised ride, including a future transfer, then move empty over real track.
  // Only the last run is offered to new passengers. Earlier runs serve existing tickets.
  function releaseTick(g,t) {
    let tick=g.tick;
    for (const p of g.residents) {
      const j=p.journey;
      if (j) for (const leg of j.legs.slice(j.leg))
        if (leg.type==='ride' && leg.trainId===t.id) tick=Math.max(tick,leg.alightAt);
    }
    return tick;
  }
  function attachment(g,f,r) {
    let best;
    for (const end of new Set([f.a,f.b])) {
      for (const call of r.schedule.calls) {
        const path=railPath(g,end,call.stopId);
        if (!path) continue;
        let cost=distance(f.position,g.lookup.stops.get(end));
        for (let i=1;i<path.length;i++) cost+=distance(g.lookup.stops.get(path[i-1]),g.lookup.stops.get(path[i]));
        if (!best || cost < best.cost) best={cost,path,call};
      }
    }
    return best;
  }
  function retime(g,t,r,offset) {
    const last=finalRun(t);
    if (last.schedule===r.schedule && mod(last.offset-offset,r.schedule.period)===0) return;
    const cut=releaseTick(g,t), f=stateAt(t,cut);
    const {path,call}=attachment(g,f,r);
    const frames=[], first=path[0], start=g.lookup.stops.get(first);
    segment(frames, first===f.a?f.b:f.a, first, f.position,start,true);
    for (let i=1;i<path.length;i++)
      segment(frames,path[i-1],path[i],g.lookup.stops.get(path[i-1]),g.lookup.stops.get(path[i]),true);
    const stop=call.stopId, position=xy(g.lookup.stops.get(stop));
    const earliest=cut+1+frames.length;
    const hold=mod(call.phase-offset-earliest,r.schedule.period);
    const axis = frames.at(-1)?.axis ?? f.axis;
    for (let k=0;k<hold;k++) frames.push({a:stop,b:stop,axis,position,atStopId:null});
    t.runs=t.runs.filter(run=>run.start<=cut);
    if (frames.length) t.runs.push({start:cut+1,frames,routeId:null});
    t.runs.push({start:earliest+hold,schedule:r.schedule,offset,routeId:r.id});
  }
  const fleet = (g,r) => g.trains.filter(t => t.assignedRouteId===r.id);
  const slot = (r,i,total) => r.anchor+Math.floor(i*r.schedule.period/total);
  function distribute(g,r) {
    const trains=fleet(g,r);
    trains.forEach((t,i)=>retime(g,t,r,slot(r,i,trains.length)));
  }
  function buyTrain(g,id) {
    const r=routeOf(g,id);
    if (!r) return fail('Выберите маршрут.');
    if (g.cash < BALANCE.trainCost) return fail('Недостаточно денег на поезд.');
    g.cash -= BALANCE.trainCost;
    const n=fleet(g,r).length, trainId=addTrain(g,r,slot(r,n,n+1));
    distribute(g,r);
    return { ok:true, trainId };
  }
  function assignTrain(g,trainId,routeId) {
    const t=g.trains.find(t=>t.id===trainId), r=routeOf(g,routeId);
    if (!t || !r) return fail('Выберите поезд и маршрут.');
    if (t.assignedRouteId===r.id) return {ok:true};
    if (!attachment(g,stateAt(t,releaseTick(g,t)),r)) return fail('Нет пути для перегона поезда.');
    const old=routeOf(g,t.assignedRouteId);
    t.assignedRouteId=r.id;
    distribute(g,old); distribute(g,r);
    return {ok:true};
  }
  function openLine(g) {
    const stops = g.city.starterStops;
    for (let i=1; i<stops.length; i++) {
      const a=stops[i-1], b=stops[i];
      g.trackIds.add(g.city.edges.find(e => (e.a===a && e.b===b) || (e.b===a && e.a===b)).id);
    }
    createRoute(g, stops);
    const r=g.routes[0];
    r.anchor=r.schedule.calls.find(c => c.stopId===stops.at(-1)).phase + BALANCE.dwellTicks;
    addTrain(g, r, r.anchor);
  }
  function moveTrains(g) {
    for (const t of g.trains) {
      while (t.runs.length>1 && t.runs[1].start<=g.tick) t.runs.shift();
      sample(g,t);
    }
  }
  function setFare(g,value) {
    if (!Number.isSafeInteger(value) || value<0 || value>BALANCE.maxFare)
      return fail(`Тариф — от 0 до ${BALANCE.maxFare} ₽.`);
    g.fare=value;
    return {ok:true};
  }
  const api = { buildTrack, railPath, loopPaths, createRoute, setStops, buyTrain, assignTrain, setFare, openLine, moveTrains, finalRun, operatingStops };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
