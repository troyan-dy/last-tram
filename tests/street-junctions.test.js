const test=require('node:test'),assert=require('node:assert/strict');
require('../game/street-junctions.js');
const join=LastTram.streetJunctions;
const road=(...coords)=>({width:6,line:coords.map(([x,y])=>({x,y}))});
test('three through streets meeting at one point share one switch, independently of digitizing direction',()=>{
  const {lines}=join([road([-20,0],[20,0]),road([0,25],[0,-25]),road([-15,-15],[15,15])]);
  for(const line of lines){
    assert.equal(line.length,3);
    assert.deepEqual(line[1],{x:0,y:0});
    assert.equal(line[1],lines[0][1]);
  }
});
test('a T ending within the road surface joins the through street, but a parallel street and a distant tip stay separate',()=>{
  const plan=join([road([-40,0],[40,0]),road([0,28],[0,3]),road([-30,-5],[30,-5]),road([22,25],[22,12])]);
  const [main,branch,parallel,distant]=plan.lines;
  assert.equal(main.length,3);assert.equal(main[1],branch.at(-1));
  assert.equal(parallel.length,2);assert(!parallel.some(p=>main.includes(p)));
  assert(!distant.some(p=>main.includes(p)));
});
test('opposing street ends close a small lengthwise gap without joining adjacent parallel lanes',()=>{
  const [a,b,c]=join([road([-30,0],[0,0]),road([3,0],[33,0]),road([-30,5],[0,5])]).lines;
  assert.equal(a.at(-1),b[0]);
  assert(!c.some(p=>a.includes(p)||b.includes(p)));
});
