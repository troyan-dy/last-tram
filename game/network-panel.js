(() => {
  'use strict';
  const LT=globalThis.LastTram, B=LT.BALANCE, $=id=>document.getElementById(id);
  function createNetworkPanel(active,render,select) {
    let instance, routeId, draft, signature;
    const route=()=>active().routes.find(r=>r.id===routeId);
    const stopName=id=>active().lookup.stops.get(id).name;
    const status=text=>{ $('network-message').textContent=text; };
    function options(id,items,selected) {
      const el=$(id), value=selected??el.value;
      el.replaceChildren(...items.map(([key,text])=>new Option(text,key)));
      if (items.some(([key])=>key===value)) el.value=value;
    }
    function edit(id) {
      routeId=id; draft=[...(route()?.stopIds??[])]; signature=null;
    }
    function command(result,success) {
      status(result.ok ? success : result.message);
      signature=null; render();
    }
    function update(game) {
      if (instance!==game) {
        instance=game; edit(game.routes[0]?.id); status(''); $('network-console').open=false;
        $('fare-choice').value=game.fare;
      }
      $('network-money').textContent=`Касса ${game.cash} ₽ · Билет ${game.fare} ₽`;
      const key=[game.openRing,[...game.trackIds],game.routes.map(r=>[r.id,...r.stopIds]),
        game.trains.map(t=>[t.id,t.assignedRouteId]),routeId,draft].join('|');
      if (signature===key) return;
      signature=key;
      const r=route(), stops=game.city.stops.filter(s=>s.ring<=game.openRing);
      const routes=game.routes.map(r=>[r.id,r.name]);
      if (!r) routes.push(['','Новый маршрут']);
      options('route-choice',routes,routeId??'');
      $('line-title').textContent=r?.name??'Новый маршрут';
      $('line-stops').replaceChildren(...(r?.stopIds??[]).map(id=>{
        const row=document.createElement('div'); row.className='stop-row'; row.textContent=stopName(id); return row;
      }));
      options('track-choice',game.city.edges.filter(e=>!game.trackIds.has(e.id)
        && [e.a,e.b].every(id=>game.lookup.stops.get(id).ring<=game.openRing))
        .map(e=>[e.id,`${stopName(e.a)} — ${stopName(e.b)}`]));
      $('build-track').textContent=`Построить путь · ${B.trackCost} ₽`;
      $('build-track').disabled=!$('track-choice').value;
      $('draft-stops').replaceChildren(...draft.map((id,i)=>{
        const li=document.createElement('li'), btn=document.createElement('button');
        btn.type='button'; btn.textContent='×'; btn.dataset.remove=i;
        btn.setAttribute('aria-label',`Убрать ${stopName(id)}`);
        li.append(`${i+1}. ${stopName(id)} `,btn); return li;
      }));
      options('stop-choice',stops.filter(s=>!draft.includes(s.id)).map(s=>[s.id,s.name]));
      $('append-stop').disabled=!$('stop-choice').value;
      options('train-choice',game.trains.map(t=>
        [t.id,`${t.name} · ${game.routes.find(r=>r.id===t.assignedRouteId)?.name??'Без линии'}`]));
      $('buy-train').textContent=`Купить поезд · ${B.trainCost} ₽`;
      $('buy-train').disabled=!r; $('assign-train').disabled=!r;
      $('fare-choice').max=B.maxFare;
      options('resident-choice',[['','Выберите жителя…'],...game.residents
        .filter(p=>game.lookup.buildings.get(p.homeId).ring<=game.openRing)
        .map(p=>[p.id,`${p.name} · ${game.lookup.buildings.get(p.homeId).name}`])]);
    }
    $('build-track').onclick=()=>command(LT.buildTrack(active(),$('track-choice').value),'Участок построен.');
    $('route-choice').onchange=e=>{edit(e.target.value);status('');render();};
    $('new-route').onclick=()=>{edit('');status('Задайте остановки нового маршрута.');render();};
    $('append-stop').onclick=()=>{draft.push($('stop-choice').value);render();};
    $('draft-stops').onclick=e=>{
      if (e.target.dataset.remove===undefined) return;
      draft.splice(Number(e.target.dataset.remove),1);render();
    };
    $('save-stops').onclick=()=>{
      const result=route()? LT.setStops(active(),routeId,draft) : LT.createRoute(active(),draft);
      if (result.ok) edit(result.routeId??routeId);
      command(result,'Порядок остановок сохранён.');
    };
    $('buy-train').onclick=()=>{
      const result=LT.buyTrain(active(),routeId);
      command(result,'Поезд куплен и назначен.');
      if (result.ok) $('train-choice').value=result.trainId;
    };
    $('assign-train').onclick=()=>command(LT.assignTrain(active(),$('train-choice').value,routeId),'Назначение принято.');
    $('show-train').onclick=()=>select('train',$('train-choice').value);
    $('set-fare').onclick=()=>command(LT.setFare(active(),$('fare-choice').valueAsNumber),'Тариф для новых перемещений изменён.');
    $('resident-choice').onchange=e=>{if (e.target.value) select('resident',e.target.value);};
    return update;
  }
  function choiceCard(decision,mode,preview,dt) {
    if (!decision) return '';
    const d=decision, time=v=>`${(v/B.ticksPerMinute).toLocaleString('ru',{maximumFractionDigits:1})} мин`;
    const rows=[['Целиком пешком',time(d.walkTicks)],['С трамваем',d.tramTicks===null?'Нет обслуживания':time(d.tramTicks)]];
    if (d.tramTicks!==null) rows.push(['Подход',time(d.accessTicks)],['Ожидание',time(d.waitTicks)],
      ['В поезде',time(d.rideTicks)],['Пересадки',`${d.transfers} · ${time(d.transferTicks)}`],
      ['Последний участок',time(d.exitTicks)],['Билет',`${d.fare} ₽`],
      ['Цена в оценке времени',time(d.farePenalty)]);
    const reason=d.tramTicks===null?'Нет подходящего поезда.':mode==='tram'?'Выигрыш во времени оправдывает билет.':
      d.walkTicks<=d.tramTicks?'Пешком не дольше.':'Выигрыш во времени не оправдывает билет.';
    return `<section class="choice"><h3>${preview?'Если выйти сейчас':'Выбор у двери'}</h3>${dt(rows)}<p>${reason}</p></section>`;
  }
  Object.assign(LT,{createNetworkPanel,choiceCard});
})();
