// Build a street graph from a seed before laying out rails, gardens or houses.
// Stops have no row/column coordinates. Different seeds can produce different graphs.
(() => {
  'use strict';
  const pt=(x,y)=>({x,y}),mix=(a,b,t)=>pt(a.x+t*(b.x-a.x),a.y+t*(b.y-a.y));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function random(seed){
    let h=2166136261;for(const c of seed)h=Math.imul(h^c.codePointAt(0),16777619);
    return ()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;};
  }
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0;
  const center=p=>pt(p.reduce((s,v)=>s+v.x,0)/p.length,p.reduce((s,v)=>s+v.y,0)/p.length);
  const area=p=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
  function plan(rand){
    const n=8+Math.floor(rand()*6), rx=157+36*rand(),ry=113+28*rand(), rot=(rand()-.5)*1.2;
    const spin=(x,y)=>pt(x*Math.cos(rot)-y*Math.sin(rot),x*Math.sin(rot)+y*Math.cos(rot));
    const loc=[],boundary=Array.from({length:16},(_,i)=>{
      const a=(i+rand()*.25)*Math.PI/8,r=1.16+rand()*.10;return spin(Math.cos(a)*(rx+28)*r,Math.sin(a)*(ry+28)*r);
    });
    function sample(){const a=rand()*2*Math.PI,r=Math.sqrt(rand());return spin(Math.cos(a)*rx*r,Math.sin(a)*ry*r);}
    // Best of a small random sample leaves room both for dense lanes and for broad courts.
    while(loc.length<n){
      const count=loc.length?3+Math.floor(rand()*7):1;let best,score=-1;
      for(let i=0;i<count;i++){const p=sample(),s=Math.min(...loc.map(v=>dist(v,p)));if(s>score){score=s;best=p;}}
      if(score>40)loc.push(best);
    }
    const adj=loc.map(()=>[]),edges=[], candidates=[];
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)candidates.push({i,j,d:dist(loc[i],loc[j]),bias:rand()});
    candidates.sort((a,b)=>a.d-b.d);
    function add(e){edges.push(e);adj[e.i].push(e.j);adj[e.j].push(e.i);}
    // The minimum spanning tree joins every site; extra non-crossing streets create loops.
    const parent=loc.map((_,i)=>i),root=i=>parent[i]===i?i:root(parent[i]);
    for(const e of candidates){const a=root(e.i),b=root(e.j);if(a!==b){parent[a]=b;add(e);}}
    function detour(i,j){
      const costs=loc.map(()=>Infinity),todo=new Set([i]);costs[i]=0;
      while(todo.size){const u=[...todo].reduce((a,b)=>costs[a]<costs[b]?a:b);todo.delete(u);if(u===j)break;
        for(const v of adj[u]){const d=costs[u]+dist(loc[u],loc[v]);if(d<costs[v]){costs[v]=d;todo.add(v);}}}
      return costs[j];
    }
    const goal=n-1+2+Math.floor(rand()*Math.max(2,n*.43));
    while(edges.length<goal){
      let best,score=-Infinity;
      for(const e of candidates){const {i,j,d}=e;
        if(adj[i].includes(j)||adj[i].length>=5||adj[j].length>=5)continue;
        if(edges.some(k=>intersects(loc[i],loc[j],loc[k.i],loc[k.j])))continue;
        const narrow=(u,v)=>adj[u].some(k=>{
          const a=loc[u],b=loc[v],c=loc[k];return ((b.x-a.x)*(c.x-a.x)+(b.y-a.y)*(c.y-a.y))/(dist(a,b)*dist(a,c))>.925;
        });
        if(narrow(i,j)||narrow(j,i))continue;
        const benefit=detour(i,j)/d+e.bias*.9-d/260;
        if(benefit>score){score=benefit;best=e;}
      }
      if(!best)break;add(best);
    }
    // Walk the boundary of each block using the cyclic order of streets at every junction.
    adj.forEach((list,i)=>list.sort((a,b)=>Math.atan2(loc[a].y-loc[i].y,loc[a].x-loc[i].x)-Math.atan2(loc[b].y-loc[i].y,loc[b].x-loc[i].x)));
    const seen=new Set(),faces=[];
    for(let u=0;u<n;u++)for(const v of adj[u]){
      if(seen.has(`${u}/${v}`))continue;const face=[];let a=u,b=v;
      while(!seen.has(`${a}/${b}`)){
        seen.add(`${a}/${b}`);face.push(a);const ns=adj[b],next=ns[(ns.indexOf(a)+ns.length-1)%ns.length];a=b;b=next;
      }
      if(face.length>=3&&new Set(face).size===face.length&&area(face.map(i=>loc[i]))>0)faces.push(face);
    }
    if(!faces.length)return null;
    faces.sort((a,b)=>area(b.map(i=>loc[i]))-area(a.map(i=>loc[i])));
    const face=faces[0], anchor=face.reduce((a,b)=>adj[b].length>adj[a].length?b:a), idx=face.indexOf(anchor);
    const ring=[...face.slice(idx),...face.slice(0,idx)];
    const starter=[adj[anchor].find(i=>!ring.includes(i))??ring.at(-1),anchor,ring[1]];
    const label=Array(n);label[starter[0]]='Дворы';label[anchor]='Площадь';label[ring[1]]='Рынок';
    const labels=['Сквер','Типография','Липовая','Садовая','Застава','Мастерские','Читальня','Берёзовая','Почта','Слобода','Заречье'];
    for(const i of [...ring,...loc.keys()])if(!label[i])label[i]=labels.shift();
    // Give a street a bend only when the bend leaves other streets and junctions intact.
    for(const e of edges)e.line=[loc[e.i],loc[e.j]];
    const segments=p=>p.slice(1).map((b,i)=>[p[i],b]);
    for(const e of edges){
      const [a,b]=e.line,t=.32+rand()*.34,p=mix(a,b,t),k=(rand()-.5)*.28;
      const bend=pt(p.x-(b.y-a.y)*k,p.y+(b.x-a.x)*k);
      const proposed=[a,bend,b];
      if(Math.abs(k)>.025&&!edges.some(f=>f!==e&&segments(f.line).some(([u,v])=>segments(proposed).some(([x,y])=>intersects(x,y,u,v)))))e.line=proposed;
      e.width=starter.includes(e.i)&&starter.includes(e.j)?12:adj[e.i].length+adj[e.j].length>6?9:5+rand()*2;
    }
    const yard=face.map(i=>loc[i]), c=center(yard);
    const other=(faces[1]||face).map(i=>loc[i]),c2=center(other);
    const garden=yard.map(p=>mix(c,p,.43+rand()*.11)),pocket=other.map(p=>mix(c2,p,.32+rand()*.12));
    const across=face.reduce((a,b)=>dist(loc[b],loc[face[0]])>dist(loc[a],loc[face[0]])?b:a);
    const yardPath=[face[0],across],east=mix(c,loc[across],.32);
    return {loc,label,boundary,edges,adj,starter,ring,garden,pocket,yardPath,courtBends:[c,east],center:c,pocketCenter:c2};
  }
  // Grow from the existing street graph into the empty margin and across its contour.
  // A ring is a visibility boundary, not a compulsory circular road.
  function extend(plan,rand){
    const {loc,label,boundary,edges}=plan, original=loc.length, rings=loc.map(()=>0);
    const innerNames=['Тихая','Гончарная','Сиреневая','Песчаная','Ткацкая','Луговая','Вишнёвая','Кузнечная'];
    const outerNames=['Вокзал','Фабрика','Причал','Сады','Новоселье','Депо','Озёрная','Выселки'];
    const scaled=(p,k)=>pt(p.x*k,p.y*k), gates=[],beyond=[];
    function addSite(p,name,ring){const i=loc.length;loc.push(p);label.push(name);rings.push(ring);return i;}
    function join(i,j,width,bend){
      const line=bend?[loc[i],bend,loc[j]]:[loc[i],loc[j]];
      for(let k=1;k<line.length;k++)if(edges.some(e=>e.line.slice(1).some((b,n)=>intersects(line[k-1],line[k],e.line[n],b))))return false;
      edges.push({i,j,width,line});return true;
    }
    const phase=Math.floor(rand()*2);
    for(let n=0;n<8;n++){
      const i=(phase+n*2)%boundary.length;
      const ray=mix(boundary[i],boundary[(i+1)%boundary.length],rand()*.75);
      const gate=addSite(scaled(ray,.87+rand()*.065),innerNames[n],0);
      const candidates=Array.from({length:original},(_,i)=>i).sort((a,b)=>dist(loc[a],loc[gate])-dist(loc[b],loc[gate]));
      if(!candidates.some(i=>join(i,gate,6+rand()*3)))return false;
      const v=scaled(ray,1.32+rand()*.09), drift=(rand()-.5)*.13;
      const out=addSite(pt(v.x-v.y*drift,v.y+v.x*drift),outerNames[n],1);
      if(!join(gate,out,7+rand()*3,scaled(ray,1.04)))return false;
      gates.push(gate);beyond.push(out);
    }
    for(let n=0;n<8;n++){
      const k=(n+1)%8;
      if(rand()<.65)join(gates[n],gates[k],5+rand()*2);
      if(rand()<.83)join(beyond[n],beyond[k],6+rand()*3,scaled(mix(loc[beyond[n]],loc[beyond[k]],.45),1.035+rand()*.04));
    }
    plan.rings=rings;
    plan.outerBoundary=boundary.map(p=>scaled(p,1.57+rand()*.05));
    return true;
  }
  globalThis.LastTram??={};LastTram.makeStreetPlan=plan;LastTram.extendStreetPlan=extend;LastTram.streetRandom=random;
})();
