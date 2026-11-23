// World units are street coordinates (x east, y south); the map projects them once.
(() => {
  'use strict';
  function randomFor(seed) {
    let h = 2166136261;
    for (const char of seed) h = Math.imul(h ^ char.codePointAt(0), 16777619);
    return (min, max) => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return min + Math.floor(h / 4294967296 * (max - min + 1));
    };
  }

  const centerNames = ['Липовая', 'Типография', 'Сквер', 'Дворы', 'Площадь', 'Рынок'];
  const outerNames = ['Береговая', 'Застава', 'Озёрная', 'Мастерские', 'Мельница',
    'Депо', 'Сады', 'Кирпичная', 'Вокзал', 'Фабрика', 'Каштановая', 'Порт', 'Парк', 'Проспект'];
  const workNames = ['Мастерская', 'Типография', 'Читальня', 'Ателье', 'Почта', 'Крытый рынок'];
  const point = (x, y) => ({ x, y });

  function createCity(value) {
    const seed = String(value ?? '').trim() || Math.random().toString(36).slice(2, 9);
    const rand = randomFor(seed);
    const xs = [-2, -1, 0, 1, 2].map(i => i * 108 + rand(-8, 8));
    const ys = [-2, -1, 0, 1].map(i => i * 104 + rand(-4, 4));
    const districts = [], buildings = [], stops = [], edges = [];
    let outer = 0;
    const stopId = (col, row) => `s:${col}:${row}`;
    for (let row = 0; row < ys.length; row++) {
      for (let col = 0; col < xs.length; col++) {
        const ring = Number(col === 0 || col === 4 || row === 0 || row === 3);
        const center = (row - 1) * 3 + col - 1;
        const districtId = `d:${col}:${row}`;
        const id = stopId(col, row), x = xs[col], y = ys[row];
        const name = ring ? outerNames[outer++] : centerNames[center];
        districts.push({ id: districtId, name, ring });
        stops.push({ id, name, districtId, ring, x, y, sidewalk: point(x, y - 7) });
        for (const other of [col && stopId(col - 1, row), row && stopId(col, row - 1)]) {
          if (other) edges.push({ id: `${other}/${id}`, a: other, b: id });
        }
        // Leave a continuous sightline and a clear pedestrian crossing at the stop.
        for (let lot = 0; lot < 3; lot++) {
          const kind = lot === 1 ? 'work' : 'home';
          const width = rand(22, 34), depth = rand(11, 16);
          const bx = x + (lot % 2 ? rand(9, 13) : rand(-44, -39));
          const by = y + (lot === 2 ? rand(24, 29) : rand(-39, -35));
          const entrance = point(bx + width * 0.5, by + depth);
          buildings.push({ id: `b:${col}:${row}:${lot}`, name: kind === 'home'
            ? `${name}, дом ${lot + 1}` : ring ? `${name} · цех` : workNames[center],
            kind, visualRole: kind==='home' ? 'house' : !ring && center===5 ? 'market' : 'work',
            districtId, stopId: id, ring, x: bx, y: by, width, depth,
            floors: lot === 2 ? 3 : rand(4, 5), tint: rand(0, 3), entrance });
        }
      }
    }
    const starterStops = [1, 2, 3].map(col => stopId(col, 2));
    return { seed, districts, buildings, stops, edges, starterStops };
  }

  const api = { createCity };
  Object.assign(globalThis.LastTram ??= {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})();
