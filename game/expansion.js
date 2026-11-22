(() => {
  'use strict';
  // Playtest terms for the first ring (ADR 0005).
  const terms = Object.freeze({ price: 80, revenue: 16 });

  function expansionStatus(game) {
    const opened = game.openRing >= 1, promoted = game.fareIncome >= terms.revenue;
    const reasons = [];
    if (opened) reasons.push('Кольцо уже открыто.');
    else {
      if (!promoted) reasons.push('Сначала выполните цель города.');
      if (game.cash < terms.price) reasons.push(`Не хватает ${terms.price - game.cash} ₽.`);
    }
    return { terms, opened, promoted, canBuy: !reasons.length, message: reasons.join(' ') };
  }

  function buyRing(game) {
    const status = expansionStatus(game);
    if (!status.canBuy) return { ok: false, message: status.message };
    game.cash -= terms.price;
    game.openRing = 1;
    return { ok: true };
  }

  const api = { expansionStatus, buyRing };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
