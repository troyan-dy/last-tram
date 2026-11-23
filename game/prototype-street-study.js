// Materialize a seeded street graph as a playable city. Track bends are never passenger stops.
(() => {
  'use strict';
  const L=LastTram, pt=(x,y)=>({x,y}), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const mix=(a,b,t)=>pt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
  const clamp=t=>Math.max(0,Math.min(t,1));
  const closest=(p,a,b)=>clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(dist(a,b)**2||1));
  const arr=p=>[p.x,p.y];
  function generate(seed,attempt) {
    const rand=L.streetRandom(`${seed}/${attempt}`),plan=L.makeStreetPlan(rand);if(!plan)return null;
    if(!L.extendStreetPlan(plan,L.streetRandom(`${seed}/${attempt}/fringe`)))return null;
    const {label:names,loc,boundary,outerBoundary}=plan;
    const stops=loc.map((p,i)=>({...p,id:`stop-${i}`,name:names[i],districtId:`d-${i}`,ring:plan.rings[i],sidewalk:pt(p.x,p.y-5)}));
    const platforms=[...stops], edges=[], sections=[], roads=[], walks=[], buildings=[], trees=[];
    const walkNodes=new Map(), graph=new Map();
    const key=p=>`${p.x.toFixed(4)}:${p.y.toFixed(4)}`;
    function node(p){
      const k=key(p);if(!walkNodes.has(k)){walkNodes.set(k,p);graph.set(k,[]);}return k;
    }
    function connect(a,b,ring){
      const u=node(a),v=node(b);if(u===v)return;
      const length=dist(a,b);graph.get(u).push([v,length,ring]);graph.get(v).push([u,length,ring]);
    }
    function walkingLine(points,kind,ring=0,sectionId=null){
      for(let i=1;i<points.length;i++)walks.push({a:points[i-1],b:points[i],joins:[],kind,ring,sectionId});
    }
    function street(i,j,bends,width){
      const a=platforms[i], b=platforms[j], ring=Math.max(a.ring,b.ring),id=`${i}-${j}`, via=bends.map((p,n)=>({
        ...p,id:`bend-${id}-${n}`,junction:true,ring,sidewalk:pt(p.x,p.y-5)}));
      stops.push(...via);
      const line=[a,...via,b], parts=[];
      for(let n=1;n<line.length;n++){
        const e={id:`${id}/${n}`,a:line[n-1].id,b:line[n].id};edges.push(e);parts.push(e.id);
      }
      const s={id,a:a.id,b:b.id,line,parts,width,ring};sections.push(s);roads.push(s);
      const sidewalk=[a.sidewalk];
      for(let k=1;k<line.length;k++){
        const u=line[k-1],v=line[k],d=dist(u,v),nx=(u.y-v.y)/d,ny=(v.x-u.x)/d,off=width/2+1;
        for(const t of [.12,.88]){
          const p=mix(u,v,t);sidewalk.push(pt(p.x+nx*off,p.y+ny*off));
        }
      }
      sidewalk.push(b.sidewalk);walkingLine(sidewalk,'street',ring,id);
    }
    for(const e of plan.edges)street(e.i,e.j,e.line.slice(1,-1),e.width);
    const court=[platforms[plan.yardPath[0]].sidewalk,...plan.courtBends,platforms[plan.yardPath[1]].sidewalk];
    walkingLine(court,'court');
    const grove=plan.garden,pocket=plan.pocket;
    const nearest=(p,ring)=>platforms.filter(s=>s.ring===ring).reduce((best,s)=>dist(p,s)<dist(p,best)?s:best);
    function footprint(b){
      return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>b.local(u*b.width,v*b.depth));
    }
    function inside(p,polygon){
      let hit=false;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const a=polygon[i],b=polygon[j];
        if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
      }return hit;
    }
    const spans=(list,fn)=>list.slice(1).some((p,i)=>fn(list[i],p));
    const boxes=new WeakMap();
    const border=(poly,a,b,margin)=>{ // Check a street, footway or driveway against an oriented footprint.
      let box=boxes.get(poly);
      if(!box){const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);
        box=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];boxes.set(poly,box);}
      if(Math.max(a.x,b.x)<box[0]-margin||Math.min(a.x,b.x)>box[1]+margin||
         Math.max(a.y,b.y)<box[2]-margin||Math.min(a.y,b.y)>box[3]+margin)return false;
      const n=Math.ceil(dist(a,b)/2)||1;
      for(let k=0;k<=n;k++){
        const p=mix(a,b,k/n);if(inside(p,poly)||poly.some((v,i)=>dist(p,mix(v,poly[(i+1)%poly.length],closest(p,v,poly[(i+1)%poly.length])))<margin))return true;
      }return false;
    };
    const spurs=[];
    function lot(walk,t,side,offset,w,d) {
      const a=walk.a,b=walk.b,q=mix(a,b,t),length=dist(a,b), ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
      const center=pt(q.x-side*uy*offset,q.y+side*ux*offset);
      const local=(u,v)=>pt(center.x-side*u*ux+side*v*uy,center.y-side*u*uy-side*v*ux);
      const ring=walk.ring,s=nearest(center,ring), i=buildings.length;
      const lot={...center,id:`lot-${i}`,stopId:s.id,districtId:s.districtId,ring,width:w,depth:d,local,
        entrance:local(0,d/2),tint:i%4,floors:side>0?3:4+(i%3===0?1:0)};
      const shape=footprint(lot);
      if(shape.some(p=>!inside(p,outerBoundary)||inside(p,boundary)!==(ring===0)) || inside(center,grove) || inside(center,pocket))return false;
      if(roads.some(r=>spans(r.line,(p,q)=>border(shape,p,q,r.width/2+2))) ||
        walks.some(e=>border(shape,e.a,e.b,1.5)) || spurs.some(e=>border(shape,e[0],e[1],1)))return false;
      if(buildings.some(o=>shape.some((p,i)=>border(o.shape,p,shape[(i+1)%4],2))||inside(o,shape)
        ||border(o.shape,lot.entrance,q,1)))return false;
      const siblings=buildings.filter(o=>o.stopId===s.id), hasWork=siblings.some(o=>o.kind==='work');
      lot.kind=hasWork?'home':'work';lot.visualRole=hasWork?'house':s.name==='Рынок'?'market':'work';
      lot.name=hasWork?`${s.name}, дом ${siblings.length+1}`:({'Рынок':'Крытый рынок','Типография':'Типография','Садовая':'Читальня'}[s.name]||`${s.name} · мастерская`);
      lot.shape=shape;buildings.push(lot);spurs.push([lot.entrance,q,ring]);walk.joins.push([t,q]);return true;
    }
    // Vary both the street frontage and the depth of the yards. Never populate an implied grid.
    const candidates=[];
    for(const w of walks.filter(w=>dist(w.a,w.b)>12)){
      const n=Math.max(1,Math.floor(dist(w.a,w.b)/22));
      for(let i=0;i<n;i++)for(const side of [-1,1])candidates.push([w,(i+.27+rand()*.46)/n,side,rand()]);
    }
    for(const [w,t,side] of candidates.sort((a,b)=>a[3]-b[3])){
      const width=13+rand()*18,d=8+rand()*6;
      for(const off of [13+rand()*7,22+rand()*11,34+rand()*7])if(lot(w,t,side,off,width,d))break;
    }
    if(buildings.length<platforms.length*1.8 ||
      !plan.starter.every(i=>buildings.some(b=>b.kind==='work'&&b.stopId===platforms[i].id)) ||
      !buildings.some(b=>b.ring===1&&b.kind==='home'))return null;
    for(const w of walks){
      const sorted=[[0,w.a],...w.joins,[1,w.b]].sort((a,b)=>a[0]-b[0]);
      for(let i=1;i<sorted.length;i++)connect(sorted[i-1][1],sorted[i][1],w.ring);
    }
    for(const [a,b,ring] of spurs)connect(a,b,ring);
    const cache=new Map();
    function walking(from,to,ring=1){
      const src=key(from),dst=key(to), pair=`${ring}:${src}/${dst}`;if(cache.has(pair))return cache.get(pair);
      const todo=new Set([src]),cost=new Map([[src,0]]),prev=new Map();
      while(todo.size){
        const u=[...todo].reduce((a,b)=>cost.get(a)<cost.get(b)?a:b);todo.delete(u);
        if(u===dst)break;
        for(const [v,d,required] of graph.get(u)){if(required>ring)continue;const n=cost.get(u)+d;if(n>=(cost.get(v)??Infinity))continue;
          todo.add(v);cost.set(v,n);prev.set(v,u);}
      }
      if(!cost.has(dst))throw Error('Нет пешей связи');
      const path=[dst];while(path[0]!==src)path.unshift(prev.get(path[0]));
      const route=path.map(k=>walkNodes.get(k));cache.set(pair,route);return route;
    }
    const clear=p=>!buildings.some(b=>inside(p,b.shape))&&!roads.some(r=>spans(r.line,(a,b)=>dist(p,mix(a,b,closest(p,a,b)))<r.width*.5+3))
      &&!walks.some(w=>dist(p,mix(w.a,w.b,closest(p,w.a,w.b)))<3);
    for(let i=0;i<1700;i++){
      const p=pt(rand()*810-405,rand()*710-355);
      if(!inside(p,outerBoundary)||!(inside(p,pocket)||inside(p,grove)||i%10===0)||!clear(p)||trees.some(t=>dist(t,p)<7))continue;
      trees.push({...p,ring:inside(p,boundary)?0:1,variant:Math.floor(rand()*2)});
    }
    function attachToSidewalk(section,p){
      let best;
      for(const w of walks.filter(w=>w.sectionId===section.id)){
        const t=closest(p,w.a,w.b),q=mix(w.a,w.b,t),d=dist(p,q);
        if(!best||d<best.d)best={w,t,q,d};
      }
      const {w,t,q}=best;
      const joins=[[0,w.a],...w.joins,[1,w.b]].sort((a,b)=>a[0]-b[0]);
      const after=joins.findIndex(([u])=>u>=t);
      connect(q,joins[Math.max(0,after-1)][1],section.ring);connect(q,joins[after][1],section.ring);
      w.joins.push([t,q]);return q;
    }
    const study={boundary,outerBoundary,platforms,roads,walks,grove,pocket,court,trees,spurs,sections,walking,attachToSidewalk,
      square:platforms[plan.starter[1]],groveCenter:plan.center,pocketCenter:plan.pocketCenter,
      ring:plan.ring.map(i=>platforms[i].id)};
    return {seed,stops,edges,buildings,districts:platforms.map(s=>({id:s.districtId,name:s.name,ring:s.ring})),
      starterStops:plan.starter.map(i=>platforms[i].id),study};
  }
  function create(value){
    const seed=String(value||'Клён').trim()||'Клён';
    for(let attempt=0;attempt<80;attempt++){const c=generate(seed,attempt);if(c)return c;}
    throw Error('Не удалось разместить здания для этого сида.');
  }
  function openLine(g){
    const st=g.city.study;
    const route=g.city.starterStops;
    for(const id of route)g.lookup.stops.get(id).passengerStop=true;
    for(let i=1;i<route.length;i++){
      const s=st.sections.find(e=>(e.a===route[i-1]&&e.b===route[i])||(e.b===route[i-1]&&e.a===route[i]));
      for(const id of s.parts)g.trackIds.add(id);
    }
    const r=L.createRoute(g,g.city.starterStops),cash=g.cash;
    L.buyTrain(g,r.routeId);g.cash=cash;
  }
  // Subdivide only the selected rail segment. A built section remains built at no extra cost.
  // Existing train schedules keep their original endpoints; newly planned rides see the stop.
  function placeStop(g,s,p){
    if(!s||s.ring>g.openRing)return {ok:false,message:'Эта улица пока за границей зоны.'};
    let best;
    for(let i=1;i<s.line.length;i++){
      const a=s.line[i-1],b=s.line[i],t=closest(p,a,b),q=mix(a,b,t),d=dist(q,p);
      if(!best||d<best.d)best={i,a,b,q,d};
    }
    const {i,a,b,q}=best;
    if(g.city.stops.some(k=>k.passengerStop&&dist(q,k)<6))return {ok:false,message:'Здесь уже есть остановка. Выберите другое место.'};
    const named=g.city.study.platforms.filter(v=>v.ring===s.ring).reduce((u,v)=>dist(q,u)<dist(q,v)?u:v);
    const endpoint=[a,b].find(v=>dist(v,q)<.8);
    const station=endpoint||{...q,id:`platform-${g.city.stops.length+1}`,ring:s.ring};
    if(!endpoint){
      const prev=s.parts[i-1],wasBuilt=g.trackIds.delete(prev);
      const parts=[{a:a.id,b:station.id},{a:station.id,b:b.id}].map((v,k)=>({...v,id:`${s.id}@${station.id}:${k}`}));
      g.city.edges.splice(g.city.edges.findIndex(e=>e.id===prev),1,...parts);
      g.lookup.edges.delete(prev);
      for(const e of parts){g.lookup.edges.set(e.id,e);if(wasBuilt)g.trackIds.add(e.id);}
      s.parts.splice(i-1,1,...parts.map(e=>e.id));s.line.splice(i,0,station);
      g.city.stops.push(station);g.lookup.stops.set(station.id,station);
    }
    // Intersection names also identify districts in the flows layer: preserve them.
    let n=1,caption=named.name;
    while(g.city.stops.some(v=>v.passengerStop&&(v.stopName??v.name)===caption))caption=`${named.name} ${++n}`;
    station.stopName=caption;station.name??=caption;station.districtId??=named.districtId;
    if(!endpoint||endpoint.junction)station.sidewalk=g.city.study.attachToSidewalk(s,station);
    station.passengerStop=true;
    g.city.stopRevision=(g.city.stopRevision||0)+1;
    return {ok:true,id:station.id,name:caption};
  }
  // Faces are sorted in world space, so a facade may face along any lane.
  function model(local,w,d,h,facade,side,roof,windows,market=false,tram=false){
    const art=L.art, q=(x,y,z=0)=>{const p=local(x,y);return [p.x,p.y,z];};
    const half=w/2, deep=d/2, corners=[[-half,-deep],[half,-deep],[half,deep],[-half,deep]];
    const depth=(x,y)=>{const p=local(x,y);return art.project(p.x,p.y)[1];};
    const order=corners.map((a,i)=>{const b=corners[(i+1)%4];return {a,b,i,depth:depth((a[0]+b[0])/2,(a[1]+b[1])/2)};}).sort((a,b)=>a.depth-b.depth);
    let g='';
    for(const f of order){
      if(f.depth<depth(0,0))continue;
      const [ax,ay]=f.a,[bx,by]=f.b, len=Math.hypot(bx-ax,by-ay), v=(t,z)=>q(ax+t*(bx-ax),ay+t*(by-ay),z);
      const panel=(t,u,z,top,col)=>art.polygon([v(t,z),v(u,z),v(u,top),v(t,top)],col);
      g+=panel(0,1,tram?1:0,h,f.i%2?side:facade);
      if(tram)g+=panel(0,1,2.4,h-.25,'#ead3a0');
      const n=Math.max(1,Math.round(len/(tram?3.7:4.8)));
      for(let row=0;row<windows;row++){
        const z=tram?2.7:1.1+row*3.9;
        for(let j=0;j<n;j++){
          const t=(j+.18)/n,u=(j+.76)/n;
          g+=panel(t,u,z,Math.min(h-.35,z+(tram?2.1:2.5)),(j+row)%9===8&&!tram?'#f6cd82':'#514a42');
        }
      }
      if(!tram && f.i===2){
        g+=panel(.445,.55,0,3.3,'#4b4139');
        if(market)for(let i=0;i<8;i++)g+=art.polygon([q(-half+w*i/8,deep,6),
          q(-half+w*(i+1)/8,deep,6),q(-half+w*(i+1)/8,deep+3.5,4.3),q(-half+w*i/8,deep+3.5,4.3)],i%2?'#ffdfa6':'#ca703d');
      }
    }
    if(tram){
      g+=art.polygon(corners.map(([x,y])=>q(x,y,h)),roof);
      g+=art.line([q(-2.4,0,h),q(0,0,h+3.1),q(3.1,0,h+1.6),q(1.8,0,h)],'#494138',.9);
    }else{
      const pitch=Math.min(3.8,d*.26),ridge=[q(-half+2.2,0,h+pitch),q(half-2.2,0,h+pitch)];
      for(const f of order){
        const e=[q(...f.a,h),q(...f.b,h)],r=f.i===0?[ridge[1],ridge[0]]:f.i===1?[ridge[1]]:f.i===2?ridge:[ridge[0]];
        g+=art.polygon([...e,...r],[roof,'#8f5947','#b77553','#c68c64'][f.i]);
      }
    }
    return g;
  }
  function train(bearing){
    const ux=Math.cos(bearing),uy=Math.sin(bearing);
    return model((x,y)=>pt(x*ux-y*uy,x*uy+y*ux),16,5.6,6.3,'#d66c31','#a64f2c','#f3d6a0',1,false,true);
  }
  function scene(g,object){
    const {study}=g.city, art=L.art;
    const polygon=(p,c)=>art.polygon(p.map(arr),c);
    const band=(p,w,c)=>{
      const normals=p.slice(1).map((v,i)=>{const u=p[i],n=dist(u,v);return pt((u.y-v.y)/n,(v.x-u.x)/n);});
      const rim=(side)=>p.map((v,i)=>{
        const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)];
        const t=side*w/(2*Math.max(.35,1+a.x*b.x+a.y*b.y));return pt(v.x+t*(a.x+b.x),v.y+t*(a.y+b.y));
      });return polygon([...rim(1),...rim(-1).reverse()],c);
    };
    let base=polygon(study.outerBoundary,'#bdad82')+polygon(study.pocket,'#9ba16c')+polygon(study.grove,'#899968');
    for(const r of study.roads)base+=band(r.line,r.width+4,'#d8c6a5');
    for(const r of study.roads)base+=band(r.line,r.width,r.width>10?'#a18b77':'#b19b84');
    const square=study.square;
    base+=polygon(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return pt(square.x+16*Math.cos(a),square.y+11*Math.sin(a));}),'#c3ad90');
    for(const w of study.walks)base+=band([w.a,w.b],w.kind==='court'?3.2:1.7,w.kind==='court'?'#e4d2aa':'#d7c3a2');
    for(const [a,b,ring] of study.spurs)if(ring<=g.openRing)base+=band([a,b],1.8,'#ddcaaa');
    const items=[];
    for(const b of g.city.buildings){
      if(b.ring>g.openRing)continue;
      const home=b.kind==='home',market=b.visualRole==='market',h=home?b.floors*3.9:market?8:10;
      const f=['#c67c50','#c08a63','#cc9061','#b87150'][b.tint];
      base+=polygon(b.shape.map(p=>pt(p.x+h*.45,p.y+h*.2)),'#a49775');
      const drawing=model(b.local,b.width,b.depth,h,f,'#956647',['#a2644c','#a96c53','#98614f','#9a7566'][b.tint],home?b.floors:2,market);
      items.push([art.project(b.x,b.y)[1],object('building',b.id,b.name,drawing)]);
    }
    for(const p of study.trees)if(p.ring<=g.openRing)items.push([art.project(p.x,p.y)[1],art.tree(p.x,p.y,p.variant)]);
    for(const id of g.trackIds){const e=g.lookup.edges.get(id);base+=art.rails(g.lookup.stops.get(e.a),g.lookup.stops.get(e.b));}
    const caption=(x,y,text)=>art.place(x,y,`<text class="street-caption" pointer-events="none" text-anchor="middle">${text}</text>`);
    return base+items.sort((a,b)=>a[0]-b[0]).map(it=>it[1]).join('')+
      caption(study.pocketCenter.x,study.pocketCenter.y,'Сквер')+caption(study.groveCenter.x,study.groveCenter.y,'Проход через двор');
  }
  L.streetStudy={create,openLine,placeStop,scene,train};
})();
