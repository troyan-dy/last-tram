(() => {
  'use strict';
  // Playtest terms for the first ring (ADR 0005).
  const terms = Object.freeze({ price: 80, revenue: 16, centralTrips: 3 });

  function trackExpansion(game) {
    game.expansion = { centralTrips: 0, ringTrips: 0, firstLink: null };
    game.arrivalListeners.add((g, resident, trip) => {
      if (trip.mode !== 'tram') return;
      const progress = g.expansion;
      if (!g.openRing) { progress.centralTrips++; return; }
      const { originId, destinationId, boardStopId, arrivedAt } = trip;
      if (g.lookup.buildings.get(originId).ring !== 1 || g.lookup.buildings.get(destinationId).ring !== 0 ||
          g.lookup.stops.get(boardStopId)?.ring !== 1) return;
      progress.ringTrips++;
      progress.firstLink ??= { residentId: resident.id, originId, destinationId, boardStopId, arrivedAt,
        savedTicks: trip.decision.walkTicks - (arrivedAt - trip.startedAt) };
    });
  }

  function expansionStatus(game) {
    const { centralTrips, ringTrips, firstLink } = game.expansion;
    const opened = game.openRing >= 1;
    const promoted = centralTrips >= terms.centralTrips || game.fareIncome >= terms.revenue;
    const reasons = [];
    if (opened) reasons.push('Кольцо уже открыто.');
    else {
      if (!promoted) reasons.push('Сначала выполните цель города.');
      if (game.cash < terms.price) reasons.push(`Не хватает ${terms.price - game.cash} ₽.`);
    }
    return { terms, opened, promoted, centralTrips, ringTrips, firstLink,
      canBuy: !reasons.length, message: reasons.join(' ') };
  }

  function buyRing(game) {
    const status = expansionStatus(game);
    if (!status.canBuy) return { ok: false, message: status.message };
    game.cash -= terms.price;
    game.openRing = 1;
    return { ok: true };
  }

  const api = { trackExpansion, expansionStatus, buyRing };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
