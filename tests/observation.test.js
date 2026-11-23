const test = require('node:test');
const assert = require('node:assert/strict');
const { createCity } = require('../game/city.js');
const { startGame, advance, depart } = require('../game/simulation.js');
const { setStops, createRoute, buyTrain } = require('../game/service.js');

test('a connection sells one ticket at boarding and records one arrival in the interval of the final door', () => {
  const g = startGame(createCity('Ива'), { demand() {} }), r = g.residents[0];
  const [a,b,c] = g.city.starterStops;
  setStops(g,g.routes[0].id,[a,b]);
  buyTrain(g,createRoute(g,[b,c]).routeId);
  const from = g.lookup.buildings.get(r.homeId), to = g.lookup.buildings.get(r.workId);
  while (g.tick < 450) {
    const p = g.systems.planJourney(g,r,from,to);
    if (p.mode === 'tram' && p.decision.transfers === 1) break;
    advance(g);
  }
  assert.ok(depart(g,r,to.id));
  const boardings = [];
  while (!r.currentBuildingId && g.tick < 1000) {
    const before = r.onTrainId;
    advance(g);
    if (r.onTrainId && !before) boardings.push(g.tick);
  }
  assert.equal(boardings.length,2);
  assert.deepEqual(r.position,to.entrance);
  const arrival = g.tick, first = boardings[0], h = g.history;
  assert.equal(h.revenue(0,first),0);
  assert.equal(h.revenue(first,first+1),2);
  assert.equal(h.revenue(first+1,arrival+1),0);
  assert.equal(h.arrivalsAt(to.id,0,arrival).total,0);
  assert.equal(h.arrivalsAt(to.id,arrival,arrival).total,0);
  assert.deepEqual(h.arrivalsAt(to.id,arrival,arrival+1),{
    total:1, walk:0, tram:1, byDistrict:{[from.districtId]:{walk:0,tram:1}}
  });
  assert.equal(h.arrivalsAt(from.id,0,arrival+1).total,0);
});

test('two independent opening mornings measure the same destination with just one extra train', () => {
  const { compareMorning } = require('../game/experiment.js');
  const live = startGame(createCity('ТРАМ-17'));
  advance(live,300);
  const before = [live.tick,live.cash,live.trains.length,live.history.fares(0,301)];
  const market = live.city.buildings.find(b=>b.name==='Крытый рынок');
  const result = compareMorning(live.city);
  assert.deepEqual([result.from,result.to],[0,540]);
  const measured = [result.control,result.changed].map(h=>{
    const stats=h.arrivalsAt(market.id,result.from,result.to);
    return [stats.total,stats.tram,h.revenue(result.from,result.to)];
  });
  assert.deepEqual(measured,[[7,2,20],[7,3,30]]);
  assert.deepEqual([live.tick,live.cash,live.trains.length,live.history.fares(0,301)],before);
});
