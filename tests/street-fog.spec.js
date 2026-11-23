const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test('reveal more streets without moving the camera or replacing the running line and its stops',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('game/prototype-map.html')).href+'?seed=Ива&start=line');
  await page.locator('#pause').click();
  const stops=page.locator('#scene .signs [data-type=stop]'), train=page.locator('#moving [data-type=train]').first();
  const ids=()=>stops.evaluateAll(ns=>ns.map(n=>n.dataset.id));
  const start=await ids(), cash=await page.locator('#cash').innerText();
  const position=await train.getAttribute('transform'), view=await page.locator('#map').getAttribute('viewBox');
  await page.getByRole('button',{name:'Строительство',exact:true}).click();
  const streets=page.locator('#targets [data-type=section]'),oldStreets=await streets.count();
  const title=await page.locator('#content').innerText();
  await expect(page.getByRole('button',{name:'Открыть кольцо',exact:true})).toBeVisible({timeout:1500});
  await page.getByRole('button',{name:'Открыть кольцо',exact:true}).click();
  const expanded=await ids();
  expect(expanded).toEqual(start);
  expect(await page.locator('#map').getAttribute('viewBox')).toBe(view);
  expect(await train.getAttribute('transform')).toBe(position);
  expect(await page.locator('#cash').innerText()).toBe(cash);
  expect(await page.locator('#content').innerText()).toBe(title);
  expect(await streets.count()).toBeGreaterThan(oldStreets);
  await page.getByRole('button',{name:'Вся зона',exact:true}).click();
  expect(await page.locator('#map').getAttribute('viewBox')).not.toBe(view);
});

test('locked neighborhoods are absent from the dispatcher until the reveal; a newly exposed street can carry track',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pathToFileURL(path.resolve('game/prototype-map.html')).href+'?seed=Клён');
  await page.locator('#pause').click();
  const edge=await page.evaluate(()=>{
    const c=LastTram.streetStudy.create('Клён'),byId=new Map(c.stops.map(s=>[s.id,s]));
    const e=c.study.sections.find(s=>byId.get(s.a).ring!==byId.get(s.b).ring);
    return {id:e.id,name:byId.get(e.b).name};
  });
  await page.getByRole('button',{name:'Потоки',exact:true}).click();
  await expect(page.locator('#district option').filter({hasText:edge.name})).toHaveCount(0);
  await page.getByRole('button',{name:'Открыть кольцо',exact:true}).click();
  await expect(page.locator('#district option').filter({hasText:edge.name})).toHaveCount(1);
  await page.getByRole('button',{name:'Вся зона',exact:true}).click();
  await page.getByRole('button',{name:'Строительство',exact:true}).click();
  const cash=parseInt(await page.locator('#cash').innerText());
  await page.locator(`#targets [data-id="${edge.id}"] .price`).click();
  expect(parseInt(await page.locator('#cash').innerText())).toBeLessThan(cash);
});
