(() => {
  'use strict';
  const LT = globalThis.LastTram;

  // Find a plausible one-edge service and real appointments at both peaks.
  // Nothing in the success condition refers to this suggestion.
  function exampleLink(game) {
    const line = game.city.starterStops, end = line.at(-1);
    for (const edge of game.city.edges) {
      if (edge.a !== end && edge.b !== end) continue;
      const stop = game.lookup.stops.get(edge.a === end ? edge.b : edge.a);
      if (stop.ring !== 1) continue;
      const locals = game.residents.filter(r => game.lookup.buildings.get(r.homeId).stopId === stop.id);
      const onLine = id => line.includes(game.lookup.buildings.get(id)?.stopId);
      const worker = locals.find(r => onLine(r.workId)), visitor = locals.find(r => onLine(r.routine.visitId));
      if (!worker || !visitor) continue;
      const district = id => game.lookup.stops.get(id).name;
      const door = id => game.lookup.buildings.get(id).name;
      return `Район «${stop.name}». Дневная цель: ${visitor.name} → ${door(visitor.routine.visitId)}. ` +
        `Утренняя цель: ${worker.name} → ${door(worker.workId)}. В «Пульте сети» можно построить участок ` +
        `«${district(edge.a)} — ${district(edge.b)}». На стартовой линии добавьте «${stop.name}» после ` +
        `«${district(end)}» и нажмите «Сохранить остановки». Кнопкой часов перейдите к следующему периоду, ` +
        `чтобы увидеть результат. Если уже вечер, доведите город до полудня следующего дня. ` +
        `Можно обслужить другой район или пустить отдельный маршрут.`;
    }
    return 'Выберите жителя кольца в списке, найдите его место работы в центре и предложите связь через новую остановку.';
  }

  function createGoalsPanel(panel, active, render, select) {
    panel.innerHTML = `<div class="kicker">03 <span>/</span> РАЗВИТИЕ</div><h2>Цели города</h2>
      <section data-goal="offer"><h3>Открыть кольцо</h3>
        <p>Для права на покупку выполните любую цель в центре:</p>
        <ul><li data-goal="flow"></li><li data-goal="revenue"></li></ul>
        <p data-goal="cash"></p><p id="ring-reason"></p>
        <button type="button" data-goal="buy" aria-describedby="ring-reason"></button>
      </section><section data-goal="link" hidden><h3>Из кольца в центр</h3>
        <p>Довезите пассажира от двери в новом районе до двери в центре. Первая посадка — в кольце.</p>
        <p data-goal="count"></p><p data-goal="proof"></p>
        <button type="button" data-goal="watch" hidden>Показать пассажира сейчас →</button>
        <details><summary>Пример связи</summary><p data-goal="example"></p></details>
      </section>`;
    const el = key => panel.querySelector(`[data-goal="${key}"]`);
    const text = (key, value) => {
      const node = el(key);
      if (node.textContent !== value) node.textContent = value;
    };
    const reason = panel.querySelector('#ring-reason');
    const reveal = residentId => {
      select('resident', residentId);
      document.getElementById('inspector').scrollIntoView({ block: 'nearest' });
    };
    let instance;
    el('buy').onclick = () => { LT.buyRing(active()); render(); };
    el('watch').onclick = () => {
      const link = LT.expansionStatus(active()).firstLink;
      if (link) reveal(link.residentId);
    };
    return game => {
      const s = LT.expansionStatus(game), t = s.terms;
      if (instance !== game) {
        instance = game;
        panel.querySelector('details').open = false;
        text('example', exampleLink(game));
      }
      el('offer').hidden = s.opened;
      el('link').hidden = !s.opened;
      if (!s.opened) {
        text('flow', `Довезите пассажиров до двери: ${s.centralTrips} из ${t.centralTrips} поездок с трамваем.`);
        text('revenue', `Или заработайте на билетах: ${game.fareIncome} из ${t.revenue} ₽.`);
        text('cash', `В кассе ${game.cash} ₽ · Цена кольца ${t.price} ₽.`);
        const message = s.message || 'Право получено. Выберите, когда открыть кольцо.';
        if (reason.textContent !== message) reason.textContent = message;
        text('buy', `Открыть кольцо · ${t.price} ₽`);
        el('buy').disabled = !s.canBuy;
      } else {
        const link = s.firstLink;
        text('count', link ? `Цель выполнена: 1 из 1. Всего таких поездок: ${s.ringTrips}.`
          : 'У двери в центре: 0 из 1.');
        el('watch').hidden = !link;
        if (link) {
          const who = game.residents.find(r => r.id === link.residentId).name;
          const door = id => game.lookup.buildings.get(id).name;
          const minutes = (link.savedTicks / LT.BALANCE.ticksPerMinute).toLocaleString('ru', { maximumFractionDigits: 1 });
          const arrival = LT.clockMinute({tick:link.arrivedAt});
          text('proof', `Первая поездка — ${who}: ${door(link.originId)} → ${door(link.destinationId)}. ` +
            `Посадка: ${game.lookup.stops.get(link.boardStopId).name}. Прибытие: день ${1+Math.floor(arrival/1440)}, ${LT.stamp(arrival)}. ` +
            `На ${minutes} мин быстрее, чем пешком.`);
        } else text('proof', '');
      }
    };
  }
  Object.assign(LT, { createGoalsPanel });
})();
