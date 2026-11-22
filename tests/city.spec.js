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
  await page.getByRole('button',{name:'Потоки',exact:true}).click({timeout:1500});
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

test('два утра: один сид, те же отправления, один фактор и фактическая выручка', async ({ page }) => {
  await page.getByText('Два утра у рынка',{exact:true}).click({timeout:1500});
  const start = page.getByRole('button',{name:'Начать контрольное утро'});
  const finish = page.getByRole('button',{name:'Доиграть до 08:00'});
  const actual = () => page.evaluate(()=>({walk:g.arr.filter(p=>p.dest===city.dest[1].id&&p.paid===null).length,
    tram:g.arr.filter(p=>p.dest===city.dest[1].id&&p.paid!==null).length, revenue:g.rev}));
  await start.click(); await expect(page.locator('#clock')).toHaveText('07:00');
  await expect(page.locator('#minus')).toBeDisabled();
  await finish.click(); await expect(page.locator('#clock')).toHaveText('08:00');
  const base=await actual();
  await page.getByLabel('Изменение на повторе').selectOption('fare');
  await page.getByRole('button',{name:'Повторить это утро'}).click();
  expect(await page.evaluate(()=>[g.net.fare,g.cars.length,g.rev,g.t])).toEqual([20,1,0,0]);
  await finish.click(); const next=await actual();
  expect(next.tram).toBeGreaterThan(base.tram);
  const cells = await page.locator('#morningResults tr').last().locator('td').allTextContents();
  expect(cells.slice(1,4)).toEqual([String(next.walk), String(next.tram), `${next.revenue} ₽`]);
  await page.getByLabel('Изменение на повторе').selectOption('train');
  await page.getByRole('button',{name:'Повторить это утро'}).click();
  expect(await page.evaluate(()=>[g.net.fare,g.cars.length])).toEqual([30,2]);
  await finish.click();
  await page.getByLabel('Изменение на повторе').selectOption('same');
  await page.getByRole('button',{name:'Повторить это утро'}).click(); await finish.click();
  expect(await actual()).toEqual(base);
  await page.locator('#setup').click(); await page.locator('#seedField').fill('Другой'); await page.locator('#start').click();
  await expect(page.locator('#morningResults tbody tr')).toHaveCount(0);
});

test('вечером Нина выходит с рынка домой и следующим утром возвращается к обычному маршруту', async ({ page }) => {
  await page.getByRole('button',{name:'К вечернему пику'}).click({timeout:1500});
  await expect(page.locator('#clock')).toHaveText('18:00');
  const id=await page.evaluate(()=>{
    advance(3); display(true);
    return g.people.find(p=>p.name==='Нина'&&p.home===city.dest[1].id&&p.dest===city.people[0].home)?.id;
  });
  expect(id).toBe(0);
  await page.getByRole('button',{name:'Крытый рынок: показать прибытия'}).getByText('РЫНОК',{exact:true}).click();
  await page.getByRole('button',{name:'К зданию',exact:true}).click();
  await expect(page.locator('#panel')).toContainText('Нина');
  const route=await page.evaluate(()=>{advance(14405-g.t);const p=g.people[0];return [p.home===city.people[0].home,p.dest===city.dest[1].id,p.start>14400]});
  expect(route).toEqual([true,true,true]);
});

test('построенный путь и изменённый Т1 сохраняются после покупки кольца', async ({ page }) => {
  await page.getByRole('button',{name:'Сеть',exact:true}).click();
  await page.getByRole('button',{name:'Проложить пути'}).click();
  await page.getByRole('button',{name:'Проложить Дворы — Школа'}).click();
  await page.getByRole('button',{name:'Готово',exact:true}).click();
  await page.getByRole('button',{name:'Изменить Т1'}).click();
  await page.getByRole('button',{name:/2\. Сквер ×/}).click();
  await page.getByRole('button',{name:'Применить сейчас'}).click();
  const before=await page.evaluate(()=>JSON.stringify([g.net.edges,g.net.lines,g.net.fleet,city.doors]));
  await page.getByRole('button',{name:'К вечернему пику'}).click({timeout:1500});
  await page.locator('#order').click();
  await expect(page.getByRole('button',{name:/Открыть кольцо ·/})).toBeDisabled();
  await page.getByRole('button',{name:'К вечернему пику'}).click();
  await page.getByRole('button',{name:/Открыть кольцо ·/}).click();
  expect(await page.evaluate(()=>JSON.stringify([g.net.edges,g.net.lines,g.net.fleet,city.doors]))).toBe(before);
  await expect(page.locator('[data-stop="12"]')).toBeVisible();
  expect(await page.evaluate(()=>g.people.filter(p=>p.outer).length)).toBe(4);
});
