const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const gameURL = pathToFileURL(path.resolve('prototype-station-flow.html')).href;

test.beforeEach(async ({ page }) => {
  await page.goto(gameURL);
  await page.locator('#pause').click();
});

test('поезд и обе крайние остановки на одном наклонном пути; обзор восстанавливается', async ({ page }) => {
  const city = page.locator('#city');
  const start = await city.getAttribute('viewBox');
  const coords = await page.evaluate(() => {
    const point = sel => new DOMPoint(0, 0).matrixTransform(document.querySelector(sel).getScreenCTM());
    const a = point('[data-stop="0"]'), b = point('[data-stop="2"]'), c = point('[data-pick="car:0"]');
    const box = document.querySelector('#city').getBoundingClientRect();
    return { dy: Math.abs(b.y-a.y), distance: Math.abs((b.x-a.x)*(a.y-c.y)-(a.x-c.x)*(b.y-a.y))/Math.hypot(b.x-a.x,b.y-a.y),
      inside: [a,b].every(p=>p.x>=box.left&&p.x<=box.right&&p.y>=box.top&&p.y<=box.bottom) };
  });
  expect(coords.inside).toBe(true);
  expect(coords.distance).toBeLessThan(2);
  expect(coords.dy).toBeGreaterThan(30);
  await city.hover();
  await page.mouse.wheel(0,-200);
  await expect(city).not.toHaveAttribute('viewBox',start);
  await page.locator('#fit').click();
  await expect(city).toHaveAttribute('viewBox',start);
  const train = page.locator('[data-pick="car:0"]'), pose = await train.getAttribute('transform');
  await page.locator('#pause').click();
  await expect(train).not.toHaveAttribute('transform',pose);
});
