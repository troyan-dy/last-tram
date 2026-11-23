const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('the long edge of the train roof follows a cross street and stays aligned during the stop', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.getByRole('button', { name: 'Пауза' }).click();
  const errors = await page.evaluate(() => {
    const api = LastTram, g = api.ui.game;
    const origin = g.lookup.stops.get(g.city.starterStops[0]);
    const dest = g.city.stops.find(s => s.ring === 0 && s.x === origin.x && s.y !== origin.y);
    const edge = g.city.edges.find(e => [e.a, e.b].includes(origin.id) && [e.a, e.b].includes(dest.id));
    api.buildTrack(g, edge.id);
    const line = api.createRoute(g, [origin.id, dest.id]);
    const { trainId } = api.buyTrain(g, line.routeId);
    const train = g.trains.find(t => t.id === trainId);
    function alignment() {
      api.ui.render();
      const roof = document.querySelector(`[data-id="${trainId}"] polygon[fill="#dbc198"]`);
      const pts = Array.from(roof.points, p => new DOMPoint(p.x, p.y).matrixTransform(roof.getCTM()));
      const edges = [1, 3].map(i => [pts[i].x - pts[0].x, pts[i].y - pts[0].y]);
      const [x, y] = edges.sort((a, b) => Math.hypot(...b) - Math.hypot(...a))[0];
      const [rx, ry] = api.art.project(dest.x-origin.x, dest.y-origin.y);
      return Math.abs(x*ry-y*rx) / (Math.hypot(x,y)*Math.hypot(rx,ry));
    }
    for (let i = 0; train.atStopId && i < 300; i++) api.advance(g, 1);
    const moving = alignment();
    for (let i = 0; !train.atStopId && i < 300; i++) api.advance(g, 1);
    return [moving, alignment()];
  });
  for (const error of errors) expect(error).toBeLessThan(0.01);
});
