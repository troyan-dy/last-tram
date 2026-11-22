const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance, depart } = require('../game/simulation.js');
const network = require('../game/service.js');

const start = systems => startGame(createCity('Ива'), { demand() {}, ...systems });
const edge = (g, a, b) => g.city.edges.find(e => [e.a, e.b].includes(a) && [e.a, e.b].includes(b)).id;

test('buying a track opens no service; unavailable, duplicate and unaffordable purchases are atomic', () => {
  const g = start(), [a] = g.city.starterStops;
  const link = edge(g, a, 's:1:1'), closed = edge(g, a, 's:0:2');
  const before = g.cash, original = structuredClone(g.routes[0].stopIds);
  assert.equal(network.buildTrack(g, closed).ok, false);
  assert.equal(g.cash, before);
  assert.equal(network.buildTrack(g, link).ok, true);
  assert.ok(g.cash < before && g.trackIds.has(link));
  const paid = g.cash;
  assert.equal(network.buildTrack(g, link).ok, false);
  assert.equal(g.cash, paid);
  assert.deepEqual(g.routes[0].stopIds, original);
  g.cash = 0;
  const other = edge(g, 's:1:1', 's:2:1');
  assert.equal(network.buildTrack(g, other).ok, false);
  assert.equal(g.trackIds.has(other), false);
  assert.equal(g.cash, 0);
});

test('two distinct routes share a curved path; an express traverses its intermediate track junction without calling', () => {
  const g = start(), [a, b, c] = g.city.starterStops, d = 's:3:1';
  assert.ok(network.buildTrack(g, edge(g, c, d)).ok);
  const cash = g.cash, tracks = [...g.trackIds];
  const result = network.createRoute(g, [a, d]);
  assert.ok(result.ok);
  assert.notEqual(result.routeId, g.routes[0].id);
  assert.equal(g.cash, cash);
  assert.deepEqual([...g.trackIds], tracks);
  assert.equal(network.setStops(g, result.routeId, [a, 's:2:1']).ok, false);
  const bought = network.buyTrain(g, result.routeId);
  assert.ok(bought.ok);
  const train = g.trains.find(t => t.id === bought.trainId);
  const calls = new Set(), through = new Set();
  for (let i = 0; i < 600; i++) {
    advance(g);
    if (train.atStopId) calls.add(train.atStopId);
    for (const id of [b, c]) {
      const s = g.lookup.stops.get(id);
      if (Math.hypot(s.x - train.position.x, s.y - train.position.y) < 0.001) through.add(id);
    }
  }
  assert.deepEqual(calls, new Set([a,d]));
  assert.deepEqual(through, new Set([b,c]));
});

function gaps(g, ticks) {
  const terminal = g.city.starterStops[0], arrivals = [];
  for (let i=0; i<ticks; i++) {
    const before = g.trains.map(t => t.atStopId);
    advance(g);
    g.trains.forEach((t,j) => { if (t.atStopId===terminal && before[j]!==terminal) arrivals.push(g.tick); });
  }
  return arrivals.slice(1).map((v,i) => v-arrivals[i]);
}
test('two then three trains divide the same observed round trip into equal departure intervals', () => {
  const g = start(), id = g.routes[0].id;
  const [period] = gaps(g,800);
  for (const size of [2,3]) {
    assert.ok(network.buyTrain(g,id).ok);
    advance(g,period*2);
    const headways = gaps(g,period*4);
    assert.ok(headways.length >= size*3);
    assert.ok(headways.every(gap => Math.abs(gap-period/size) < 1), headways.join(', '));
  }
  const fleet = g.trains.length, cash = g.cash;
  assert.equal(network.buyTrain(g,id).ok, false);
  assert.deepEqual([g.trains.length,g.cash],[fleet,cash]);
});

test('a two-line journey predicts the door arrival and charges a single quoted fare on first boarding', () => {
  const income=[], arrivals=[];
  const g=start({onFare:(g,r,e)=>income.push({...e}), onArrival:(g,r,j)=>arrivals.push(j)});
  const [a,b,c]=g.city.starterStops, r=g.residents[0];
  assert.ok(network.setStops(g,g.routes[0].id,[a,b]).ok);
  const other=network.createRoute(g,[b,c]);
  assert.ok(network.buyTrain(g,other.routeId).ok);
  const from=g.lookup.buildings.get(r.homeId), to=g.lookup.buildings.get(r.workId);
  // Find a connecting departure using the public planner, then take that very connection.
  let quote;
  for (let i=0;i<450;i++) {
    quote=g.systems.planJourney(g,r,from,to);
    if (quote.mode==='tram' && quote.legs.filter(l=>l.type==='ride').length===2) break;
    advance(g);
  }
  assert.equal(quote.legs.filter(l=>l.type==='ride').length,2);
  assert.equal(quote.decision.transfers,1);
  assert.ok(quote.decision.transferTicks>0);
  assert.ok(depart(g,r,r.workId));
  const used=new Set(), before=g.cash, startTick=g.tick;
  assert.equal(g.fareIncome,0);
  assert.equal(network.setFare(g,17).ok,true);
  for (let i=0;i<800 && r.journey;i++) {
    advance(g);
    if (r.onTrainId) {
      if (!used.size) {
        // Remove both original services before the connection has even boarded.
        assert.ok(network.assignTrain(g,quote.decision.rides[1].trainId,g.routes[0].id).ok);
        assert.ok(network.setStops(g,g.routes[0].id,[c,a]).ok);
      }
      used.add(r.onTrainId);
      assert.deepEqual(r.position,g.trains.find(t=>t.id===r.onTrainId).position);
      assert.equal(g.fareIncome,2);
    } else if (!used.size) assert.equal(g.cash,before);
  }
  assert.equal(used.size,2);
  assert.equal(income.length,1);
  assert.equal(income[0].amount,2);
  assert.equal(income[0].residentId,r.id);
  assert.equal(g.cash,before+2);
  assert.equal(arrivals.length,1);
  assert.equal(arrivals[0].arrivedAt-startTick,quote.decision.tramTicks);
  assert.deepEqual(r.position,to.entrance);
});

test('live edits honour riders and waiting connections while new choices see only the promised future service', () => {
  const g=start(), [a,b,c]=g.city.starterStops, old=g.routes[0].id;
  const r=g.residents[0], follower=g.residents.find(p=>p!==r && p.homeId===r.homeId);
  assert.ok(depart(g,r,r.workId));
  while (!r.onTrainId && g.tick<300) advance(g);
  assert.ok(r.onTrainId);
  const train=g.trains[0], original={...train.position}, eta=r.journey.decision.tramTicks;
  const next=network.createRoute(g,[b,c]).routeId;
  assert.ok(network.assignTrain(g,train.id,next).ok);
  assert.ok(network.setStops(g,next,[c,b]).ok);
  assert.equal(train.routeId,old);
  assert.equal(train.assignedRouteId,next);
  assert.deepEqual(train.position,original);
  const preview=g.systems.planJourney(g,follower,g.lookup.buildings.get(r.homeId),g.lookup.buildings.get(r.workId));
  assert.ok(preview.decision.rides.length>0);
  assert.ok(preview.decision.rides.every(l=>l.routeId===next && l.boardAt>=r.journey.decision.rides[0].alightAt));
  assert.ok(depart(g,follower,r.workId));
  const expected=g.tick+(follower.journey.mode==='tram'?follower.journey.decision.tramTicks:follower.journey.decision.walkTicks);
  while (g.tick<expected+eta+400) {
    const prev={...train.position};
    advance(g);
    assert.ok(Math.hypot(train.position.x-prev.x,train.position.y-prev.y)<=2.800001,'no teleport during dispatch');
  }
  assert.equal(r.lastJourney.arrivedAt,eta);
  assert.equal(follower.lastJourney.arrivedAt,expected);
  assert.equal(train.routeId,next);
  assert.equal(network.assignTrain(g,'missing',old).ok,false);
});

test('walking and tram times compare the same doors, including a short trip entirely within one block', () => {
  const g=start(),r=g.residents[0], from=g.lookup.buildings.get(r.homeId),to=g.city.buildings.find(b=>
    b.stopId===from.stopId && b.kind==='work');
  const plan=g.systems.planJourney(g,r,from,to);
  assert.equal(plan.mode,'walk');
  assert.equal(plan.decision.fare,g.fare);
  assert.deepEqual(plan.legs[0].points[0],from.entrance);
  assert.deepEqual(plan.legs[0].points.at(-1),to.entrance);
  assert.ok(depart(g,r,to.id));
  advance(g,plan.decision.walkTicks);
  assert.equal(r.currentBuildingId,to.id);
});

test('only the fare changes a marginal decision; invalid tariff leaves both the fare and cash untouched', () => {
  const g=start(), r=g.residents[0], from=g.lookup.buildings.get(r.homeId), to=g.lookup.buildings.get(r.workId);
  const plan=()=>g.systems.planJourney(g,r,from,to);
  const cheap=plan(), before=g.cash;
  assert.equal(cheap.mode,'tram');
  assert.ok(network.setFare(g,99).ok);
  const costly=plan();
  assert.equal(costly.mode,'walk');
  for (const key of ['tramTicks','walkTicks','accessTicks','waitTicks','transferTicks','rideTicks','exitTicks','rides'])
    assert.deepEqual(costly.decision[key],cheap.decision[key]);
  for (const invalid of [-1,NaN,1.5]) assert.equal(network.setFare(g,invalid).ok,false);
  assert.equal(g.cash,before);
  assert.equal(g.fare,99);
});
