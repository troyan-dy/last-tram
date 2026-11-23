// Throwaway camera/HUD study. All actions affect only this tab's in-memory city.
(() => {
  const LT=LastTram, $=id=>document.getElementById(id), svg=$('map');
  const game=LT.startGame(LT.createCity('Клён'));
  const meter=LT.distanceMeter(game);
  for(let i=0;i<365;i++)meter.step();
  const stops=game.city.stops.filter(s=>!s.ring);
  const stop=id=>game.lookup.stops.get(id), building=id=>game.lookup.buildings.get(id);
  const link=(a,b)=>game.city.edges.find(e=>(e.a===a && e.b===b)||(e.a===b && e.b===a));
  // A prepared block lets the player try a loop immediately. The other block still needs track.
  const demo=['Рынок','Сквер','Типография','Площадь'].map(name=>stops.find(s=>s.name===name).id);
  for(let i=1;i<demo.length;i++)game.trackIds.add(link(demo[i-1],demo[i]).id);
  const names={build:'Строительство',stops:'Остановки',routes:'Маршруты',flows:'Потоки'};
  let mode='', place=game.city.starterStops.at(-1), first='', edge='', route=game.routes[0].id, draft=[], loop=false;
  let note='', person=null, renderingGame, previous=new Map(), sprites=[], paused=false, carry=0, last=null;
  const map=LT.createMap(svg,selectObject);
  let decoratedSigns;
  const point=p=>LT.art.project(p.x,p.y);
  const choices=(items,value)=>items.map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
  const availableEdges=()=>game.city.edges.filter(e=>!game.trackIds.has(e.id)&&stops.includes(stop(e.a))&&stops.includes(stop(e.b)));
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
    map.render(renderingGame,null,{enabled:false},mode==='stops'?{type:'stop',id:place}:null);
    const signs=svg.querySelector('.signs');
    if(signs.firstElementChild!==decoratedSigns){
      decoratedSigns=signs.firstElementChild;
      for(const g of signs.querySelectorAll('[data-type="stop"]'))
        g.insertAdjacentHTML('afterbegin',LT.prototypeShelter(stop(g.dataset.id)));
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
  function overlay() {
    let out='';
    const segment=(a,b,color,dash='')=>`<polyline points="${xy(a)} ${xy(b)}" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".82" stroke-dasharray="${dash}"/>`;
    const dot=(id,txt)=>`<g transform="translate(${xy(id)})"><circle r="5" fill="#ffedbd" stroke="#29584c" stroke-width="1.5"/><text class="flow-mark" x="7" y="-5">${txt}</text></g>`;
    if(mode==='build'){
      for(const e of availableEdges())if(!first||e.a===first||e.b===first)
        out+=segment(e.a,e.b,e.id===edge?'#ab502c':'#688269',e.id===edge?'4 1':'1 4');
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
    if(mode==='stops') out+=dot(place,stop(place).name);
    if(mode==='flows') {
      const counts=destinations();
      for(const [id,n] of counts) {
        if(id!==place) out+=segment(place,id,'#547ba1','2 4');
        out+=dot(id,`${stop(id).name} · ${n}`);
      }
      out+=dot(place,`Из района ${stop(place).name}`);
    }
    $('layer').innerHTML=out;
    if(mode==='build'||mode==='routes'){
      $('targets').innerHTML=stops.map(s=>{
        const n=draft.indexOf(s.id), selected=mode==='routes'?n>=0:s.id===first;
        const text=mode==='routes'&&selected?`${n+1} · ${s.name}`:s.name;
        const start=mode==='routes'&&n===0, edge=start?'#ffbc54':'#f6e4c6';
        return `<g data-type="stop" data-id="${s.id}" role="button" tabindex="0" aria-label="${s.name}" transform="translate(${xy(s.id)})">
          <rect x="-7" y="-22" width="${text.length*3.6+18}" height="24" rx="5" fill="transparent"/>
          ${start?'<ellipse rx="6" ry="2.2" fill="none" stroke="#ffbc54" stroke-width="1.25"/>':''}
          <path d="M-2 -9L0 -1 3 -9" fill="#423a31" stroke="${edge}" stroke-width=".85"/>
          <rect x="-5" y="-20" width="${text.length*3.6+10}" height="12" rx="3" fill="${selected?'#37322c':'#f2ddbb'}" stroke="${edge}" stroke-width="${start?1.65:1}"/>
          <text x="-.5" y="-11.5" fill="${selected?'#fff1d7':'#493e30'}" font-family="system-ui" font-size="6" font-weight="700">${text}</text></g>`;
      }).join('');
    } else $('targets').replaceChildren();
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
    mode=m;note='';person=null;
    if(mode==='build'){edge='';first='';}
    svg.dataset.mode=mode;
    for(const b of $('modes').children) b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
    panel();sample();draw(carry);overlay();
  }
  function panel() {
    $('panel').hidden=!mode; if(!mode)return;
    $('title').textContent=names[mode];
    const pickPlace=label=>`<label>${label}<select id="district">${choices(stops.map(s=>[s.id,s.name]),place)}</select></label>`;
    let h='';
    if(mode==='build'){
      const selected=game.lookup.edges.get(edge);
      h=availableEdges().length?`<p>${!first?'Нажмите на начало пунктирного участка на карте.':!selected?`Откуда: <b>${stop(first).name}</b>. Нажмите на соседнюю остановку в конце пунктира.`:`<b>${stop(first).name} → ${stop(selected.a===first?selected.b:selected.a).name}</b>`}</p>
        ${selected?`<button id="buy-track">Построить · ${LT.BALANCE.trackCost} ₽</button>`:''}
        ${first?'<button id="reset-build">Выбрать заново</button>':''}`:'<p>Все соседние остановки центра уже соединены путями.</p>';
    } else if(mode==='stops'){
      const lines=game.routes.filter(r=>r.stopIds.includes(place));
      h=pickPlace('Остановка на карте')+`<p>Здесь останавливаются: <b>${lines.map(r=>r.name).join(', ')||'пока ни одной линии'}</b>.</p><button id="edit-service">Изменить обслуживание</button>`;
    } else if(mode==='routes'){
      h=`<div class="lines">${game.routes.map(r=>`<button data-line="${r.id}" aria-pressed="${route===r.id}">${r.name}</button>`).join('')}
        <button id="new-route">+ Новый маршрут</button></div>
        <p><b>${loop?'↻ Кольцевой':draft.length>=2?'↔ Туда и обратно':'Новый маршрут'}</b><br>
        ${[...draft,...(loop?[draft[0]]:[])].map(id=>stop(id).name).join(' → ')||'Нажмите первую остановку на карте.'}</p>
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
  function selectObject(type,id){
    if((mode==='build'||mode==='routes') && type!=='stop')return;
    if(type==='stop') {
      if(mode==='routes'){
        note='';
        if(loop)note='Сначала разомкните маршрут, чтобы изменить порядок.';
        else if(id===draft[0] && draft.length>=3){
          loop=!!LT.loopPaths(game,draft);
          if(!loop)note='Нет отдельного пути обратно. Для кольца достройте рельсы; пока маршрут работает туда и обратно.';
        } else if(draft.includes(id))note='Остановка уже выбрана. Для кольца нужны хотя бы три разные остановки.';
        else if(draft.length && !LT.railPath(game,draft.at(-1),id))note='Сюда пока нет рельсов от последней остановки. Сначала постройте путь.';
        else draft.push(id);
      }
      else if(mode==='flows'){place=id;person=null;}
      else if(mode==='build'){
        note='';edge='';
        if(!first){
          if(availableEdges().some(e=>e.a===id||e.b===id))first=id;
          else note='Здесь все соседние участки построены. Выберите конец пунктира.';
        }else if(id===first)first='';
        else {
          const e=link(first,id);
          if(!e)note='Это не соседние остановки. Выберите другой конец пунктира.';
          else if(game.trackIds.has(e.id))note='Между этими остановками уже есть путь.';
          else edge=e.id;
        }
      }
      else {place=id;setMode('stops');return;}
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
    if(id==='buy-track'){result=LT.buildTrack(game,edge);if(result.ok){first='';edge='';}}
    else if(id==='reset-build'){first='';edge='';}
    else if(id==='edit-service'){const r=game.routes.find(r=>r.stopIds.includes(place));setMode('routes');pickRoute(r?.id||'');}
    else if(id==='new-route'||e.target.dataset.line)pickRoute(e.target.dataset.line||'');
    else if(id==='undo'){if(loop)loop=false;else draft.pop();}
    else if(id==='save'){result=route?LT.setStops(game,route,draft,loop):LT.createRoute(game,draft,loop);if(result.routeId)pickRoute(result.routeId);}
    else if(id==='buy-train')result=LT.buyTrain(game,route);
    else return;
    note=result?(result.ok?({save:'Маршрут сохранён.','buy-track':'Путь построен.','buy-train':'Трамвай добавлен в парк.'}[id]):result.message):'';
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
  pickRoute(route);previous=positions();viewAngle();setMode('');moneyTime();requestAnimationFrame(frame);
})();
