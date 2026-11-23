(() => {
  'use strict';
  function journeyAction(j) {
    const leg=j.legs[j.leg];
    if (leg.type==='ride') return 'В вагоне';
    if (leg.type==='wait') return j.leg>1?'Ждёт пересадку':'Ждёт поезд';
    return j.mode==='tram' && !j.leg?'К остановке':'Идёт к двери';
  }
  function matchesFlow(j,buildingId,f) {
    return j && (!buildingId || (f[j.mode] &&
      ((f.to && j.destinationId===buildingId) || (f.from && j.originId===buildingId))));
  }

  // Fixed-size cells avoid comparing every label with every other resident.
  // Reserve the people first; try a nearby free slot before extending the leader.
  function thoughtLayout(bounds) {
    const cells=new Map(), step=50;
    function visit(box,fn) {
      for (let y=Math.floor(box.y/step);y<=Math.floor((box.y+box.h)/step);y++)
        for (let x=Math.floor(box.x/step);x<=Math.floor((box.x+box.w)/step);x++)
          if (fn(x+','+y)) return true;
      return false;
    }
    function reserve(box) {
      visit(box,key=>{ if (!cells.has(key)) cells.set(key,[]); cells.get(key).push(box); });
    }
    function occupied(b) {
      return visit(b,key=>cells.get(key)?.some(a=>b.x<a.x+a.w && a.x<b.x+b.w && b.y<a.y+a.h && a.y<b.y+b.h));
    }
    return {
      person(x,y) { reserve({x:x-5,y:y-10,w:10,h:12}); },
      place(x,y,w,h) {
        const onMap=x>=bounds.x && x<=bounds.x+bounds.w && y>=bounds.y && y<=bounds.y+bounds.h;
        const candidate=(col,row)=>{
          const left=x-w/2+col*(w+1), top=y-h-13+row*(h+2);
          return {x:onMap?Math.max(bounds.x,Math.min(bounds.x+bounds.w-w,left)):left,
            y:onMap?Math.max(bounds.y,Math.min(bounds.y+bounds.h-h,top)):top,w,h};
        };
        // Bounded probes per person, even with the whole expanded city on one platform.
        for (const row of [0,-1,1,-2,2,-3,3]) for (const col of [0,-1,1,-2,2]) {
          const b=candidate(col,row);
          if (!occupied(b)) { reserve(b); return b; }
        }
        const b=candidate(0,0); reserve(b); return b;
      }
    };
  }
  const api={journeyAction,matchesFlow,thoughtLayout};
  Object.assign(globalThis.LastTram??={},api);
  if (typeof module!=='undefined') module.exports=api;
})();
