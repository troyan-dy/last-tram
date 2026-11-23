// Throwaway camera/HUD study. All actions affect only this tab's in-memory city.
(() => {
  const LT=LastTram, $=id=>document.getElementById(id), svg=$('map');
  const game=LT.startGame(LT.createCity('Клён'));
  LT.advance(game,365); // Same morning, with both walkers and tram passengers already at their doors.
  const stops=game.city.stops.filter(s=>!s.ring);
  const stop=id=>game.lookup.stops.get(id), building=id=>game.lookup.buildings.get(id);
  const variants=[['A',12],['B',26],['C',39],['Исходный',null]];
  const names={build:'Строительство',stops:'Остановки',routes:'Маршруты',flows:'Потоки'};
  const initial=new URLSearchParams(location.search).get('variant');
  let variant=Math.max(0,variants.findIndex(([key])=>key===(initial||'B')));
  let mode='', place=game.city.starterStops.at(-1), edge='', route=game.routes[0].id, draft=[];
  let note='', person=null, renderingGame, previous=new Map(), sprites=[], paused=false, carry=0, last=null;
  const map=LT.createMap(svg,selectObject);
  const point=p=>LT.art.project(p.x,p.y);
  const choices=(items,value)=>items.map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
  const availableEdges=()=>game.city.edges.filter(e=>!game.trackIds.has(e.id)&&stops.includes(stop(e.a))&&stops.includes(stop(e.b)));
  const windowStart=()=>Math.max(0,game.tick-((LT.BALANCE.startMinute*LT.BALANCE.ticksPerMinute+game.tick)%(1440*LT.BALANCE.ticksPerMinute)));
  function moneyTime() {
    $('cash').textContent=`${game.cash} ₽`; $('fleet').textContent=game.trains.length;
    $('clock').textContent=LT.stamp(LT.clockMinute(game));
    const data=game.history.arrivals(windowStart(),game.tick+1), n=data.length;
    const tram=n?Math.round(100*data.filter(d=>d.mode==='tram').length/n):0;
    $('shares').previousElementSibling.textContent=LT.cityTime(game).day===1?'Прибытия с 07:30':'Прибытия сегодня';
    $('shares').textContent=n?`${100-tram}% пешком · ${tram}% с трамваем`:'Пока нет прибытий';
    $('shares').parentNode.title=`Из ${n} завершённых сегодня перемещений. Подход к остановке включён в «с трамваем».`;
  }
  function positions() {
    return new Map([...game.trains,...game.residents].map(o=>[o.id,{...o.position}]));
  }
  function sample() {
    map.render(renderingGame,null,{enabled:false},mode==='stops'?{type:'stop',id:place}:null);
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
  function viewAngle(change=0) {
    variant=(variant+change+variants.length)%variants.length;
    const [name,degrees]=variants[variant], a=degrees*Math.PI/180;
    // Reflect the two street axes, not the screen: people, type and roof heights stay upright.
    LT.prototypeProject=degrees===null?null:(x,y,z)=>[
      1.85*(-x*Math.cos(a)+y*Math.sin(a)), x*Math.sin(a)+y*Math.cos(a)-1.28*z
    ];
    $('variant').textContent=degrees===null?'Исходный':`${name} · ${degrees}° влево`;
    const url=new URL(location.href); url.searchParams.set('variant',name);
    if (location.protocol!=='file:') history.replaceState(null,'',url);
    renderingGame=Object.create(game); sample(); draw($('smooth').checked?carry:1); overlay();
  }
  const xy=id=>point(stop(id)).join(',');
  function overlay() {
    let out='';
    const segment=(a,b,color,dash='')=>`<polyline points="${xy(a)} ${xy(b)}" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".82" stroke-dasharray="${dash}"/>`;
    const dot=(id,txt)=>`<g transform="translate(${xy(id)})"><circle r="5" fill="#ffedbd" stroke="#29584c" stroke-width="1.5"/><text class="flow-mark" x="7" y="-5">${txt}</text></g>`;
    if(mode==='build' && edge){const e=game.lookup.edges.get(edge);out+=segment(e.a,e.b,'#b05a26','5 3');}
    if(mode==='routes') {
      for(let n=1;n<draft.length;n++){
        const path=LT.railPath(game,draft[n-1],draft[n]);
        if(path) for(let i=1;i<path.length;i++) out+=segment(path[i-1],path[i],'#14756b');
      }
      draft.forEach((id,i)=>out+=dot(id,`${i+1}`));
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
  }
  function destinations() {
    const counts=new Map();
    for(const {journey:j} of game.residents) if(j && building(j.originId).stopId===place){
      const id=building(j.destinationId).stopId;counts.set(id,1+(counts.get(id)||0));
    }
    return [...counts].sort((a,b)=>b[1]-a[1]);
  }
  function pickRoute(id){route=id;draft=[...(game.routes.find(r=>r.id===id)?.stopIds||[])];}
  function setMode(m) {
    mode=m;note='';person=null;
    if(mode==='routes')pickRoute(route || game.routes[0].id);
    if(mode==='build')edge=availableEdges()[0]?.id||'';
    for(const b of $('modes').children) b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
    panel();sample();draw($('smooth').checked?carry:1);overlay();
  }
  function panel() {
    $('panel').hidden=!mode; if(!mode)return;
    $('title').textContent=names[mode];
    const pickPlace=label=>`<label>${label}<select id="district">${choices(stops.map(s=>[s.id,s.name]),place)}</select></label>`;
    let h='';
    if(mode==='build'){
      h=`<p>Выберите участок. На карте появится пунктир будущего пути.</p><label>Участок пути<select id="edge">${choices(availableEdges().map(e=>[e.id,`${stop(e.a).name} — ${stop(e.b).name}`]),edge)}</select></label><button id="buy-track" ${edge?'':'disabled'}>Построить · ${LT.BALANCE.trackCost} ₽</button>`;
    } else if(mode==='stops'){
      const lines=game.routes.filter(r=>r.stopIds.includes(place));
      h=pickPlace('Остановка на карте')+`<p>Здесь останавливаются: <b>${lines.map(r=>r.name).join(', ')||'пока ни одной линии'}</b>.</p><button id="edit-service">Изменить обслуживание</button>`;
    } else if(mode==='routes'){
      h=`<label>Маршрут<select id="route">${choices([...game.routes.map(r=>[r.id,r.name]),['','Новый маршрут']],route)}</select></label>
        <p>${draft.map(id=>stop(id).name).join(' → ')||'Выберите первую остановку.'}</p>
        <label>Добавить остановку<select id="append-stop"><option value="">Выбрать…</option>${choices(stops.filter(s=>!draft.includes(s.id)).map(s=>[s.id,s.name]),'')}</select></label>
        <button id="undo" ${draft.length?'':'disabled'}>Убрать последнюю</button> <button id="save" ${draft.length<2?'disabled':''}>Сохранить</button>
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
    if(type==='stop') {
      if(mode==='routes'){if(!draft.includes(id))draft.push(id);note='';}
      else if(mode==='flows'){place=id;person=null;}
      else if(mode==='build'){const e=availableEdges().find(e=>e.a===id||e.b===id);if(e)edge=e.id;}
      else {place=id;setMode('stops');return;}
    } else if(type==='resident'||type==='building'){
      const r=type==='resident'?game.residents.find(r=>r.id===id):null;
      place=building(r?(r.journey?.originId||r.homeId):id).stopId;
      if(mode!=='flows')setMode('flows');
      person=r?.id||null;
    } else if(type==='train'){setMode('routes');pickRoute(game.trains.find(t=>t.id===id).assignedRouteId);}
    panel();sample();draw($('smooth').checked?carry:1);overlay();
  }
  $('content').onchange=e=>{
    const {id,value}=e.target;note='';person=null;
    if(id==='district')place=value;if(id==='edge')edge=value;if(id==='route')pickRoute(value);
    if(id==='append-stop'&&value)draft.push(value);
    panel();sample();draw($('smooth').checked?carry:1);overlay();
  };
  $('content').onclick=e=>{
    const id=e.target.id;let result;
    if(id==='buy-track'){result=LT.buildTrack(game,edge);if(result.ok)edge=availableEdges()[0]?.id||'';}
    else if(id==='edit-service'){const r=game.routes.find(r=>r.stopIds.includes(place));setMode('routes');pickRoute(r?.id||'');}
    else if(id==='undo')draft.pop();
    else if(id==='save'){result=route?LT.setStops(game,route,draft):LT.createRoute(game,draft);if(result.routeId)pickRoute(result.routeId);}
    else if(id==='buy-train')result=LT.buyTrain(game,route);
    else return;
    note=result?(result.ok?({save:'Маршрут сохранён.','buy-track':'Путь построен.','buy-train':'Трамвай добавлен в парк.'}[id]):result.message):'';
    moneyTime();panel();sample();draw($('smooth').checked?carry:1);overlay();
  };
  $('modes').onclick=e=>{const m=e.target.dataset.mode;if(m)setMode(m===mode?'':m);};
  $('close').onclick=()=>setMode('');
  $('prev').onclick=()=>viewAngle(-1);$('next').onclick=()=>viewAngle(1);
  $('plus').onclick=()=>map.zoomBy(1.4);$('minus').onclick=()=>map.zoomBy(1/1.4);$('fit').onclick=map.fit;
  $('pause').onclick=()=>{paused=!paused;last=null;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить':'Пауза');};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')setMode('');
    if(e.target.matches('input,select,textarea,[contenteditable]'))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();viewAngle(e.key==='ArrowLeft'?-1:1);}
  });
  function frame(ms) {
    if(!paused && last!==null) {
      carry+=Math.min(ms-last,200)*LT.BALANCE.ticksPerSecond/1000;
      if(carry>=1) {
        while(carry>=1){previous=positions();LT.advance(game,1);carry--;}
        sample();moneyTime();if(mode==='flows'){flowInfo();overlay();}
      }
      draw($('smooth').checked?carry:1);
    }
    last=ms;requestAnimationFrame(frame);
  }
  previous=positions();viewAngle();setMode('');moneyTime();requestAnimationFrame(frame);
})();
