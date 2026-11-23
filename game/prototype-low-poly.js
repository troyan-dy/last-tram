// Art study B, loaded only by the interactive mockup. All angles use the live map projection.
(() => {
  const a = LastTram.art, {polygon, line, place, land} = a;
  function building(b) {
    const {x,y,width:w,depth:d,tint:i}=b;
    const home=b.kind==='home', market=b.visualRole==='market', floors=home?b.floors:market?1:2;
    const h=home?floors*4.1+1:market?9:12, pitch=Math.min(4,d*.28);
    const facade=['#c67c50','#c08a63','#cc9061','#b87150'][i];
    const roof=['#a05f49','#b37053','#a96c53','#985d4c'][i];
    const face=(u,z,width,height,fill)=>polygon([[u,y+d,z],[u+width,y+d,z],[u+width,y+d,z+height],[u,y+d,z+height]],fill);
    let g=land(x-1,y-1,w+2,d+2,'#c4ad90');
    g+=face(x,0,w,h,facade)+polygon([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,h],[x+w,y,h]],'#996747');
    g+=face(x,0,w,.85,'#9e775a');
    for(let f=0;f<floors;f++){
      const z=1.3+f*(home?4.1:5.1);
      for(let u=x+1.8;u<x+w-2.5;u+=5.1){
        if(f===0&&Math.abs(u-b.entrance.x)<3.2)continue;
        g+=face(u,z,2.8,home?2.9:3.8,'#e5ae78')+face(u+.18,z+.25,2.4,home?2.45:3.35,(Math.floor(u-x)+f+i)%8===0?'#f6ce78':'#494a44');
        if(f>0&&(Math.floor(u-x)+i)%4===0)g+=face(u-.4,z-.3,3.6,.85,'#af7450');
      }
      for(let v=y+2;v<y+d-2;v+=4.8)g+=polygon([[x+w,v,z],[x+w,v+1.9,z],[x+w,v+1.9,z+2.5],[x+w,v,z+2.5]],'#585042');
    }
    g+=face(b.entrance.x-1.3,0,2.6,3.6,'#524b40');
    const l=x-.75,r=x+w+.75,t=y-.75,bt=y+d+.75;
    const ridge1=[x+2,y+d/2,h+pitch],ridge2=[x+w-2,y+d/2,h+pitch];
    g+=polygon([[l,t,h],[r,t,h],ridge2,ridge1], '#bd8262')
      +polygon([[l,t,h],ridge1,[l,bt,h]],'#cd8d68')
      +polygon([[r,t,h],[r,bt,h],ridge2],'#815647')
      +polygon([[l,bt,h],ridge1,ridge2,[r,bt,h]],roof);
    const cx=x+w*.63,cy=y+d*.55,cz=h+pitch-.5;
    g+=polygon([[cx,cy,cz],[cx+1.7,cy,cz],[cx+1.7,cy,cz+2.7],[cx,cy,cz+2.7]],'#795947')
      +polygon([[cx+1.7,cy,cz+2.7],[cx,cy,cz+2.7],[cx,cy+1.5,cz+2.7],[cx+1.7,cy+1.5,cz+2.7]],'#c18d66');
    if(market)for(let u=0;u<w;u+=2.8){
      const v=Math.min(w,u+2.8);
      g+=polygon([[x+u,y+d,7],[x+v,y+d,7],[x+v,y+d+4.2,5.3],[x+u,y+d+4.2,5.3]],
        Math.round(u/2.8)%2?'#ffdfa6':'#d6773e');
    }
    return g;
  }
  function tree(x,y,i) {
    const k=.85+i*.13;
    let garden='';
    if(i===2) { // Small courtyard furniture provides a scale cue for the nearby walking residents.
      garden=land(x+2,y-7,11,7,'#b9a77e')+line([[x+4,y-5,0],[x+4,y-5,1.6]],'#625441',.8)
        +line([[x+9,y-5,0],[x+9,y-5,1.6]],'#625441',.8)+land(x+3,y-5.5,7.5,1.65,'#ad693d',1.65)
        +polygon([[x+3,y-5.5,2],[x+10.5,y-5.5,2],[x+10.5,y-5.5,3.4],[x+3,y-5.5,3.4]],'#bf834b');
      for(const [u,v] of [[5,3],[7,3.8],[8,2],[9.5,3.1]])
        garden+=place(x+u,y+v,'<path d="M-2 0l-.8-2 2-1.6 2.2.7L3 0Z" fill="#78824a"/><circle cx="1" cy="-1.9" r=".6" fill="#ffcd78"/>');
    }
    return garden+place(x,y,`<g transform="scale(${k})"><path d="M0 0l14 2 3 3-12-1Z" fill="#685f45" opacity=".28"/>
      <path d="M-.85 0l.15-9h1.4L1 0Z" fill="#70533a"/><path d="M0-3l-3-5m3 4 3-5" stroke="#70533a"/>
      <path d="M-6-8l-1-5 4-6 4-1 5 4 2 6-4 4-6 1Z" fill="#737a42"/>
      <path d="M-7-13l4-6 4-1-2 8Z" fill="#b2ae5a"/><path d="M-7-13l6 1-1 7-4-3Z" fill="#929a4f"/>
      <path d="M1-20l5 4-7 4Z" fill="#9a9e4e"/><path d="M6-16l2 6-4 4-5-6Z" fill="#69783d"/></g>`);
  }
  function shelter(s,lanes=false) {
    const {x,y}=s.sidewalk, l=x-5,r=x+2,t=y-2,b=y+1.8;
    const crosswalk=lanes?'':Array.from({length:5},(_,i)=>land(x+6,s.y-4+i*1.8,2.6,.64,'#dbcbb2')).join('');
    return `<g pointer-events="none">${crosswalk}${land(l-1,t-1,9,6,'#c9b196')}${
      [[l,t],[r,t],[l,b],[r,b]].map(([u,v])=>line([[u,v,0],[u,v,5]],'#594b41',.65)).join('')
    }${land(l,t+.5,6.8,1,'#bb8049',1.6)}${polygon([[l-1,t-1,5.3],[r+1,t-1,5.3],[r+1,b+1,5.8],[l-1,b+1,5.8]],'#79685a')}${line([[l-1,b+1,5.8],[r+1,b+1,5.8]],'#e2c291',.7)}</g>`;
  }
  a.building=building;a.tree=tree;
  LastTram.prototypeShelter=shelter;
})();
