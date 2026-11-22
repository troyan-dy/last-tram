(() => {
  'use strict';
  const { BALANCE, distance } = typeof module !== 'undefined' ? require('./movement.js') : globalThis.LastTram;
  const { planJourney, stepTransit } =
    typeof module !== 'undefined' ? require('./journey.js') : globalThis.LastTram;
  const { openLine, moveTrains } = typeof module !== 'undefined' ? require('./service.js') : globalThis.LastTram;
  const byId = list => new Map(list.map(item => [item.id, item]));

  function makeResidents(game) {
    const { city } = game;
    const works = city.buildings.filter(b => b.kind === 'work');
    const homes = city.buildings.filter(b => b.kind === 'home').sort((a, b) =>
      a.ring - b.ring || Number(b.stopId === city.starterStops[0]) - Number(a.stopId === city.starterStops[0]));
    const names = ['Мира', 'Лев', 'Нина', 'Марк', 'Ася', 'Ян', 'Вера', 'Глеб', 'Инна', 'Илья', 'Зоя', 'Олег'];
    return homes.flatMap((home, index) => {
      const localWorks = works.filter(b => b.ring <= home.ring);
      return Array.from({ length: BALANCE.residentsPerHome }, (_, n) => {
        const i = index * BALANCE.residentsPerHome + n;
        const work = i === 0 ? works.find(b => b.stopId === city.starterStops.at(-1))
          : localWorks[(index + n * 3 + 1) % localWorks.length];
        return { id: `p:${home.id}:${n}`, name: names[i % names.length],
          homeId: home.id, workId: work.id, currentBuildingId: home.id, position: { ...home.entrance },
          departAt: i * BALANCE.morningSpread, morningStarted: false, journey: null, lastJourney: null,
          onTrainId: null, coat: (i + home.tint) % 5 };
      });
    });
  }

  function startGame(city, systems = {}) {
    const lookup = { buildings: byId(city.buildings), stops: byId(city.stops), edges: byId(city.edges) };
    const game = { city, lookup, tick: 0, openRing: 0, residents: [], trains: [], routes: [],
      trackIds: new Set(), cash: BALANCE.startingCash, fare: BALANCE.fare, fareIncome: 0,
      systems: { demand: morningDemand, service: moveTrains, planJourney, stepTransit, openLine, ...systems } };
    game.residents = makeResidents(game);
    game.systems.openLine(game);
    return game;
  }

  function depart(game, resident, destinationId) {
    const from = game.lookup.buildings.get(resident.currentBuildingId);
    const to = game.lookup.buildings.get(destinationId);
    if (!from || !to || from === to || to.ring > game.openRing || resident.journey) return false;
    const plan = game.systems.planJourney(game, resident, from, to);
    resident.journey = { ...plan, originId: from.id, destinationId: to.id, startedAt: game.tick, leg: 0 };
    resident.currentBuildingId = null;
    return true;
  }

  function morningDemand(game) {
    for (const r of game.residents) {
      if (!r.morningStarted && game.tick >= r.departAt && game.lookup.buildings.get(r.homeId).ring <= game.openRing)
        r.morningStarted = depart(game, r, r.workId);
    }
  }

  function stepWalk(resident, leg) {
    let left = BALANCE.walkSpeed;
    while (left > 0 && leg.next < leg.points.length) {
      const target = leg.points[leg.next], p = resident.position, d = distance(p, target);
      if (d <= left) {
        resident.position = { ...target };
        left -= d;
        leg.next++;
      } else {
        resident.position = { x: p.x + (target.x - p.x) * left / d, y: p.y + (target.y - p.y) * left / d };
        break;
      }
    }
    return leg.next === leg.points.length;
  }

  function stepResident(game, r) {
    const j = r.journey;
    if (!j || j.startedAt===game.tick) return;
    const leg = j.legs[j.leg];
    const done = leg.type === 'walk' ? stepWalk(r, leg) : game.systems.stepTransit(game, r, j, leg);
    if (!done || ++j.leg < j.legs.length) return;
    r.currentBuildingId = j.destinationId;
    r.lastJourney = { originId: j.originId, destinationId: j.destinationId,
      mode: j.mode, startedAt: j.startedAt, arrivedAt: game.tick, decision: j.decision };
    r.journey = null;
    game.systems.onArrival?.(game, r, r.lastJourney);
  }

  function advance(game, ticks = 1) {
    if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('Expected non-negative whole ticks');
    for (let i = 0; i < ticks; i++) {
      game.tick++;
      game.systems.service?.(game);
      game.systems.demand(game);
      for (const resident of game.residents) stepResident(game, resident);
    }
    return game;
  }

  function clockMinute(game) { return BALANCE.startMinute + Math.floor(game.tick / BALANCE.ticksPerMinute); }
  const api = { BALANCE, startGame, advance, depart, clockMinute };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
