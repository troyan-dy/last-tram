const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test.use({offline:true});
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
  await expect(page.locator('#inspector h2')).toHaveText('Поезд 02');
  await page.getByLabel('Рабочий маршрут').selectOption('line-1');
  await page.getByRole('button',{name:'Назначить на маршрут'}).click();
  await expect(page.locator('#inspector')).toContainText('Линия 01');
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
