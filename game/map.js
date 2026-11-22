// Coordinates of streets remain in the simulation's ground plane. Only the
// renderer projects them; upright sprites are anchored at their front door.
const CityMap = (() => {
  const transform = 'matrix(.91 .39 -.68 .51 0 0)';
  const project = ([x,y]) => [.91*x-.68*y,.39*x+.51*y];
  function bounds(open) {
    const [l,t,r,b] = open ? [0,0,940,590] : [90,108,847,476];
    const corners = [[l,t],[r,t],[l,b],[r,b]].map(project);
    const xs=corners.map(p=>p[0]), ys=corners.map(p=>p[1]);
    return [Math.min(...xs)-20,Math.min(...ys)-48,Math.max(...xs)-Math.min(...xs)+40,Math.max(...ys)-Math.min(...ys)+62];
  }
  function block(h) {
    const [x,y]=project([h.x,h.y]), floors=h.j>=2?3:4+(h.style>.6?1:0), height=floors*4.2;
    const width=25+Math.round(h.style*14);
    let windows='';
    for(let k=0;k<floors;k++)for(let i=3;i<width-1;i+=6)
      windows+=`<rect x="${i}" y="${-height+2+4.2*k}" width="3" height="2.5" fill="${(k+i)%3?'#698587':'#ebd9a6'}"/>`;
    return `<g transform="translate(${x} ${y})"><g transform="matrix(1 .43 0 1 ${-width/2} ${-width*.215})">
      <path d="M0 0v-${height}h${width}v${height}z" fill="${h.style>.5?'#d8c6a9':'#c3c6b0'}" stroke="#778878" stroke-width=".7"/>
      <path d="M0 ${-height}l10 -12h${width}l-10 12z" fill="#a2afa2"/><path d="M${width} 0l10 -12v-${height}l-10 12z" fill="#8e9c8b"/>
      ${windows}<rect x="${width/2}" y="-4" width="3" height="4" fill="#555e51"/></g></g>`;
  }
  return {transform,project,bounds,block};
})();
