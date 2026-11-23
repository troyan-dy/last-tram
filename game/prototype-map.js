// Throwaway camera/HUD study. All actions affect only this tab's in-memory city.
(() => {
  const LT=LastTram, $=id=>document.getElementById(id), svg=$('map');
  const query=new URLSearchParams(location.search),lanes=query.get('plan')!=='grid',seed=(query.get('seed')||'Клён').slice(0,60);
  const emptyStart=lanes&&query.get('start')!=='line';
  const game=lanes?LT.startGame(LT.streetStudy.create(seed),{openLine:emptyStart?()=>{}:LT.streetStudy.openLine}):LT.startGame(LT.createCity(seed));
  function openSeed(value){
    const url=new URL(location.href);url.searchParams.set('seed',value.trim()||'Клён');location.assign(url.href);
  }
  $('layout-seed').value=game.city.seed;
  $('seed-select').onsubmit=e=>{e.preventDefault();openSeed($('layout-seed').value);};
  $('roll-city').onclick=()=>openSeed(String(crypto.getRandomValues(new Uint32Array(1))[0]));
  const comparison=new URL(location.href);
  if(lanes)comparison.searchParams.set('plan','grid');else comparison.searchParams.delete('plan');
  $('compare-plan').href=comparison.href;
  $('compare-plan').textContent=lanes?'Сравнить с сеткой':'Открыть переулки';
  const otherStart=new URL(location.href);otherStart.searchParams.delete('plan');
  otherStart.searchParams.set('start',emptyStart?'line':'empty');
  $('change-start').href=otherStart.href;$('change-start').textContent=emptyStart?'Новая партия с готовой линией':'Начать с пустой сети';
  $('plan-name').textContent=`${game.city.seed} · ${lanes?'ПЕРЕУЛКИ':'СЕТКА'} · 39°`;
  const meter=LT.distanceMeter(game);
  if(!emptyStart)for(let i=0;i<365;i++)meter.step();
  const accessible=()=>(lanes?game.city.study.platforms:game.city.stops).filter(s=>s.ring<=game.openRing&&!s.junction);
  let districts=accessible();
  const stations=()=>game.city.stops.filter(s=>s.ring<=game.openRing&&(lanes?s.passengerStop:!s.junction));
  const stop=id=>game.lookup.stops.get(id), building=id=>game.lookup.buildings.get(id);
  const stopName=id=>stop(id).stopName??stop(id).name;
  const sections=lanes?game.city.study.sections:game.city.edges;
  const section=id=>sections.find(e=>e.id===id);
  const built=e=>(e.parts||[e.id]).every(id=>game.trackIds.has(id));
  const lay=e=>{for(const id of e.parts||[e.id])game.trackIds.add(id);};
  const names={build:'Строительство',stops:'Остановки',routes:'Маршруты',flows:'Потоки'};
  let mode='', place=game.city.starterStops.at(-1),selected=stations()[0]?.id,route=game.routes[0]?.id||'', draft=[], loop=false;
  let note='', person=null, renderingGame, previous=new Map(), sprites=[], paused=false, carry=0, last=null;
  const map=LT.createMap(svg,selectObject);
  let decoratedSigns;
  const point=p=>LT.art.project(p.x,p.y);
  const choices=(items,value)=>items.map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
  const visibleSections=()=>sections.filter(e=>stop(e.a).ring<=game.openRing&&stop(e.b).ring<=game.openRing);
  function moneyTime() {
    $('cash').textContent=`${game.cash} ₽`; $('fleet').textContent=game.trains.length;
    $('clock').textContent=LT.stamp(LT.clockMinute(game));
    const {walk,tram}=meter.totals, total=walk+tram, share=Math.round(100*tram/total);
    $('shares').textContent=total?`${100-share}% пешком · ${share}% на трамвае`:'Ещё нет перемещений';
  }
  function positions() {
    return new Map([...game.trains,...game.residents].map(o=>[o.id,{...o.position}]));
  }
  function sample() {
    map.render(renderingGame,null,{enabled:false},mode==='stops'&&selected?{type:'stop',id:selected}:null);
    const signs=svg.querySelector('.signs');
    if(signs.firstElementChild!==decoratedSigns){
      decoratedSigns=signs.firstElementChild;
      for(const g of signs.querySelectorAll('[data-type="stop"]'))
        g.insertAdjacentHTML('afterbegin',LT.prototypeShelter(stop(g.dataset.id),lanes));
    }
    const now=positions();
    sprites=[...$('moving').children].map(node=>{
      const id=node.dataset.id, to=now.get(id), from=previous.get(id)||to;
      return {node,id,from:point(from),to:point(to)};
    });
  }
  function draw(alpha) {
    for(const {node,from,to} of sprites)
      node.setAttribute('transform',`translate(${from[0]+(to[0]-from[0])*alpha} ${from[1]+(to[1]-from[1])*alpha})`);
  }
  function viewAngle() {
    const a=39*Math.PI/180;
    // Reflect the two street axes, not the screen: people, type and roof heights stay upright.
    LT.prototypeProject=(x,y,z)=>[
      1.85*(-x*Math.cos(a)+y*Math.sin(a)), x*Math.sin(a)+y*Math.cos(a)-1.28*z
    ];
    renderingGame=Object.create(game); sample(); draw(carry); overlay();
  }
  const xy=id=>point(stop(id)).join(',');
  const roadPoints=e=>e.line||[stop(e.a),stop(e.b)];
  function halfWay(points){
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
    let left=lengths.reduce((a,b)=>a+b,0)/2;
    for(let i=0;i<lengths.length;i++){
      if(left<=lengths[i]){const t=left/lengths[i],a=points[i],b=points[i+1];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
      left-=lengths[i];
    }
    return points.at(-1);
  }
  function roadTarget(e){
    const points=roadPoints(e),line=points.map(p=>point(p).join(',')).join(' '),on=built(e),buy=mode==='build';
    const cost=LT.BALANCE.trackCost,action=buy?(on?'Путь построен':`Построить за ${cost} ₽`):'Поставить остановку';
    const price=buy&&!on?`<g transform="translate(${point(halfWay(points))})"><rect x="-8" y="-3.9" width="16" height="7.8" rx="2.4"/>
      <text class="price" text-anchor="middle" y="1.7">${cost} ₽</text></g>`:'';
    const pavement=lanes?`<polygon points="${LT.streetStudy.bandPolygon(points,e.width+4).map(p=>point(p).join(',')).join(' ')}" fill="transparent"/>`:'';
    return `<g data-type="section" data-id="${e.id}" tabindex="0" role="button" data-built="${on}" aria-label="${action}: ${stop(e.a).name} — ${stop(e.b).name}">
      <title>${action}</title>${pavement}<polyline class="road-ink" points="${line}"/><polyline class="street-hit" points="${line}"/>${price}</g>`;
  }
  function snapClick(e,at){
    const line=roadPoints(e);
    if(!at)return halfWay(line);
    let chosen,near=Infinity;
    for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],[x,y]=point(a),[v,w]=point(b),dx=v-x,dy=w-y;
      const t=Math.max(0,Math.min(1,((at.x-x)*dx+(at.y-y)*dy)/(dx*dx+dy*dy||1)));
      const d=Math.hypot(at.x-x-t*dx,at.y-y-t*dy);
      if(d<near){near=d;chosen={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
    }
    return chosen;
  }
  const ghost=$('stop-preview'),hideGhost=()=>ghost.setAttribute('visibility','hidden');
  svg.addEventListener('pointermove',e=>{
    const road=e.target.closest('[data-type=section]');
    if(e.buttons||e.pointerType==='touch'||mode!=='stops'||!road)return hideGhost();
    const at=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const s=section(road.dataset.id);
    ghost.setAttribute('transform',`translate(${point(LT.streetStudy.stopSite(s,snapClick(s,at)).q)})`);
    ghost.setAttribute('visibility','visible');
  });
  svg.addEventListener('pointerleave',hideGhost);
  function overlay() {
    let out='';
    const segment=(a,b,color,dash='')=>`<polyline points="${xy(a)} ${xy(b)}" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".82" stroke-dasharray="${dash}"/>`;
    const dot=(id,txt)=>`<g transform="translate(${xy(id)})"><circle r="5" fill="#ffedbd" stroke="#29584c" stroke-width="1.5"/><text class="flow-mark" x="7" y="-5">${txt}</text></g>`;
    if(lanes&&mode==='build'){
      const seen=new Set(),joined=new Set();
      for(const s of visibleSections().filter(built))for(const p of s.line){
        if(!p.junctionRadius)continue;
        if(seen.has(p))joined.add(p);else seen.add(p);
      }
      for(const p of joined)out+=`<circle class="rail-junction" cx="${point(p)[0]}" cy="${point(p)[1]}" r="2.4" fill="#fff2ce" stroke="#426653" stroke-width="1.3"/>`;
    }
    if(mode==='routes') {
      const paths=loop?LT.loopPaths(game,draft):draft.slice(1).map((s,i)=>LT.railPath(game,draft[i],s));
      for(const path of paths||[]){
        if(path) for(let i=1;i<path.length;i++){
          const a=point(stop(path[i-1])),b=point(stop(path[i]));
          const angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
          out+=segment(path[i-1],path[i],'#815734')+`<path d="M-4 -2H0V-3.8L5 0 0 3.8V2H-4Z" transform="translate(${(a[0]+b[0])/2} ${(a[1]+b[1])/2}) rotate(${angle})" fill="#fff4d8" stroke="#624c3a" stroke-width=".45"/>`;
        }
      }
    }
    if(mode==='flows') {
      const counts=destinations();
      for(const [id,n] of counts) {
        if(id!==place) out+=segment(place,id,'#547ba1','2 4');
        out+=dot(id,`${stop(id).name} · ${n}`);
      }
      out+=dot(place,`Из района ${stop(place).name}`);
    }
    $('layer').innerHTML=out;
    const roads=mode==='build'||(mode==='stops'&&lanes)?visibleSections().map(roadTarget).join(''):'';
    if(mode==='stops'||mode==='routes'){
      const list=stations(),view=svg.viewBox.baseVal;
      const layout=LT.thoughtLayout({x:view.x,y:view.y,w:view.width,h:view.height});
      for(const s of list)layout.person(...point(s));
      $('targets').innerHTML=roads+list.map(s=>{
        const n=draft.indexOf(s.id), chosen=mode==='routes'?n>=0:s.id===selected;
        const text=mode==='routes'&&chosen?`${n+1} · ${stopName(s.id)}`:stopName(s.id);
        const start=mode==='routes'&&n===0, edge=start?'#ffbc54':'#f6e4c6';
        const [x,y]=point(s),box=layout.place(x,y,text.length*3.6+10,13);
        const left=box.x-x,top=box.y-y,tipX=Math.max(left+2,Math.min(0,left+box.w-2));
        return `<g transform="translate(${xy(s.id)})">
          ${start?'<ellipse rx="6" ry="2.2" fill="none" stroke="#ffbc54" stroke-width="1.25"/>':''}
          <path d="M0 0 L${tipX} ${top<0?top+box.h:top}" fill="none" stroke="#695844" stroke-width=".9" pointer-events="none"/>
          <circle data-stop-anchor="${s.id}" r="2.8" fill="#524535" stroke="${edge}" stroke-width=".8"/>
          <g data-type="stop" data-id="${s.id}" role="button" tabindex="0" aria-label="${stopName(s.id)}">
          <rect class="station-tag" x="${left}" y="${top}" width="${box.w}" height="${box.h}" rx="3" fill="${chosen?'#37322c':'#f2ddbb'}" stroke="${edge}" stroke-width="${start?1.65:1}"/>
          <text x="${left+4}" y="${top+8.6}" fill="${chosen?'#fff1d7':'#493e30'}" font-family="system-ui" font-size="6" font-weight="700" pointer-events="none">${text}</text></g></g>`;
      }).join('');
    } else $('targets').innerHTML=roads;
  }
  function destinations() {
    const counts=new Map();
    for(const {journey:j} of game.residents) if(j && building(j.originId).stopId===place){
      const id=building(j.destinationId).stopId;counts.set(id,1+(counts.get(id)||0));
    }
    return [...counts].sort((a,b)=>b[1]-a[1]);
  }
  function pickRoute(id){const r=game.routes.find(r=>r.id===id);route=id;draft=[...(r?.stopIds||[])];loop=!!r?.loop;note='';}
  function setMode(m) {
    mode=m;note='';person=null;hideGhost();
    svg.dataset.mode=mode;
    for(const b of $('modes').children) b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
    panel();sample();draw(carry);overlay();
  }
  function panel() {
    $('panel').hidden=!mode; if(!mode)return;
    $('title').textContent=names[mode];
    const pickPlace=label=>`<label>${label}<select id="district">${choices(districts.map(s=>[s.id,s.name]),place)}</select></label>`;
    let h='';
    if(mode==='build'){
      h=(visibleSections().some(e=>!built(e))?'<p>Нажмите на дорогу или ценник, чтобы купить путь.</p>':'<p>На всех доступных улицах уже есть рельсы.</p>')+
        (lanes?'<p class="muted">Светлая точка на перекрёстке — соединение построенных путей. Для поворота остановка не нужна.</p>':'');
    } else if(mode==='stops'){
      const lines=game.routes.filter(r=>r.stopIds.includes(selected));
      h=lanes?'<p>Нажмите на улицу в том месте, где нужен павильон. Остановка появится здесь; рельсы покупаются отдельно.</p>':'<p>Нажмите на остановку на карте.</p>';
      if(selected)h+=`<p><b>${stopName(selected)}</b> · ${lines.map(r=>r.name).join(', ')||'пока без маршрута'}</p><button id="edit-service">Изменить обслуживание</button>`;
    } else if(mode==='routes'){
      h=`<div class="lines">${game.routes.map(r=>`<button data-line="${r.id}" aria-pressed="${route===r.id}">${r.name}</button>`).join('')}
        <button id="new-route">+ Новый маршрут</button></div>
        <p><b>${loop?'↻ Кольцевой':draft.length>=2?'↔ Туда и обратно':'Новый маршрут'}</b><br>
        ${[...draft,...(loop?[draft[0]]:[])].map(stopName).join(' → ')||(stations().length<2?'Сначала поставьте две остановки в режиме «Остановки».':'Нажмите первую остановку на карте.')}</p>
        <p class="muted">${loop?'После последней остановки поезд возвращается к первой и начинает следующий круг.':'Нажимайте остановки по порядку. Чтобы замкнуть кольцо, снова нажмите первую.'}</p>
        ${draft.length?`<button id="undo">${loop?'Разомкнуть':'Убрать последнюю'}</button>`:''}
        <button id="save" ${draft.length<2?'disabled':''}>Сохранить</button>
        ${route?`<button id="buy-train">Купить трамвай · ${LT.BALANCE.trainCost} ₽</button>`:''}`;
    } else {
      h=pickPlace('Откуда идут жители')+'<div id="flow-info"></div><p class="muted">Пунктир соединяет районы отправления и назначения. Нажмите на прохожего, чтобы посмотреть его путь.</p>';
    }
    $('content').innerHTML=h+'<p class="msg" role="status"></p>';
    $('content').querySelector('.msg').textContent=note;
    flowInfo();
  }
  function flowInfo() {
    if(mode!=='flows')return;
    const r=person&&game.residents.find(r=>r.id===person), j=r?.journey||r?.lastJourney;
    $('flow-info').innerHTML='<p><b>В пути сейчас:</b> '+(destinations().map(([id,n])=>`${stop(id).name} — ${n}`).join(', ')||'из района никто не идёт')+'.</p>'+
      (j?`<p><b>${r.name}</b>: ${building(j.originId).name} → ${building(j.destinationId).name}, ${j.mode==='tram'?'с трамваем':'пешком'}.</p>`:'');
  }
  function selectObject(type,id,group,at){
    if(type==='section'){
      const e=section(id);
      if(!e || !visibleSections().includes(e))return;
      if(mode==='build'){
        if(built(e))note='Этот путь уже построен.';
        else if(game.cash<LT.BALANCE.trackCost)note=`Не хватает ${LT.BALANCE.trackCost-game.cash} ₽.`;
        else {lay(e);game.cash-=LT.BALANCE.trackCost;note=`Путь построен · −${LT.BALANCE.trackCost} ₽.`;moneyTime();}
      }else if(mode==='stops'&&lanes){
        hideGhost();
        const result=LT.streetStudy.placeStop(game,e,snapClick(e,at));
        if(result.ok)selected=result.id;
        note=result.ok?`Поставлена остановка «${result.name}».`:result.message;
      }else return;
    }else if((mode==='build'||mode==='routes'||mode==='stops')&&type!=='stop')return;
    else if(type==='stop') {
      if(mode==='routes'){
        note='';
        if(loop)note='Сначала разомкните маршрут, чтобы изменить порядок.';
        else if(id===draft[0] && draft.length>=3){
          loop=!!LT.loopPaths(game,draft);
          if(!loop)note='Нет отдельного пути обратно. Для кольца достройте рельсы; пока маршрут работает туда и обратно.';
        } else if(draft.includes(id))note='Остановка уже выбрана. Для кольца нужны хотя бы три разные остановки.';
        else if(draft.length && !LT.railPath(game,draft.at(-1),id)){
          const from=draft.at(-1);
          const bare=[from,id].find(p=>!game.city.edges.some(e=>game.trackIds.has(e.id)&&(e.a===p||e.b===p)));
          note=bare?`У остановки «${stopName(bare)}» пока нет рельсов.`:
            `Между остановками «${stopName(from)}» и «${stopName(id)}» нет непрерывного пути.`;
        }
        else draft.push(id);
      }
      else if(mode==='flows'){place=districts.find(s=>s.districtId===stop(id).districtId)?.id??place;person=null;}
      else if(mode==='build')return;
      else {selected=id;setMode('stops');return;}
    } else if(type==='resident'||type==='building'){
      const r=type==='resident'?game.residents.find(r=>r.id===id):null;
      place=building(r?(r.journey?.originId||r.homeId):id).stopId;
      if(mode!=='flows')setMode('flows');
      person=r?.id||null;
    } else if(type==='train'){setMode('routes');pickRoute(game.trains.find(t=>t.id===id).assignedRouteId);}
    panel();sample();draw(carry);overlay();
  }
  $('content').onchange=e=>{
    const {id,value}=e.target;note='';person=null;
    if(id==='district')place=value;
    panel();sample();draw(carry);overlay();
  };
  $('content').onclick=e=>{
    const id=e.target.id;let result;
    if(id==='edit-service'){const r=game.routes.find(r=>r.stopIds.includes(selected));setMode('routes');pickRoute(r?.id||'');if(!r&&selected)draft.push(selected);}
    else if(id==='new-route'||e.target.dataset.line)pickRoute(e.target.dataset.line||'');
    else if(id==='undo'){if(loop)loop=false;else draft.pop();}
    else if(id==='save'){result=route?LT.setStops(game,route,draft,loop):LT.createRoute(game,draft,loop);if(result.routeId)pickRoute(result.routeId);}
    else if(id==='buy-train')result=LT.buyTrain(game,route);
    else return;
    note=result?(result.ok?({save:'Маршрут сохранён.','buy-train':'Трамвай добавлен в парк.'}[id]):result.message):'';
    moneyTime();panel();sample();draw(carry);overlay();
  };
  $('modes').onclick=e=>{const m=e.target.dataset.mode;if(m)setMode(m===mode?'':m);};
  $('close').onclick=()=>setMode('');
  $('plus').onclick=()=>map.zoomBy(1.4);$('minus').onclick=()=>map.zoomBy(1/1.4);$('fit').onclick=map.fit;
  $('pause').onclick=()=>{paused=!paused;last=null;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить':'Пауза');};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')setMode('');
  });
  function frame(ms) {
    if(!paused && last!==null) {
      carry+=Math.min(ms-last,200)*LT.BALANCE.ticksPerSecond/1000;
      if(carry>=1) {
        while(carry>=1){previous=positions();meter.step();carry--;}
        sample();moneyTime();if(mode==='flows'){flowInfo();overlay();}
      }
      draw(carry);
    }
    last=ms;requestAnimationFrame(frame);
  }
  pickRoute(route);previous=positions();viewAngle();setMode('');moneyTime();
  if(lanes){
    const reveal=LT.createStudyFog(svg,game.city.study,game.city.seed);
    $('fog-study').hidden=false;
    $('reveal-ring').onclick=()=>{
      if(game.openRing){openSeed(game.city.seed);return;}
      game.openRing=1;districts=accessible();sample();draw(carry);overlay();panel();reveal();
      $('zone-state').textContent='После расширения';
      $('reveal-ring').textContent='С начала · тот же сид';
      $('reveal-ring').title='Начать новую демонстрационную партию с тем же городом';
    };
  }
  requestAnimationFrame(frame);
})();
