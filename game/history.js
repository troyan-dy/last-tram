(() => {
  'use strict';
  // Events arrive in simulation order. Skip earlier days when reading a time window.
  function lowerBound(events,tick) {
    let lo=0, hi=events.length;
    while (lo<hi) {
      const mid=Math.floor((lo+hi)/2);
      if (events[mid].tick<tick) lo=mid+1; else hi=mid;
    }
    return lo;
  }
  function createHistory() {
    const doors=[], tickets=[];
    const window=(events,from,to)=>events.slice(lowerBound(events,from),lowerBound(events,to));
    return {
      get eventCount() { return doors.length+tickets.length; },
      recordArrival(g,r,j) {
        doors.push(Object.freeze({tick:j.arrivedAt, startedAt:j.startedAt, residentId:r.id,
          originId:j.originId, districtId:g.lookup.buildings.get(j.originId).districtId,
          destinationId:j.destinationId, mode:j.mode}));
      },
      recordFare(e) { tickets.push(Object.freeze({...e})); },
      arrivals(from,to) { return window(doors,from,to); },
      fares(from,to) { return window(tickets,from,to); },
      revenue(from,to) { return window(tickets,from,to).reduce((sum,e)=>sum+e.amount,0); },
      arrivalsAt(buildingId,from,to) {
        const stats={total:0,walk:0,tram:0,byDistrict:{}};
        for (const e of window(doors,from,to)) if (e.destinationId===buildingId) {
          stats.total++; stats[e.mode]++;
          (stats.byDistrict[e.districtId]??={walk:0,tram:0})[e.mode]++;
        }
        return stats;
      }
    };
  }
  Object.assign(globalThis.LastTram ??= {},{createHistory});
  if (typeof module!=='undefined') module.exports={createHistory};
})();
