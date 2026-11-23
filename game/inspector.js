(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const LT=globalThis.LastTram;
  const meanTime=s=>s.meanTripTicks===null?'—':`${(s.meanTripTicks/LT.BALANCE.ticksPerMinute).toLocaleString('ru',{maximumFractionDigits:1})} мин`;
  const table=(label,headers,rows)=>`<table aria-label="${label}"><thead><tr>${headers.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([title,...values])=>`<tr><th scope="row">${title}</th>${values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  function createObservationPanel(render,select) {
    const toggle=$('flow-toggle'), filters=$('flow-filters');
    const picker=$('building-choice'), day=$('ledger-day'), period=$('ledger-period'), live=$('live-stats');
    const traveling=$('traveler-choice');
    const checks=[...filters.querySelectorAll('input')];
    let instance, ring, lastBuilding, replay, liveKey, travelersKey;
    toggle.onchange=render;
    filters.onchange=render;
    picker.onchange=()=>{ if (picker.value) select('building',picker.value); };
    traveling.onchange=()=>{ if (traveling.value) select('resident',traveling.value); };
    day.onchange=period.onchange=render;
    function comparison(b) {
      if (!replay) { $('comparison').replaceChildren(); return; }
      const {from,to,control,changed}=replay;
      const a=control.arrivalsAt(b.id,from,to), c=changed.arrivalsAt(b.id,from,to);
      $('comparison').innerHTML=table(`Два утра: ${b.name}`,['Показатель','1 поезд','2 поезда'],[
        ['Прибытия',a.total,c.total],['Целиком пешком',a.walk,c.walk],['С трамваем',a.tram,c.tram],
        ['Средний путь',meanTime(a),meanTime(c)],
        ['Выручка сети',`${control.revenue(from,to)} ₽`,`${changed.revenue(from,to)} ₽`]
      ]);
    }
    $('compare-mornings').onclick=()=>{
      replay??=LT.compareMorning(instance.city);
      comparison(instance.lookup.buildings.get(lastBuilding));
    };
    function updateLedger(game,b) {
      const today=LT.cityTime(game).day;
      while (day.length<today) day.add(new Option(`День ${day.length+1}`,day.length+1));
      const range=period.value.split(':').map(Number);
      const [from,to]=range.map(m=>((Number(day.value)-1)*1440+m-LT.BALANCE.startMinute)*LT.BALANCE.ticksPerMinute);
      const end=Math.min(to,game.tick+1);
      const key=[b.id,from,to,game.history.eventCount,game.tick<from?'future':end<to?'partial':'closed'].join('|');
      if (key===liveKey) return;
      liveKey=key;
      const h=game.history, s=h.arrivalsAt(b.id,from,end);
      const rows=game.city.districts.filter(d=>s.byDistrict[d.id]).map(d=>[d.name,s.byDistrict[d.id].walk,s.byDistrict[d.id].tram]);
      const progress=game.tick<from?'Период ещё не начался.':end<to?'Период ещё идёт.':'Период завершён.';
      live.innerHTML=`<p class="interval-status">${progress} Конец интервала не включён.</p><strong>Прибытий: ${s.total}</strong><p>Средний путь: ${meanTime(s)}</p>`
        +(rows.length?table('Прибытия по району отправления',['Район','Пешком','С трамваем'],rows):'<p>Нет прибытий.</p>')
        +`<p class="network-total">Выручка сети: ${h.revenue(from,end)} ₽</p>`;
    }
    function update(game,focus) {
      const buildingId=focus?.type==='building'?focus.id:null;
      if (instance!==game) {
        instance=game; toggle.checked=false; lastBuilding=null; replay=null; ring=null; liveKey=travelersKey=null;
        day.replaceChildren(); period.selectedIndex=0; $('building-ledger').hidden=true;
      }
      if (game.openRing!==ring) {
        ring=game.openRing;
        picker.replaceChildren(new Option('Адрес на карте…',''),...game.city.buildings.filter(b=>b.ring<=ring)
          .map(b=>new Option(b.name,b.id)));
      }
      picker.value=buildingId??'';
      if (buildingId!==lastBuilding) {
        lastBuilding=buildingId;
        for (const box of checks) box.checked=true;
        $('building-ledger').hidden=!buildingId;
        if (buildingId) {
          const b=game.lookup.buildings.get(buildingId);
          $('ledger-title').textContent=b.name; $('flow-target').textContent=b.name;
          $('morning-experiment').hidden=b.ring!==0;
          if (b.ring===0) comparison(b);
        }
      }
      if (buildingId) updateLedger(game,game.lookup.buildings.get(buildingId));
      filters.hidden=!buildingId || !toggle.checked;
      const flow={enabled:toggle.checked,buildingId,filters:Object.fromEntries(checks.map(b=>[b.value,b.checked]))};
      $('travelers').hidden=!flow.enabled;
      if (flow.enabled) {
        const people=game.residents.filter(r=>LT.matchesFlow(r.journey,buildingId,flow.filters));
        const key=people.map(r=>`${r.id}/${r.journey.startedAt}/${r.journey.leg}`).join(',');
        if (key!==travelersKey) {
          travelersKey=key;
          traveling.replaceChildren(new Option(`Облачков: ${people.length} · Выбрать…`,''),
            ...people.map(r=>new Option(`${r.name} → ${game.lookup.buildings.get(r.journey.destinationId).name} · ${LT.journeyAction(r.journey)} · ${r.journey.mode==='tram'?'с трамваем':'пешком'}`,r.id)));
        }
        traveling.value=focus?.type==='resident'?focus.id:'';
        if (traveling.selectedIndex<0) traveling.selectedIndex=0;
      }
      return flow;
    }
    return update;
  }
  Object.assign(globalThis.LastTram,{createObservationPanel});
})();
