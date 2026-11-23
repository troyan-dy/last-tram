(() => {
  'use strict';
  const { art, doorPath, cityTime, journeyAction, matchesFlow, thoughtLayout } = globalThis.LastTram;
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
      `<g class="platform-light" pointer-events="none"><ellipse rx="10" ry="3" fill="#ffda85" opacity=".35"/>
       <circle cx="0" cy="-11" r="6" fill="#ffe6a8" opacity=".38"/></g>
       <path d="M0 0v-12" stroke="#526b63" stroke-width="1.2"/>
       <rect x="-3.4" y="-13" width="6.8" height="5" rx="1" fill="${color}" stroke="#fff0ce" stroke-width=".85"/>
       <path d="M-1.6 -10.6H1.6" stroke="#fff5de" stroke-width=".9"/>
       <rect x="-4.5" y="-14" width="9" height="15" fill="transparent"/>`));
  }

  function createMap(svg, onSelect) {
    const scene = svg.querySelector('#scene'), moving = svg.querySelector('#moving');
    const marker = svg.querySelector('#marker'), nodes = new Map();
    const thoughts=svg.querySelector('#thoughts'), leaders=svg.querySelector('#leaders'), labels=new Map();
    let lastGame, signature, signsKey, base, view, zoom = 1, drag, moved = false;
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
      if (!g || moved) return;
      let group;
      if (g.dataset.type==='resident' && g.parentNode===moving && e.type==='click') {
        const hits=document.elementsFromPoint(e.clientX,e.clientY)
          .map(el=>el.closest('#moving [data-type="resident"]')).filter(Boolean);
        group=[...new Set(hits.map(el=>el.dataset.id))];
      }
      onSelect(g.dataset.type,g.dataset.id,group);
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
      for (const s of stops) {
        for (const [dx,dy,i] of [[7,21,0],[14,20,1],[33,28,2],[-45,-12,1]]) {
          items.push({depth:project(s.x+dx,s.y+dy)[1], drawing:art.tree(s.x+dx,s.y+dy,i)});
        }
      }
      for (const b of buildings) {
        items.push({depth:project(b.x+b.width*.5,b.y+b.depth)[1],
          drawing:object('building',b.id,b.name,art.building(b))});
      }
      const scenery=terrain(game,stops,buildings,box)+items.sort((a,b)=>a.depth-b.depth).map(o=>o.drawing).join('');
      scene.innerHTML=`<g class="scenery">${scenery}</g><g class="signs"></g>`;
      signsKey=null;
      moving.replaceChildren(); nodes.clear(); thoughts.replaceChildren(); leaders.replaceChildren(); labels.clear(); fit();
    }
    function signs(game,served) {
      const key=[...served.keys()].sort().join(',');
      if (key===signsKey) return;
      signsKey=key;
      const stops=game.city.stops.filter(s=>s.ring<=game.openRing);
      const stopLabels=stops.filter(s=>served.has(s.id)).map(s=>place(s.x+3,s.y+8,
        `<g class="stop-label"><rect x="-1" y="-1" width="${s.name.length*3.5+10}" height="9" rx="2"/>
        <circle cx="3" cy="3.5" r="1.55"/><text x="7" y="5.7">${s.name}</text></g>`)).join('');
      scene.querySelector('.signs').innerHTML=stops.map(s=>stopSign(s,served.has(s.id))).join('')+stopLabels;
    }
    function sprite(type,id,name,draw,pos,drawn,variant='') {
      drawn.add(id);
      let g=nodes.get(id);
      if (!g) {
        g=el('g'); g.dataset.type=type; g.dataset.id=id; g.setAttribute('tabindex','0');
        g.setAttribute('role','button'); g.setAttribute('aria-label',name);
        nodes.set(id,g); moving.append(g);
      }
      if (g.dataset.variant!==variant) {
        g.innerHTML=`<title>${name}</title>${draw()}`;
        g.dataset.variant=variant;
      }
      g.setAttribute('transform',`translate(${pos})`);
    }
    function thought(r,dest,xy,layout) {
      const action=journeyAction(r.journey), mode=r.journey.mode, signature=[dest.id,action,mode].join('|');
      let item=labels.get(r.id);
      if (!item) {
        const g=el('g'), line=el('path');
        g.dataset.type='resident'; g.dataset.id=r.id; g.dataset.thought=r.id;
        g.setAttribute('role','button'); g.setAttribute('tabindex','0');
        thoughts.append(g); leaders.append(line);
        item={g,line}; labels.set(r.id,item);
      }
      const {g,line}=item;
      if (item.signature!==signature) {
        item.signature=signature;
        const icon=dest.visualRole;
        const caption=`${r.name}: ${dest.name} · ${action} · ${mode==='tram'?'С трамваем':'Целиком пешком'}`;
        item.width=Math.max(dest.name.length*3.8,action.length*3.5)+19;
        g.setAttribute('aria-label',caption); g.dataset.mode=mode;
        g.innerHTML=`<title>${caption}</title><rect width="${item.width}" height="19" rx="7"/>
          <use href="#intent-${icon}" transform="translate(2 1) scale(.77)"/>
          <use href="#intent-${mode}" transform="translate(3 10) scale(.64)"/>
          <text x="13" y="8">${dest.name}</text><text class="activity" x="13" y="16">${action}</text>`;
      }
      const [x,y]=xy, b=layout.place(x,y,item.width,19);
      const tipX=Math.max(b.x+5,Math.min(b.x+b.w-5,x)), tipY=y-9>b.y+b.h?b.y+b.h:b.y;
      g.setAttribute('transform',`translate(${b.x} ${b.y})`);
      line.setAttribute('d',`M${x},${y-9} L${tipX},${tipY}`);
    }
    function render(game,focus,flow={enabled:false},inspection=null,served=globalThis.LastTram.operatingStops(game)) {
      const light=cityTime(game).period.id;
      if (svg.dataset.light!==light) svg.dataset.light=light;
      const key=`${game.openRing}|${[...game.trackIds].join(',')}`;
      if (game!==lastGame || signature!==key) { build(game); lastGame=game; signature=key; }
      signs(game,served);
      const drawn=new Set(), showing=new Set(), active=[], seats=new Map();
      const layout=flow.enabled?thoughtLayout(view):null;
      for (const train of game.trains)
        sprite('train',train.id,train.name,()=>art.train(train.axis==='y'),project(train.position.x,train.position.y),drawn,train.axis);
      for (const r of game.residents) {
        if ((r.onTrainId && !layout) || (!r.journey && !(focus?.id===r.id || (game.tick===0 && r===game.residents[0])))) continue;
        const xy=project(r.position.x,r.position.y);
        if (r.onTrainId) {
          // Individual cabin seats, relative to the real moving train (never move the model).
          const n=seats.get(r.onTrainId)??0; seats.set(r.onTrainId,n+1);
          xy[0]+=(n%5-2)*6; xy[1]-=4+Math.floor(n/5)*8;
        }
        sprite('resident',r.id,r.name,()=>art.person(r)+'<circle class="hit" cy="-4.2" r="5.3" fill="transparent"/>',xy,drawn);
        if (layout) {
          layout.person(...xy);
          if (matchesFlow(r.journey,flow.buildingId,flow.filters)) active.push([r,xy]);
        }
      }
      for (const [r,xy] of active) {
        thought(r,game.lookup.buildings.get(r.journey.destinationId),xy,layout); showing.add(r.id);
      }
      for (const [id,item] of labels) if (!showing.has(id)) { item.g.remove(); item.line.remove(); labels.delete(id); }
      for (const [id,g] of nodes) if (!drawn.has(id)) { g.remove(); nodes.delete(id); }
      let p;
      if (focus?.type==='resident') p=game.residents.find(r=>r.id===focus.id)?.position;
      if (focus?.type==='building') p=game.lookup.buildings.get(focus.id)?.entrance;
      marker.style.display=p?'':'none';
      if (p) marker.setAttribute('transform',`translate(${project(p.x,p.y)})`);
      const n=inspection?.type==='train' ? game.trains.find(t=>t.id===inspection.id)?.position
        : game.lookup.stops.get(inspection?.id)?.sidewalk;
      const network=svg.querySelector('#network-marker');
      network.style.display=n?'':'none';
      if (n) network.setAttribute('transform',`translate(${project(n.x,n.y)})`);
    }
    return { render, fit, zoomBy: factor=>zoomAt(factor,{x:view.x+view.w/2,y:view.y+view.h/2}) };
  }
  Object.assign(globalThis.LastTram, { createMap });
})();
