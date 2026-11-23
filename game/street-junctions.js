// Node the final street centerlines in world coordinates, before laying rails or sidewalks.
// A road stays one purchase even when a crossing divides it into several traversable spans.
(() => {
  const EPS=1e-7;
  const cross=(x,y,u,v)=>x*v-y*u;
  function streetJunctions(roads){
    const vertices=new Map(), sites=new Set(roads.flatMap(r=>[r.line[0],r.line.at(-1)]));
    let serial=0;
    function vertex(p,rank=sites.has(p)?0:1){
      if(!vertices.has(p))vertices.set(p,{p,rank,id:serial++,parent:null});
      return vertices.get(p);
    }
    function root(v){return v.parent?(v.parent=root(v.parent)):v;}
    function unify(a,b){
      a=root(a);b=root(b);if(a===b)return;
      // Preserve an existing intersection or bend when an approaching road needs to move.
      if(a.rank<b.rank||(a.rank===b.rank&&a.id<b.id))b.parent=a;else a.parent=b;
    }
    const sets=roads.map((road,index)=>road.line.slice(1).map((b,j)=>{
      const a=road.line[j],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      return {a,b,dx,dy,length,index,road,cuts:[{t:0,v:vertex(a)},{t:1,v:vertex(b)}]};
    }));
    function cut(s,t,v){
      t=Math.max(0,Math.min(1,t));
      const prior=s.cuts.find(c=>Math.abs(c.t-t)*s.length<EPS);
      if(prior)unify(prior.v,v);else s.cuts.push({t,v});
    }
    const spans=sets.flat();
    for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++){
      const s=spans[i],r=spans[j];
      if(s.index===r.index||s.length<EPS||r.length<EPS)continue;
      if(s.a===r.a||s.a===r.b||s.b===r.a||s.b===r.b)continue;
      const tolerance=Math.min(10,(s.road.width+r.road.width)/2);
      if(Math.max(s.a.x,s.b.x)+tolerance<Math.min(r.a.x,r.b.x)||
        Math.max(r.a.x,r.b.x)+tolerance<Math.min(s.a.x,s.b.x)||
        Math.max(s.a.y,s.b.y)+tolerance<Math.min(r.a.y,r.b.y)||
        Math.max(r.a.y,r.b.y)+tolerance<Math.min(s.a.y,s.b.y))continue;
      const den=cross(s.dx,s.dy,r.dx,r.dy),dx=r.a.x-s.a.x,dy=r.a.y-s.a.y;
      if(Math.abs(den)>EPS){
        const t=cross(dx,dy,r.dx,r.dy)/den,u=cross(dx,dy,s.dx,s.dy)/den;
        if(t>=0&&t<=1&&u>=0&&u<=1){
          const v=vertex({x:s.a.x+s.dx*t,y:s.a.y+s.dy*t},2);
          cut(s,t,v);cut(r,u,v);continue;
        }
      }
      const commonEnds=[s.road.line[0],s.road.line.at(-1)].filter(p=>p===r.road.line[0]||p===r.road.line.at(-1));
      const oblique=Math.abs(den)/(s.length*r.length)>.35;
      let best;
      function consider(a,t,b){
        const p=t===0?a.a:a.b, raw=((p.x-b.a.x)*b.dx+(p.y-b.a.y)*b.dy)/(b.length*b.length);
        const u=Math.max(0,Math.min(1,raw)),gx=b.a.x+u*b.dx-p.x,gy=b.a.y+u*b.dy-p.y,d=Math.hypot(gx,gy);
        if(d>tolerance||(best&&d>=best.d))return;
        // Leave the sides of an existing fork alone near its apex.
        if(commonEnds.some(v=>Math.hypot(p.x-v.x,p.y-v.y)<=2*tolerance))return;
        if(!oblique&&d>EPS){
          // Collinear tips facing one another may meet. Side-by-side streets may not.
          const outward=(t===0?-1:1)*(gx*a.dx+gy*a.dy)/(a.length*d);
          const facing=(u===0?1:-1)*(gx*b.dx+gy*b.dy)/(b.length*d);
          if(u!==0&&u!==1 || outward<.7 || facing<.7)return;
        }
        best={d,b,u,v:vertex(p)};
      }
      consider(s,0,r);consider(s,1,r);consider(r,0,s);consider(r,1,s);
      if(best)cut(best.b,best.u,best.v);
    }
    const point=p=>root(vertex(p)).p;
    const incidence=new Map();
    const lines=sets.map((spans,i)=>{
      const line=[];
      for(const s of spans)for(const c of s.cuts.sort((a,b)=>a.t-b.t)){
        const p=root(c.v).p;if(p===line.at(-1))continue;line.push(p);
        if(!incidence.has(p))incidence.set(p,new Set());incidence.get(p).add(i);
      }
      return line;
    });
    return {point,lines,radius(p){
      const ids=incidence.get(p);return ids?.size>=2?Math.min(7,Math.max(...[...ids].map(i=>roads[i].width))/2+1):0;
    }};
  }
  Object.assign(globalThis.LastTram??={},{streetJunctions});
})();
