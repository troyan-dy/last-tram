const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test.use({offline:true});
test('the same walker can explain long approaches in the morning and a long wait at noon',async({page})=>{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.getByLabel('Сид города').fill('Клён');
  await page.getByRole('button',{name:'Новая партия'}).click();
  await page.getByRole('button',{name:'Пауза'}).click();
  await page.getByLabel('Наблюдать за жителем').selectOption({label:'Вера · Липовая, дом 1'});
  async function at(tick) {
    await page.evaluate(t=>{const {ui,advance}=LastTram;advance(ui.game,t-ui.game.tick);ui.render();},tick);
  }
  const card=page.locator('#inspector .choice');
  await at(74);
  await expect(card).toContainText('Далеко идти до остановки или от неё');
  await at(1810);
  await expect(card).toContainText('Долго ждать поезд');
});

test('stop signs and the network card distinguish a draft service, an empty transfer and actual calls',async({page})=>{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.getByRole('button',{name:'Пауза'}).click();
  await page.getByText('Пульт сети',{exact:true}).click();
  for (const id of ['s:1:1/s:2:1','s:1:1/s:1:2']) {
    await page.getByLabel('Новый участок').selectOption(id);
    await page.getByRole('button',{name:/Построить путь/}).click();
  }
  await page.getByRole('button',{name:'Новый маршрут'}).click();
  for (const id of ['s:1:1','s:2:1']) {
    await page.getByLabel('Добавить остановку').selectOption(id);
    await page.getByRole('button',{name:'Добавить',exact:true}).click();
  }
  await page.getByRole('button',{name:'Сохранить остановки'}).click();
  const map=page.locator('#map'), labels=map.locator('.stop-label');
  const info=page.getByRole('region',{name:'Объект сети'});
  await map.getByRole('button',{name:'Липовая',exact:true}).press('Enter');
  await expect(labels.filter({hasText:'Липовая'})).toHaveCount(0);
  await expect(info).toContainText('По плануЛиния 02');
  await expect(info).toContainText('ОбслуживаниеНет поездов');
  await page.getByRole('button',{name:'Назначить на маршрут'}).click();
  await page.evaluate(()=>{ LastTram.advance(LastTram.ui.game); LastTram.ui.render(); });
  await expect(labels).toHaveCount(0);
  await expect(info).toContainText('ОбслуживаниеНет поездов');
  await page.evaluate(()=>{ LastTram.advance(LastTram.ui.game,500); LastTram.ui.render(); });
  await expect(labels).toHaveCount(2);
  await expect(labels.filter({hasText:'Липовая'})).toBeVisible();
  await expect(info).toContainText('ОбслуживаниеЛиния 02');
});

test('edit shared track service, reassign a particular train and inspect a real fare decision offline', async ({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.getByLabel('Сид города').fill('Ива');
  await page.getByRole('button',{name:'Новая партия'}).click();
  await page.getByRole('button',{name:'Пауза'}).click();
  await page.getByText('Пульт сети',{exact:true}).click();
  await page.getByLabel('Новый участок').selectOption('s:3:1/s:3:2');
  await page.getByRole('button',{name:/Построить путь/}).click();
  await page.getByRole('button',{name:'Новый маршрут'}).click();
  for (const id of ['s:1:2','s:3:1']) {
    await page.getByLabel('Добавить остановку').selectOption(id);
    await page.getByRole('button',{name:'Добавить',exact:true}).click();
  }
  await page.getByRole('button',{name:'Сохранить остановки'}).click();
  await expect(page.locator('#line-stops')).toHaveText('ДворыСквер');
  await page.getByRole('button',{name:/Купить поезд/}).click();
  await page.getByRole('button',{name:'Показать поезд'}).click();
  const trainInfo=page.getByRole('region',{name:'Объект сети'});
  await expect(trainInfo.getByRole('heading')).toHaveText('Поезд 02');
  await page.getByLabel('Рабочий маршрут').selectOption('line-1');
  await page.getByRole('button',{name:'Назначить на маршрут'}).click();
  await expect(trainInfo).toContainText('Линия 01');
  await page.getByLabel('Цена билета').fill('99');
  await page.getByRole('button',{name:'Установить тариф'}).click();
  await expect(page.locator('#network-money')).toContainText('32 ₽');
  await expect(page.locator('#network-money')).toContainText('99 ₽');
  await page.getByLabel('Наблюдать за жителем').selectOption('p:b:1:2:0:0');
  await page.getByRole('button',{name:'Скорость'}).click();
  await page.getByRole('button',{name:'Продолжить'}).click();
  const card=page.locator('#inspector');
  await expect(card).toContainText('Выбор у двери');
  await expect(card).toContainText('99 ₽');
  await expect(card).toContainText('Последний участок');
  expect(errors).toEqual([]);
});

test('on a narrow screen change a live route in the cab, keep its rider and collect the fare only once',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.getByLabel('Сид города').fill('Клён');
  await page.getByRole('button',{name:'Новая партия'}).click();
  await page.getByLabel('Наблюдать за жителем').selectOption('p:b:1:2:0:0');
  await page.getByRole('button',{name:'Скорость'}).click();
  const card=page.locator('#inspector');
  await expect(card).toContainText('В вагоне',{timeout:12000});
  await page.getByRole('button',{name:'Пауза'}).click();
  const before=await page.evaluate(()=>{
    const g=LastTram.ui.game,r=g.residents[0];
    return {tick:g.tick,train:r.onTrainId,position:r.position,eta:r.journey.startedAt+r.journey.decision.tramTicks};
  });
  expect(before.train).toBe('train-1');
  await page.getByText('Пульт сети',{exact:true}).click();
  await page.getByRole('button',{name:'Убрать Рынок'}).click();
  await page.getByRole('button',{name:'Сохранить остановки'}).click();
  await expect(page.locator('#line-stops')).toHaveText('ДворыПлощадь');
  expect(await page.evaluate(()=>[LastTram.ui.game.residents[0].onTrainId,LastTram.ui.game.residents[0].position]))
    .toEqual([before.train,before.position]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Продолжить'}).click();
  await expect(card.locator('[data-action="arrived"]')).toBeVisible({timeout:15000});
  await expect(card).toContainText('Крытый рынок');
  const arrival=await page.evaluate(()=>{
    const g=LastTram.ui.game,r=g.residents[0];
    return {at:r.lastJourney.arrivedAt,mode:r.lastJourney.mode,atWork:r.currentBuildingId===r.workId};
  });
  expect(arrival).toEqual({at:before.eta,mode:'tram',atWork:true});
});
