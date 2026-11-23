const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test.use({ offline:true });
async function open(page,seed='ТРАМ-17') {
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.getByLabel('Сид города').fill(seed);
  await page.getByRole('button',{name:'Новая партия'}).click();
  await page.getByRole('button',{name:'Пауза'}).click();
}
async function toTick(page,tick) {
  await page.evaluate(t=>{
    const {ui,advance}=LastTram; advance(ui.game,t-ui.game.tick); ui.render();
  },tick);
}

test('thoughts belong to individual travelers, even sharing a train; changing focus clears both filters', async ({page})=>{
  await open(page);
  await toTick(page,100);
  await page.getByRole('checkbox',{name:'Потоки · Мысль'}).check({timeout:2000});
  const people=await page.evaluate(()=>LastTram.ui.game.residents.filter(r=>r.journey)
    .map(r=>({id:r.id,destination:r.journey.destinationId,mode:r.journey.mode,train:r.onTrainId})));
  const thought=id=>page.locator(`[data-thought="${id}"]`);
  const body=id=>page.locator(`#moving [data-id="${id}"]`);
  const mira=people[0], walker=people.find(r=>r.mode==='walk');
  expect(people.filter(r=>r.train===mira.train).length).toBeGreaterThan(1);
  await expect(page.locator('[data-thought]')).toHaveCount(people.length);
  for (const p of people) await expect(thought(p.id)).toBeVisible();
  await expect(thought(mira.id)).toHaveAccessibleName(/Крытый рынок.*В вагоне.*С трамваем/);
  const market=page.locator('#map').getByRole('button',{name:'Крытый рынок',exact:true});
  await market.press('Enter');
  const from=page.getByLabel('Из здания',{exact:true}), foot=page.getByLabel('Целиком пешком',{exact:true});
  await from.uncheck(); await foot.uncheck();
  await expect(page.locator('[data-thought]')).toHaveCount(people.filter(p=>
    p.destination===mira.destination && p.mode==='tram').length);
  await expect(thought(walker.id)).toHaveCount(0);
  await body(walker.id).locator('.hit').click();
  await expect(page.locator('#inspector')).toHaveAttribute('data-id',walker.id);
  await expect(page.locator('[data-thought]')).toHaveCount(people.length);
  await market.press('Enter');
  await expect(from).toBeChecked(); await expect(foot).toBeChecked();
  await from.uncheck(); await foot.uncheck();
  await thought(mira.id).click();
  await expect(page.locator('#inspector')).toHaveAttribute('data-id',mira.id);
  await expect(page.locator('#inspector')).toContainText('В вагоне');
  await market.press('Enter'); await from.uncheck(); await foot.uncheck();
  await toTick(page,175);
  await expect(thought(mira.id)).toHaveAccessibleName(/Крытый рынок.*Идёт к двери.*С трамваем/);
  await body(mira.id).press('Enter');
  await toTick(page,250);
  await expect(thought(mira.id)).toHaveCount(0);
  await expect(page.locator('#inspector')).toHaveAttribute('data-id',mira.id);
  await expect(page.locator('#inspector [data-action="arrived"]')).toContainText('Крытый рынок');
});

test('a translated market keeps its awning and market destination icon', async ({page})=>{
  await open(page,'Клён');
  const old=page.locator('#map').getByRole('button',{name:'Крытый рынок',exact:true});
  const facade=await old.locator('polygon').count();
  await page.evaluate(()=>{
    const {createCity,startGame,advance,createMap}=LastTram;
    const city=createCity('Клён');
    city.buildings.find(b=>b.name==='Крытый рынок').name='Markthalle';
    const game=startGame(city); advance(game,100);
    createMap(document.querySelector('#map'),()=>{}).render(game,null,{enabled:true});
  });
  const market=page.locator('#map').getByRole('button',{name:'Markthalle',exact:true});
  await expect(market.locator('polygon')).toHaveCount(facade);
  await expect(page.getByRole('button',{name:/Мира: Markthalle/}).locator('use').first()).toHaveAttribute('href','#intent-market');
});

test('a pointer on a crowded platform can select either unlabelled person', async ({page})=>{
  await open(page,'Клён'); await toTick(page,74);
  await page.getByLabel('Потоки · Мысль').check();
  const map=page.locator('#map'), platform=map.getByRole('button',{name:'Мира',exact:true}).locator('.hit');
  const picker=page.getByRole('group',{name:'Жители в этой точке'});
  for (const name of ['Мира','Лев']) {
    await page.getByLabel('Выбрать здание').selectOption({label:'Ателье'});
    await expect(map.locator('[data-thought][data-id^="p:b:1:2:0"]')).toHaveCount(0);
    const {x,y,width,height}=await platform.boundingBox();
    await page.mouse.click(x+width/2,y+height/2);
    await picker.getByRole('button',{name:`${name} · Дворы, дом 1`}).click({timeout:2000});
    await expect(page.locator('#inspector h2')).toHaveText(name);
    await expect(page.locator('#inspector')).toContainText('Ждёт');
    await expect(page.getByLabel('Выбрать здание')).toHaveValue('');
  }
});

test('inspect stops and trains with no focus, a filtered building and a resident on the map', async ({page})=>{
  await open(page,'Клён'); await toTick(page,100);
  const map=page.locator('#map'), marker=map.locator('#marker');
  const info=page.getByRole('region',{name:'Объект сети'});
  const stop=map.getByRole('button',{name:'Площадь',exact:true});
  const train=map.getByRole('button',{name:'Поезд 01',exact:true});
  await stop.press('Enter');
  await expect(info.getByRole('heading')).toHaveText('Площадь');
  await expect(marker).toBeHidden();
  await train.press('Enter');
  await expect(info.getByRole('heading')).toHaveText('Поезд 01');
  await expect(marker).toBeHidden();
  await page.getByLabel('Выбрать здание').selectOption({label:'Крытый рынок'});
  await page.getByLabel('Потоки · Мысль').check();
  const outgoing=page.getByLabel('Из здания'), foot=page.getByLabel('Целиком пешком',{exact:true});
  await outgoing.uncheck(); await foot.uncheck();
  const thought=page.locator('[data-thought]'), count=await thought.count();
  expect(count).toBeGreaterThan(0);
  const atMarket=await marker.getAttribute('transform');
  const resident=page.getByLabel('Наблюдать за жителем'), card=page.locator('#inspector');
  for (const [target,title] of [[stop,'Площадь'],[train,'Поезд 01']]) {
    await target.press('Enter');
    await expect(info.getByRole('heading')).toHaveText(title);
    await expect(outgoing).not.toBeChecked(); await expect(foot).not.toBeChecked();
    await expect(page.getByRole('region',{name:'Журнал здания'})).toBeVisible();
    await expect(thought).toHaveCount(count);
    await expect(marker).toHaveAttribute('transform',atMarket);
  }
  await resident.selectOption({label:'Мира · Дворы, дом 1'});
  const onTrain=await marker.getAttribute('transform');
  for (const [target,title] of [[train,'Поезд 01'],[stop,'Площадь']]) {
    await target.press('Enter');
    await expect(info.getByRole('heading')).toHaveText(title);
    await expect(card.getByRole('heading',{name:'Мира'})).toBeVisible();
    await expect(card).toContainText('В вагоне');
    await expect(marker).toHaveAttribute('transform',onTrain);
  }
});

test('mobile building ledger shows a real time window, origins and network income; a replay preserves the live game', async ({page})=>{
  await page.setViewportSize({width:390,height:820});
  await open(page);
  await page.getByRole('combobox',{name:'Выбрать здание'}).selectOption({label:'Крытый рынок'},{timeout:2000});
  await page.getByRole('button',{name:'К 12:00 · День'}).click();
  await expect(page.locator('#clock')).toHaveText('12:00');
  const ledger=page.getByRole('region',{name:'Журнал здания'});
  const district=name=>ledger.getByRole('row',{name});
  await expect(district('Дворы 0 2')).toBeVisible();
  await expect(district('Типография 2 0')).toBeVisible();
  await expect(ledger).toContainText('Прибытий: 7');
  await expect(ledger).toContainText('Средний путь: 41,6 мин');
  await expect(ledger).toContainText('Выручка сети: 22 ₽');
  await ledger.getByLabel('Время прибытия').selectOption({label:'09:00–12:00'});
  await expect(ledger).toContainText('Прибытий: 0');
  await expect(ledger).toContainText('Нет прибытий');
  // Deliberately edit the live network; a replay must still start from the opening network.
  await page.getByText('Пульт сети',{exact:true}).click();
  await page.getByRole('button',{name:/Купить поезд/}).click();
  const gameState=()=>page.evaluate(()=>{
    const g=LastTram.ui.game;
    return [g.tick,g.cash,g.trains.length,g.fareIncome,g.history.arrivals(0,g.tick+1).length,LastTram.ui.focus];
  });
  const before=await gameState();
  await page.getByRole('button',{name:'Сравнить два утра'}).click();
  const comparison=page.getByRole('table',{name:'Два утра: Крытый рынок'});
  await expect(comparison.getByRole('row',{name:'Прибытия 7 7'})).toBeVisible();
  await expect(comparison.getByRole('row',{name:'С трамваем 2 3'})).toBeVisible();
  await expect(comparison.getByRole('row',{name:'Средний путь 41,6 мин 39 мин'})).toBeVisible();
  await expect(comparison.getByRole('row',{name:'Выручка сети 22 ₽ 24 ₽'})).toBeVisible();
  expect(await gameState()).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a dense expanded morning keeps a focused thought and a touch-sized list of real travelers', async ({page})=>{
  await page.setViewportSize({width:390,height:820});
  await open(page);
  await page.evaluate(()=>{ LastTram.ui.game.openRing=1; });
  await toTick(page,429);
  await page.getByLabel('Потоки · Мысль').check();
  const {count,id}=await page.evaluate(()=>{
    const active=LastTram.ui.game.residents.filter(r=>r.journey);
    return {count:active.length,id:active.find(r=>r.journey.startedAt>=410).id};
  });
  expect(count).toBe(82); // Measured peak for this seed with direct sidewalk routes.
  await expect(page.locator('[data-thought]')).toHaveCount(count);
  const target=page.locator(`[data-thought="${id}"]`);
  await target.focus();
  const elapsed=await page.evaluate(()=>{
    const start=performance.now();
    for (let i=0;i<24;i++) {
      LastTram.advance(LastTram.ui.game); LastTram.ui.render();
      document.querySelector('#thoughts').getBoundingClientRect(); // include SVG layout
    }
    return performance.now()-start;
  });
  expect(elapsed).toBeLessThan(1000);
  await expect(target).toBeFocused();
  const travelers=page.getByLabel('В пути сейчас');
  await expect(travelers).toBeVisible({timeout:2000});
  await travelers.selectOption(id);
  await expect(page.locator('#inspector')).toHaveAttribute('data-id',id);
  expect((await travelers.boundingBox()).height).toBeGreaterThanOrEqual(40);
});

test('outgoing-only shows departures from this door; either direction and either whole-trip mode can be empty', async ({page})=>{
  await open(page); await toTick(page,100);
  await page.getByLabel('Потоки · Мысль').check();
  const all=await page.locator('[data-thought]').count();
  await page.getByLabel('Выбрать здание').selectOption({label:'Дворы, дом 1'});
  await page.getByLabel('К зданию',{exact:true}).uncheck();
  const people=await page.evaluate(()=>{
    const g=LastTram.ui.game;
    return g.residents.filter(r=>r.journey?.originId===LastTram.ui.focus.id)
      .map(r=>({mode:r.journey.mode,id:r.id}));
  });
  expect(people.length).toBeGreaterThan(1);
  const list=page.getByLabel('В пути сейчас').locator('option:not([value=""])');
  await expect(list).toHaveCount(people.length);
  await page.getByLabel('С трамваем',{exact:true}).uncheck();
  expect(await list.evaluateAll(opts=>opts.map(o=>o.value))).toEqual(people.filter(p=>p.mode==='walk').map(p=>p.id));
  await page.getByLabel('Целиком пешком',{exact:true}).uncheck();
  await expect(page.locator('[data-thought]')).toHaveCount(0);
  await page.getByLabel('Из здания',{exact:true}).uncheck();
  await page.getByLabel('С трамваем',{exact:true}).check();
  await expect(page.locator('[data-thought]')).toHaveCount(0);
  await page.locator(`#moving [data-id="${people[0].id}"]`).press('Enter');
  await expect(page.locator('#inspector')).toHaveAttribute('data-id',people[0].id);
  await expect(page.locator('[data-thought]')).toHaveCount(all);
});
