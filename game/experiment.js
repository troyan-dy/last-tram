(() => {
  'use strict';
  const { startGame, advance, BALANCE } = typeof module!=='undefined' ? require('./simulation.js') : globalThis.LastTram;
  const { buyTrain } = typeof module!=='undefined' ? require('./service.js') : globalThis.LastTram;
  function compareMorning(city) {
    const from=0, to=(9*60-BALANCE.startMinute)*BALANCE.ticksPerMinute;
    const control=startGame(city), changed=startGame(city);
    const purchase=buyTrain(changed,changed.routes[0].id);
    if (!purchase.ok) throw new Error(purchase.message);
    advance(control,to); advance(changed,to);
    return {from,to,control:control.history,changed:changed.history};
  }
  Object.assign(globalThis.LastTram ??= {},{compareMorning});
  if (typeof module!=='undefined') module.exports={compareMorning};
})();
