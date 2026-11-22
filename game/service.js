(() => {
  'use strict';
  const { BALANCE, distance } = typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const fail = message => ({ ok: false, message });
  const open = (g, id) => g.lookup.stops.get(id)?.ring <= g.openRing;

  function buildTrack(g, edgeId) {
    const e = g.lookup.edges.get(edgeId);
    if (!e || !open(g, e.a) || !open(g, e.b)) return fail('Участок вне зоны обслуживания.');
    if (g.trackIds.has(edgeId)) return fail('Путь уже построен.');
    if (g.cash < BALANCE.trackCost) return fail('Недостаточно денег на путь.');
    g.cash -= BALANCE.trackCost;
    g.trackIds.add(edgeId);
    return { ok: true };
  }

  const api = { buildTrack };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
