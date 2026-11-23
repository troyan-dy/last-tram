const test=require('node:test'),assert=require('node:assert/strict');
const {startGame,advance}=require('../game/simulation.js');
const {createRoute,buyTrain}=require('../game/service.js');
require('../game/street-plan.js');
require('../game/prototype-street-study.js');
const gen=globalThis.LastTram.streetStudy;
const geometry=c=>[c.study.sections.map(e=>e.line.map(p=>[p.id,p.x,p.y])),c.buildings.map(b=>[b.id,b.entrance,b.shape])];

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
