(() => {
  'use strict';
  const LT = globalThis.LastTram, $ = id => document.getElementById(id);
  const safe = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  let game, focus, paused, speed, previous, carry, advanceTo;
  const map = LT.createMap($('map'), select);
  const updateNetwork=LT.createNetworkPanel(()=>game,render,select);
  const updateGoals=LT.createGoalsPanel($('goals-panel'),()=>game,render,select);
  const speeds = [1,4,12];
  const stamp = minute => `${String(Math.floor(minute/60)%24).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
  const dt = rows => `<dl>${rows.map(([a,b])=>`<div><dt>${safe(a)}</dt><dd>${safe(b)}</dd></div>`).join('')}</dl>`;
  function select(type,id) { focus={type,id}; render(); }
  function watch() {
    const first = game.residents.find(r=>r.journey && !r.onTrainId) ??
      game.residents.find(r=>game.lookup.buildings.get(r.homeId).ring<=game.openRing && !r.lastJourney) ?? game.residents[0];
    select('resident',first.id);
  }

  function inspector() {
    let heading='Наблюдение', detail='<p>Нажмите на прохожего на карте, чтобы увидеть, куда он направляется.</p>';
    if (focus?.type==='resident') {
      const r=game.residents.find(p=>p.id===focus.id);
      const j=r.journey, trip=j??r.lastJourney;
      const leg=j?.legs[j.leg];
      const action=!j ? (trip?'У двери места назначения':'Дома, готовится выйти') :
        leg.type==='ride'?'В вагоне':leg.type==='wait'?'Ждёт поезд на остановке':
        j.mode==='tram' && !j.leg?'Идёт к остановке':'Идёт к двери';
      heading=r.name;
      detail=`<p class="status" data-action="${j?'moving':trip?'arrived':'home'}">${action}</p>`+dt([
        ['Откуда',game.lookup.buildings.get(trip?.originId??r.homeId).name],
        ['Цель',game.lookup.buildings.get(trip?.destinationId??r.workId).name],
        ['Весь путь',!trip?'Ещё не вышел':trip.mode==='tram'?'С трамваем':'Пешком'],
        ...(r.lastJourney && !j ? [['Прибытие',stamp(LT.BALANCE.startMinute+Math.floor(r.lastJourney.arrivedAt/LT.BALANCE.ticksPerMinute))]]:[])
      ]);
      const preview=!trip && LT.planJourney(game,r,game.lookup.buildings.get(r.homeId),game.lookup.buildings.get(r.workId));
      detail+=LT.choiceCard((trip||preview).decision,(trip||preview).mode,!trip,dt);
    } else if (focus?.type==='building') {
      const b=game.lookup.buildings.get(focus.id);
      heading=b.name; detail=dt([['Назначение',b.kind==='home'?'Жилой дом':'Место работы'],
        ['Район',game.lookup.stops.get(b.stopId).name],['У двери',game.residents.filter(r=>r.currentBuildingId===b.id).length]]);
    } else if (focus?.type==='stop') {
      const s=game.lookup.stops.get(focus.id);
      heading=s.name; detail=dt([['Остановка',game.routes.filter(r=>r.stopIds.includes(s.id)).map(r=>r.name).join(', ') || 'Нет маршрута']]);
    } else if (focus?.type==='train') {
      const train=game.trains.find(t=>t.id===focus.id), route=game.routes.find(r=>r.id===train.routeId);
      heading=train.name; detail=dt([['Сейчас',route?.name??'Перегон без пассажиров'],
        ['Назначение',game.routes.find(r=>r.id===train.assignedRouteId)?.name??'Не назначен'],['Вагонов',train.cars],
        ['В салоне',game.residents.filter(r=>r.onTrainId===train.id).length]]);
    }
    const html=`<div class="kicker">02 <span>/</span> ФОКУС КАРТЫ</div><h2>${safe(heading)}</h2>${detail}
      <button type="button" data-watch>Найти жителя <span aria-hidden="true">→</span></button>`;
    const panel=$('inspector');
    if (panel._content!==html) { panel.innerHTML=html; panel._content=html; }
    panel.dataset.id=focus?.id??'';
  }

  function render() {
    map.render(game,focus); inspector();
    $('clock').textContent=stamp(LT.clockMinute(game));
    const time=LT.cityTime(game);
    $('clock-period').textContent=`День ${time.day} · ${time.period.name}`;
    $('next-period').textContent=`К ${stamp(time.next.minute)} · ${time.next.name}`;
    $('next-period').disabled=advanceTo!==null;
    $('fleet').textContent=`Поездов: ${game.trains.length}`;
    $('zone-label').textContent=game.openRing ? `КОЛЬЦО / ${game.openRing}` : 'ЦЕНТР / 01';
    updateNetwork(game);
    updateGoals(game);
    $('resident-choice').value=focus?.type==='resident'?focus.id:'';
    const action=paused?'Продолжить':'Пауза';
    $('pause').setAttribute('aria-label',action); $('pause').title=action; $('pause').textContent=paused?'▶':'Ⅱ';
    $('speed').textContent=`${speed}×`;
  }
  function newGame(seed) {
    game=LT.startGame(LT.createCity(seed)); focus=null; paused=false; speed=1; carry=0; previous=null; advanceTo=null;
    $('city-seed').textContent=game.city.seed;
    render();
  }
  function frame(now) {
    if (advanceTo!==null) {
      // Budget a slice per frame: input and paint still run while simulating a long night.
      const deadline=performance.now()+6, end=Math.min(advanceTo,game.tick+256);
      do { LT.advance(game, Math.min(16,end-game.tick)); } while (game.tick<end && performance.now()<deadline);
      if (game.tick===advanceTo) advanceTo=null;
      render();
    } else if (previous!==null && !paused) {
      carry+=Math.min(now-previous,250)*LT.BALANCE.ticksPerSecond*speed/1000;
      const ticks=Math.floor(carry);
      if (ticks) { LT.advance(game,ticks); carry-=ticks; render(); }
    }
    previous=now;
    requestAnimationFrame(frame);
  }
  $('seed-form').addEventListener('submit',e=>{e.preventDefault();newGame($('seed').value);});
  $('pause').addEventListener('click',()=>{advanceTo=null; paused=!paused; previous=null; render();});
  $('speed').addEventListener('click',()=>{speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];render();});
  $('next-period').addEventListener('click',()=>{advanceTo=LT.cityTime(game).nextTick; carry=0; render();});
  $('inspector').addEventListener('click',e=>{if (e.target.closest('[data-watch]')) watch();});
  $('fit').addEventListener('click',map.fit);
  $('less').addEventListener('click',()=>map.zoomBy(1/1.4));
  $('more').addEventListener('click',()=>map.zoomBy(1.4));
  // Panels read the active instance at command time (a new seed replaces it).
  LT.ui = { get game() { return game; }, get focus() { return focus; }, select, render };
  newGame(''); requestAnimationFrame(frame);
})();
