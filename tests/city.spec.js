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

test('у рынка фильтры скрывают облачка, а не людей; выбор человека сбрасывает фильтры', async ({ page }) => {
  await page.getByRole('button',{name:'Крытый рынок: показать прибытия'}).click();
  await page.getByRole('button',{name:'Потоки',exact:true,timeout:1000}).click({timeout:1500});
  const walking = page.getByRole('button',{name:'Целиком пешком',exact:true});
  await walking.click();
  const walker = page.locator('#pedestrians g[data-mode="walk"]:visible').first();
  await expect(walker).toBeVisible();
  await expect(walker.locator('.thought')).toBeHidden();
  await walker.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel')).toContainText('При последнем выборе');
  await page.getByRole('button',{name:'Крытый рынок: показать прибытия'}).click();
  await expect(walking).toHaveAttribute('aria-pressed','true');
});

test('после высадки способ остаётся «с трамваем» до двери и фокус сохраняется после прибытия', async ({ page }) => {
  await page.getByRole('button',{name:'Крытый рынок: показать прибытия'}).click();
  await page.getByRole('button',{name:'Потоки',exact:true}).click({timeout:1500});
  await page.getByRole('button',{name:'Целиком пешком',exact:true}).click();
  const id = await page.evaluate(() => {
    for(let i=0;i<600;i++){stepSim(g);stepSim(ref);const p=g.people.find(p=>p.dest===city.dest[1].id&&p.phase==='last');
      if(p){display(true);return p.id}}
  });
  expect(id).toBeDefined();
  const person = page.locator(`[data-pick="person:${id}"]`);
  await expect(person.locator('.thought')).toBeVisible();
  await person.focus(); await page.keyboard.press('Enter');
  await page.evaluate(id=>{while(g.people[id].phase!=='done'){stepSim(g);stepSim(ref)}display(true)},id);
  await expect(page.locator('#panel')).toContainText('Крытый рынок');
  await expect(page.locator('#panel')).toContainText('Факт:');
});
