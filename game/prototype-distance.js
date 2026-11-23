// Distance travelled by people, in street coordinates. Waiting and empty vehicles add nothing.
(() => {
  const L=globalThis.LastTram;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function distanceMeter(game) {
    let walk=0,tram=0,day=L.cityTime(game).day;
    return {
      step() {
        const moving=game.residents.filter(r=>r.journey).map(r=>{
          const leg=r.journey.legs[r.journey.leg];
          return {r,leg,next:leg.next,from:r.position};
        });
        L.advance(game,1);
        const today=L.cityTime(game).day;
        if(today!==day){day=today;walk=tram=0;}
        for(const {r,leg,next,from} of moving){
          if(leg.type==='ride') tram+=distance(from,r.position);
          if(leg.type==='walk'){
            // A single step can cross a street corner; count the segments, not the chord.
            let p=from;
            for(let i=next;i<leg.next;i++){walk+=distance(p,leg.points[i]);p=leg.points[i];}
            walk+=distance(p,r.position);
          }
          // The model boards from the pavement; crossing to the stationary car is on foot.
          if(leg.type==='wait' && r.onTrainId)walk+=distance(from,r.position);
        }
      },
      get totals(){return {walk,tram};}
    };
  }
  L.distanceMeter=distanceMeter;
})();
