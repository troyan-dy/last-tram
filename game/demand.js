(() => {
  'use strict';
  const { BALANCE } = typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const minuteTicks = BALANCE.ticksPerMinute, dayMinutes = 24 * 60;
  const periods = [
    { id: 'morning', name: 'Утро', minute: BALANCE.startMinute },
    { id: 'day', name: 'День', minute: 12 * 60 },
    { id: 'evening', name: 'Вечер', minute: 17 * 60 + 30 },
    { id: 'night', name: 'Ночь', minute: 21 * 60 + 30 }
  ];
  const localTicks = game => (BALANCE.startMinute * minuteTicks + game.tick) % (dayMinutes * minuteTicks);
  const periodAt = ticks => periods.findLast(p => p.minute * minuteTicks <= ticks) ?? periods.at(-1);

  function cityTime(game) {
    const now = localTicks(game), period = periodAt(now);
    const next = periods.find(p => p.minute * minuteTicks > now) ?? periods[0];
    const remaining = (next.minute * minuteTicks - now + dayMinutes * minuteTicks) % (dayMinutes * minuteTicks);
    return { period, next, nextTick: game.tick + remaining,
      day: 1 + Math.floor((game.tick + BALANCE.startMinute * minuteTicks) / (dayMinutes * minuteTicks)) };
  }

  function dailyRoutine(index, work, accessibleWorks) {
    const next = accessibleWorks[(accessibleWorks.indexOf(work) + 1) % accessibleWorks.length];
    return {
      // Stagger the peaks. Only one resident per household makes a daytime visit.
      peakDelay: (index * BALANCE.morningSpread) % (72 * minuteTicks),
      visitDelay: (index * 31) % (180 * minuteTicks),
      visitId: index % BALANCE.residentsPerHome === 0 && next !== work ? next.id : null
    };
  }

  function dailyDemand(game, depart) {
    const now = localTicks(game), period = periodAt(now);
    if (period.id === 'night') return;
    const elapsed = now - period.minute * minuteTicks, slot = game.tick - elapsed;
    for (const r of game.residents) {
      const { routine } = r;
      if (r.lastDemandSlot === slot || r.journey || !r.currentBuildingId) continue;
      const visit = period.id === 'day';
      const target = visit ? routine.visitId : period.id === 'morning' ? r.workId : r.homeId;
      if (!target || elapsed < (visit ? routine.visitDelay : routine.peakDelay)) continue;
      if (game.lookup.buildings.get(r.homeId).ring > game.openRing) continue;
      // A late arrival may still leave during this period. Never replay an expired appointment.
      if (target === r.currentBuildingId || depart(game, r, target)) r.lastDemandSlot = slot;
    }
  }

  const api = { dailyRoutine, dailyDemand, cityTime };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
