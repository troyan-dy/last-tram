const test=require('node:test'),assert=require('node:assert/strict');
const {startGame,advance}=require('../game/simulation.js');
const {createRoute,buyTrain}=require('../game/service.js');
require('../game/street-plan.js');
require('../game/prototype-street-study.js');
const gen=globalThis.LastTram.streetStudy;
const geometry=c=>[c.study.sections.map(e=>e.line.map(p=>[p.id,p.x,p.y])),c.buildings.map(b=>[b.id,b.entrance,b.shape])];

test('the same seed already contains inhabited streets beyond all sides of its starting contour',()=>{
  for(const seed of ['Клён','Ива','Арбат']){
    const c=gen.create(seed), byId=new Map(c.stops.map(p=>[p.id,p]));
    const outgoing=c.study.sections.filter(e=>byId.get(e.a).ring!==byId.get(e.b).ring);
    assert(outgoing.length>=4,'real streets must continue from the center into the fog');
    const outer=c.buildings.filter(b=>b.ring===1);
    assert(outer.some(b=>b.kind==='home')&&outer.some(b=>b.kind==='work'));
    for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const extent=Math.max(...c.study.boundary.map(p=>x*p.x+y*p.y));
      assert(outer.some(b=>x*b.x+y*b.y>extent),'expansion adds city in every direction');
      assert(c.buildings.some(b=>!b.ring&&x*b.x+y*b.y>extent*.75),'the visible fringe is inhabited');
    }
  }
});

test('a seed repeats street connections and doors; other seeds change the graph, not just the coordinates',()=>{
  assert.deepEqual(geometry(gen.create('Клён')),geometry(gen.create('Клён')));
  const shapes=new Set(),loops=new Set();
  for(const seed of ['Клён','Ива','Арбат','Сокол','Сады','Берег','Рябина','Печать']){
    const c=gen.create(seed),{sections,platforms,walking}=c.study;
    loops.add(sections.length-platforms.length+1);
    shapes.add(platforms.map(s=>sections.filter(e=>e.a===s.id||e.b===s.id).length).sort().join(':'));
    for(const b of c.buildings){
      const route=walking(b.entrance,platforms[0].sidewalk);
      assert.deepEqual([route[0],route.at(-1)],[b.entrance,platforms[0].sidewalk]);
    }
  }
  assert(shapes.size>=4);assert(loops.size>=2);
});

test('a train completes a generated circuit using physical rail bends without serving them as stops',()=>{
  const city=gen.create('Ива'),g=startGame(city,{openLine:gen.openLine});
  const {sections,ring}=city.study;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    const section=sections.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
    for(const id of section.parts)g.trackIds.add(id);
  }
  const r=createRoute(g,ring,true);assert(r.ok);
  const purchase=buyTrain(g,r.routeId);assert(purchase.ok);
  const train=g.trains.find(t=>t.id===purchase.trainId);
  const calls=[],departed=new Set();
  const period=g.routes.find(x=>x.id===r.routeId).schedule.period;
  for(let i=0;i<=period+1;i++){
    if(train.atStopId&&calls.at(-1)!==train.atStopId)calls.push(train.atStopId);
    if(train.a!==train.b)departed.add(train.a);
    advance(g);
  }
  assert.deepEqual(calls,[...ring,ring[0]]);
  assert([...departed].some(id=>g.lookup.stops.get(id).junction));
});

test('placing a stop inside a built rail keeps existing service intact and connects a passenger on foot',()=>{
  const city=gen.create('Клён'),g=startGame(city,{openLine:gen.openLine});
  const train=g.trains[0],schedule=g.routes[0].schedule,position={...train.position},balance=g.cash;
  const s=city.study.sections.find(e=>e.parts.every(id=>g.trackIds.has(id)));
  const [a,b]=s.line,click={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const result=gen.placeStop(g,s,click);assert(result.ok);
  const stop=g.lookup.stops.get(result.id);
  assert.deepEqual({x:stop.x,y:stop.y},click);
  assert.equal(gen.placeStop(g,s,click).ok,false);
  assert(s.parts.every(id=>g.trackIds.has(id)));assert.equal(g.cash,balance);
  assert.deepEqual(train.position,position);assert.equal(g.routes[0].schedule,schedule);
  const home=city.buildings.find(b=>!b.ring&&b.kind==='home');
  assert.deepEqual(city.study.walking(home.entrance,stop.sidewalk,g.openRing).at(-1),stop.sidewalk);
  assert(createRoute(g,[s.a,stop.id,s.b]).ok);
});
