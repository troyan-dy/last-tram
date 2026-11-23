// A world-space reveal: dragging and zooming move the fog edge with its streets.
(() => {
  const ns='http://www.w3.org/2000/svg';
  function createFog(svg,study,seed){
    const rand=LastTram.streetRandom(`${seed}/mist`), project=LastTram.art.project;
    const edge=svg.querySelector('#mist-line'),clouds=svg.querySelector('#mist-clouds'),world=svg.querySelector('#city-contents');
    const waves=study.boundary.flatMap(()=>Array.from({length:4},()=>.991+rand()*.018));
    function contour(bounds){
      return waves.map((k,n)=>{
        const i=Math.floor(n/4),a=bounds[i],b=bounds[(i+1)%bounds.length],t=n%4/4;
        return project(k*(a.x+t*(b.x-a.x)),k*(a.y+t*(b.y-a.y)));
      });
    }
    const inner=contour(study.boundary),outer=contour(study.outerBoundary);
    const puffs=inner.map((_,i)=>{
      const el=document.createElementNS(ns,'ellipse');
      el.setAttribute('rx',String(14+rand()*14));el.setAttribute('ry',String(6+rand()*7));
      el.setAttribute('fill','url(#mist-puff)');el.setAttribute('opacity',String(.55+rand()*.3));
      clouds.append(el);return el;
    });
    function draw(progress){
      const points=inner.map(([x,y],i)=>[x+(outer[i][0]-x)*progress,y+(outer[i][1]-y)*progress]);
      const mid=(a,b)=>`${((a[0]+b[0])/2).toFixed(1)},${((a[1]+b[1])/2).toFixed(1)}`;
      edge.setAttribute('d','M'+mid(points.at(-1),points[0])+points.map((p,i)=>{
        puffs[i].setAttribute('cx',p[0].toFixed(1));puffs[i].setAttribute('cy',p[1].toFixed(1));
        return `Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${mid(p,points[(i+1)%points.length])}`;
      }).join('')+'Z');
    }
    svg.dataset.fog='center';
    world.setAttribute('clip-path','url(#visible-streets)');
    draw(0);
    return function reveal(){
      svg.dataset.fog='expanded';
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){draw(1);return;}
      const start=performance.now();
      function frame(now){
        const t=Math.min(1,(now-start)/780);draw(t*t*(3-2*t));
        if(t<1)requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
  }
  LastTram.createStudyFog=createFog;
})();
