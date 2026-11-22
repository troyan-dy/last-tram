(() => {
  'use strict';
  const { art, doorPath } = globalThis.LastTram;
  const { project, polygon, line, land, place } = art;
  const ns = 'http://www.w3.org/2000/svg';
  const el = name => document.createElementNS(ns, name);

  function bounds(stops) {
    const xs = stops.map(s=>s.x), ys = stops.map(s=>s.y);
    return { l:Math.min(...xs)-54, r:Math.max(...xs)+54, t:Math.min(...ys)-53, b:Math.max(...ys)+53 };
  }
  function terrain(game, stops, buildings, box) {
    const { l, r, t, b } = box;
    let g = polygon([[l,b],[r,b],[r,b,-4],[l,b,-4]],'#b1b69c')
      + polygon([[r,t],[r,b],[r,b,-4],[r,t,-4]],'#9eaa95') + land(l,t,r-l,b-t,'#b8c4a5');
    for (const s of stops) {
      g+=land(s.x-50,s.y-48,99,89,'#bfcaab');
      g+=land(s.x-48,s.y-45,49,32,'#b3c19f')+land(s.x+5,s.y+9,41,34,'#aebe9e');
    }
    for (const x of new Set(stops.map(s=>s.x))) {
      g+=land(x-3,t,6,b-t,'#d9cfad')+land(x-1.3,t,2.6,b-t,'#c6bda3');
    }
    for (const y of new Set(stops.map(s=>s.y))) {
      g+=land(l,y-11,r-l,20,'#dfd2b0')+land(l,y-4.7,r-l,9.4,'#bfb7a1');
    }
    for (const building of buildings) {
      const path = doorPath(building, game.lookup.stops.get(building.stopId));
      g+=line(path.map(p=>[p.x,p.y]),'#ddd3b2',2);
      const {x,y,width:w,depth:d}=building;
      g+=polygon([[x,y+d],[x+w,y+d],[x+w+8,y+d+2],[x+w+9,y+2],[x+w,y]],'#a6b198');
    }
    for (const id of game.trackIds) {
      const e = game.lookup.edges.get(id);
      g+=art.rails(game.lookup.stops.get(e.a), game.lookup.stops.get(e.b));
    }
    g+=line([[l,t],[r,t],[r,b],[l,b],[l,t]],'#7c947c',1.1,'stroke-dasharray="3 3"');
    return g;
  }
  function object(type,id,name,content) {
    return `<g data-type="${type}" data-id="${id}" role="button" tabindex="0" aria-label="${name}"><title>${name}</title>${content}</g>`;
  }
  function stopSign(s, served) {
    const color = served ? '#bc563c' : '#798b78';
    return object('stop',s.id,s.name,place(s.sidewalk.x,s.sidewalk.y,
      `<path d="M0 0v-12" stroke="#526b63" stroke-width="1.2"/>
       <rect x="-3.4" y="-13" width="6.8" height="5" rx="1" fill="${color}" stroke="#fff0ce" stroke-width=".85"/>
       <path d="M-1.6 -10.6H1.6" stroke="#fff5de" stroke-width=".9"/>
       <rect x="-4.5" y="-14" width="9" height="15" fill="transparent"/>`));
  }

  function createMap(svg, onSelect) {
    const scene = svg.querySelector('#scene'), moving = svg.querySelector('#moving');
    const marker = svg.querySelector('#marker'), nodes = new Map();
    let lastGame, signature, base, view, zoom = 1, drag, moved = false;
    function setView(v) {
      view = v;
      svg.setAttribute('viewBox', [v.x,v.y,v.w,v.h].join(' '));
    }
    function fit() { if (base) { zoom=1; setView({...base}); } }
    function local(clientX,clientY) {
      return new DOMPoint(clientX,clientY).matrixTransform(svg.getScreenCTM().inverse());
    }
    function zoomAt(factor, at) {
      if (!view) return;
      const next = Math.max(1, Math.min(5, zoom * factor));
      if (next === 1) { fit(); return; }
      const k = zoom / next;
      setView({x:at.x+(view.x-at.x)*k,y:at.y+(view.y-at.y)*k,w:view.w*k,h:view.h*k});
      zoom=next;
    }
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      zoomAt(Math.exp(-Math.sign(e.deltaY)*Math.min(Math.abs(e.deltaY)*.002, .85)),local(e.clientX,e.clientY));
    }, { passive:false });
    svg.addEventListener('pointerdown', e => {
      moved=false;
      if (e.button === 0 && zoom > 1) drag={ x:e.clientX,y:e.clientY,view:{...view} };
    });
    svg.addEventListener('pointermove', e => {
      if (!drag || !e.buttons) return;
      if (Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5) moved=true;
      if (!moved) return;
      svg.setPointerCapture(e.pointerId);
      const k=svg.getScreenCTM().a;
      setView({...drag.view,x:drag.view.x-(e.clientX-drag.x)/k,y:drag.view.y-(e.clientY-drag.y)/k});
    });
    svg.addEventListener('pointerup',()=> { drag=null; });
    function select(e) {
      const g=e.target.closest('[data-type]');
      if (g && !moved) onSelect(g.dataset.type,g.dataset.id);
    }
    svg.addEventListener('click',select);
    svg.addEventListener('keydown',e=>{
      if (e.key==='Enter'||e.key===' ') { e.preventDefault(); moved=false; select(e); }
    });
    function build(game) {
      const stops=game.city.stops.filter(s=>s.ring<=game.openRing);
      const buildings=game.city.buildings.filter(b=>b.ring<=game.openRing);
      const box=bounds(stops), {l,r,t,b}=box;
      const corners=[[l,t],[r,t],[r,b],[l,b]].map(p=>project(...p));
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      base={x:Math.min(...xs)-12,y:Math.min(...ys)-12,w:Math.max(...xs)-Math.min(...xs)+24,h:Math.max(...ys)-Math.min(...ys)+28};
      const items=[];
      const served=new Set(game.routes.flatMap(r=>r.stopIds));
      for (const s of stops) {
        for (const [dx,dy,i] of [[7,21,0],[14,20,1],[33,28,2],[-45,-12,1]]) {
          items.push({depth:project(s.x+dx,s.y+dy)[1], drawing:art.tree(s.x+dx,s.y+dy,i)});
        }
        items.push({depth:project(s.x,s.sidewalk.y)[1],drawing:stopSign(s,served.has(s.id))});
      }
      for (const b of buildings) {
        items.push({depth:project(b.x+b.width*.5,b.y+b.depth)[1],
          drawing:object('building',b.id,b.name,art.building(b))});
      }
      const labels=stops.filter(s=>served.has(s.id)).map(s=>place(s.x+3,s.y+8,
        `<g class="stop-label"><rect x="-1" y="-1" width="${s.name.length*3.5+10}" height="9" rx="2"/>
        <circle cx="3" cy="3.5" r="1.55"/><text x="7" y="5.7">${s.name}</text></g>`)).join('');
      scene.innerHTML=terrain(game,stops,buildings,box)+items.sort((a,b)=>a.depth-b.depth).map(o=>o.drawing).join('')+labels;
      moving.replaceChildren(); nodes.clear(); fit();
    }
    function sprite(type,id,name,inner,pos,drawn) {
      drawn.add(id);
      let g=nodes.get(id);
      if (!g) {
        g=el('g'); g.dataset.type=type; g.dataset.id=id; g.setAttribute('tabindex','0');
        g.setAttribute('role','button'); g.setAttribute('aria-label',name);
        g.innerHTML=`<title>${name}</title>${inner}`;
        nodes.set(id,g); moving.append(g);
      }
      g.setAttribute('transform',`translate(${project(pos.x,pos.y)})`);
    }
    function render(game,focus) {
      const key=`${game.openRing}|${[...game.trackIds].join(',')}|${game.routes.flatMap(r=>r.stopIds).join(',')}`;
      if (game!==lastGame || signature!==key) { build(game); lastGame=game; signature=key; }
      const drawn=new Set();
      for (const train of game.trains)
        sprite('train',train.id,train.name,art.train(false),train.position,drawn);
      for (const r of game.residents) {
        if (r.onTrainId || (!r.journey && !(focus?.id===r.id || (game.tick===0 && r===game.residents[0])))) continue;
        sprite('resident',r.id,r.name,art.person(r)+'<circle class="hit" cy="-4.2" r="5.3" fill="transparent"/>',r.position,drawn);
      }
      for (const [id,g] of nodes) if (!drawn.has(id)) { g.remove(); nodes.delete(id); }
      let p;
      if (focus?.type==='resident') p=game.residents.find(r=>r.id===focus.id)?.position;
      if (focus?.type==='train') p=game.trains.find(t=>t.id===focus.id)?.position;
      if (focus?.type==='stop') p=game.lookup.stops.get(focus.id)?.sidewalk;
      if (focus?.type==='building') p=game.lookup.buildings.get(focus.id)?.entrance;
      marker.style.display=p?'':'none';
      if (p) marker.setAttribute('transform',`translate(${project(p.x,p.y)})`);
    }
    return { render, fit, zoomBy: factor=>zoomAt(factor,{x:view.x+view.w/2,y:view.y+view.h/2}) };
  }
  Object.assign(globalThis.LastTram, { createMap });
})();
