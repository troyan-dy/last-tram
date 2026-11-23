// Flat-shaded paper buildings, market awnings and panel blocks from the approved morning study.
(() => {
  'use strict';
  function project(x, y, z = 0) { return [x * 1.64 - y * 0.84, x * 0.40 + y * 0.90 - z * 1.28]; }
  const points = list => list.map(p => project(...p).map(v => v.toFixed(2)).join(',')).join(' ');
  const polygon = (list, fill) => `<polygon points="${points(list)}" fill="${fill}"/>`;
  const line = (list, stroke, width, more = '') =>
    `<polyline points="${points(list)}" fill="none" stroke="${stroke}" stroke-width="${width}" ${more}/>`;
  const land = (x, y, w, d, color) => polygon([[x,y],[x+w,y],[x+w,y+d],[x,y+d]], color);
  const place = (x, y, art) => `<g transform="translate(${project(x,y)})">${art}</g>`;
  function block(x,y,w,d,z,h,roof,front,side) {
    return polygon([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],front)
      + polygon([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],side)
      + polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],roof);
  }
  const face = (x,y,z,w,h,c) => polygon([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],c);
  function building(b) {
    const { x, y, width:w, depth:d, tint } = b;
    const home = b.kind === 'home', market = b.visualRole === 'market';
    const floors = home ? b.floors : market ? 1 : 2;
    const h = home ? floors * 4.2 + 1 : market ? 11 : 14;
    const wall = (home ? ['#ddd4b9','#dadbc9','#d4cab5','#e4d6ba'] : ['#dbbc91','#ccab8a','#ceb29d','#d5bc99'])[tint];
    let g = block(x,y,w,d,0,h,home ? '#8f9c98' : market ? '#b87353' : '#a78b74',wall,home ? '#a5b0a1' : '#b39979');
    g += block(x+w*.56,y+d*.32,4.3,3.2,h,1.7,'#c5c5af','#999e8f','#838d84');
    for (let floor = 0; floor < floors; floor++) {
      const z = home ? 1.2 + floor * 4.2 : 2.5 + floor * 5.5;
      if (home) g += face(x,y+d,z-.7,w,.28,'#b9b7a5');
      for (let dx=1.8; dx < w-2; dx+=4.8) {
        if (!floor && Math.abs(dx - w*.50) < 3.3) continue;
        g += face(x+dx,y+d,z,2.65,home ? 2.75 : 3.6,'#658386');
        if (home && floor && dx > w*.48 && dx < w*.8)
          g += face(x+dx-.35,y+d,z-.45,3.5,1.4,tint%2 ? '#a88772' : '#adbcb4');
      }
      for (let dy=2; dy<d-2; dy+=5) g += polygon([[x+w,y+dy,z],[x+w,y+dy+2,z],
        [x+w,y+dy+2,z+2.4],[x+w,y+dy,z+2.4]],'#778a84');
    }
    g += face(b.entrance.x-1.5,y+d,0,3,4.3,'#405a55');
    if (market) {
      for (let dx=0; dx<w; dx+=3.2) {
        const end = Math.min(w,dx+3.2);
        g += polygon([[x+dx,y+d,7],[x+end,y+d,7],[x+end,y+d+4,4.8],[x+dx,y+d+4,4.8]],
          Math.round(dx/3.2)%2 ? '#f3dcb1' : '#b9634d');
      }
    }
    return g;
  }
  function tree(x,y,variant) {
    const h = 9 + variant * 1.4;
    return place(x,y,`<ellipse cx="3" cy="0" rx="4" ry="1.5" fill="#9fac91"/>
      <path d="M0 0v-7" stroke="#697963" stroke-width="1.3"/>
      <path d="M0 ${-h-3}L-4.5 -7 -3.2 -3 0 -2Z" fill="#83a389"/>
      <path d="M0 ${-h-3}L4.5 -7 3.2 -3 0 -2Z" fill="#587d69"/>`);
  }
  function rails(a,b) {
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy), nx=-dy/len, ny=dx/len;
    let g = line([[a.x,a.y],[b.x,b.y]],'#b4a78e',6.8);
    for (let n=0;n<len;n+=4.3) {
      const x=a.x+dx*n/len, y=a.y+dy*n/len;
      g+=line([[x+nx*2.2,y+ny*2.2],[x-nx*2.2,y-ny*2.2]],'#8e8c79',1.1);
    }
    for (const k of [-1.65,1.65])
      g+=line([[a.x+nx*k,a.y+ny*k],[b.x+nx*k,b.y+ny*k]],'#596f6b',.95);
    return g;
  }
  function train(vertical) {
    if (vertical) {
      let g = block(-2.8,-8,5.6,16,1,5.5,'#dbc198','#c65d40','#914c39')
        + face(-2,8,3.1,4,2.1,'#a8c3b9')
        + line([[2.8,-8,1.9],[2.8,8,1.9]],'#e6bf88',.65)
        + line([[0,-2,6.5],[0,.3,9.7],[0,3,8],[0,1.2,6.5]],'#485e5b',.95);
      for (let y=-7; y<7; y+=3.8)
        g+=polygon([[2.8,y,3.2],[2.8,y+2.55,3.2],[2.8,y+2.55,5.35],[2.8,y,5.35]],'#c6ded3');
      return g;
    }
    const g = block(-8,-2.8,16,5.6,1,5.5,'#dbc198','#c65d40','#914c39')
      + face(-8,2.8,1.6,16,.48,'#e6bf88')
      + Array.from({length:4},(_,i)=>face(-7+i*3.8,2.8,3.2,2.55,2.15,'#c6ded3')).join('')
      + line([[-2,0,6.5],[.3,0,9.7],[3,0,8],[1.2,0,6.5]],'#485e5b',.95)
      + polygon([[8,-2,3.1],[8,1.8,3.1],[8,1.8,5.2],[8,-2,5.2]],'#a8c3b9');
    return g;
  }
  function person(r) {
    const color = ['#a94837','#3c7982','#d69f36','#856a8c','#4a6691'][r.coat];
    return `<ellipse rx="3" ry="1" cx="1.6" fill="#778d7c"/><path d="M-1.55 0l1.2 -3 1.8 3" fill="none" stroke="#304844" stroke-width="1.25"/>
      <path d="M-1.3 -6h2.45l1 3.7h-4.4z" fill="${color}"/><circle cy="-7.1" r="1.65" fill="#d5a67e"/>
      <path d="M-1.65 -7.35q.2 -3 2.75 -1.2l.45 1z" fill="#3d504a"/>`;
  }
  Object.assign(globalThis.LastTram ??= {}, { art: { project, polygon, line, land, place, building, tree, rails, train, person } });
})();
