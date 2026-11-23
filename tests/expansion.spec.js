const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test.use({ offline: true });
const button = (page, name) => page.getByRole('button', { name });
async function extendToStation(page) {
  await page.getByLabel('Новый участок').selectOption({ label: 'Рынок — Вокзал' });
  await button(page, /Построить путь/).click();
  await page.getByLabel('Добавить остановку').selectOption({ label: 'Вокзал' });
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await button(page, 'Сохранить остановки').click();
}

test('open a ring on the paused map and carry a named resident from its new stop to a real door', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.getByLabel('Сид города').fill('Клён');
  await page.getByRole('button', { name: 'Новая партия' }).click();
  await page.getByRole('button', { name: 'Пауза' }).click();
  const goals = page.getByRole('region', { name: 'Цели города' });
  const purchase = goals.getByRole('button', { name: /Открыть кольцо/ });
  await expect(purchase).toBeDisabled();
  await expect(goals).toContainText('Сначала выполните цель');
  await expect(goals).toContainText('0 из 3');
  const next = page.locator('#next-period');
  await next.click();
  await expect(page.locator('#clock')).toHaveText('12:00');
  await expect(goals).toContainText('24 из 16 ₽');
  await expect(goals).toContainText('104 ₽');
  await expect(purchase).toBeEnabled();
  await purchase.click();
  await expect(page.locator('#zone-label')).toContainText('КОЛЬЦО');
  await expect(goals).toContainText('0 из 1');
  await expect(page.locator('#line-stops')).toHaveText('ДворыПлощадьРынок');
  const map = page.getByRole('group', { name: 'Карта города' });
  await expect(map.getByRole('button', { name: 'Вокзал, дом 3', exact: true })).toBeVisible();
  await goals.getByText('Пример связи', { exact: true }).click();
  await expect(goals).toContainText('Рынок — Вокзал');
  await expect(goals).toContainText('Ателье');
  await page.getByText('Пульт сети', { exact: true }).click();
  await extendToStation(page);
  await expect(page.locator('#line-stops')).toHaveText('ДворыПлощадьРынокВокзал');
  await next.click();
  await expect(page.locator('#clock')).toHaveText('17:30');
  await expect(goals).toContainText('1 из 1');
  await expect(goals).toContainText('Марк');
  await expect(goals).toContainText('Вокзал, дом 3 → Ателье');
  await expect(goals).toContainText('28,2 мин');
  await goals.getByRole('button', { name: /Показать пассажира/ }).click();
  const card = page.getByRole('region', { name: 'Наблюдение' });
  await expect(card.getByRole('heading', { name: 'Марк' })).toBeVisible();
  await expect(card).toContainText('14:30');
  const proof = await page.evaluate(() => {
    const { game, focus } = LastTram.ui, r = game.residents.find(r => r.id === focus.id);
    return [r.currentBuildingId, r.lastJourney.originId, r.lastJourney.mode, r.lastJourney.arrivedAt,
      r.position, game.lookup.buildings.get(r.currentBuildingId).entrance];
  });
  expect(proof.slice(0,4)).toEqual(['b:1:2:1','b:4:2:2','tram',2525]);
  expect(proof[4]).toEqual(proof[5]);

  await next.click();
  await expect(page.locator('#clock')).toHaveText('21:30');
  await page.getByLabel('Выбрать здание').selectOption({ label: 'Ателье' });
  await goals.getByRole('button', { name: /Показать пассажира сейчас/ }).click();
  await expect(card.getByRole('heading', { name: 'Марк' })).toBeVisible();
  await expect(card).toContainText('У двери: Вокзал, дом 3');
  await expect(goals).toContainText('Первая поездка — Марк: Вокзал, дом 3 → Ателье.');
  await expect(goals).toContainText('Прибытие: день 1, 14:30.');

  await page.getByRole('button', { name: 'Новая партия' }).click();
  await expect(goals).toContainText('0 из 3');
  await expect(purchase).toBeDisabled();
  await expect(map.getByRole('button', { name: 'Вокзал, дом 3', exact: true })).toHaveCount(0);
});

test('after the evening return open the ring at night and serve a commuter next morning', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.getByLabel('Сид города').fill('Клён');
  await button(page, 'Новая партия').click();
  await button(page, 'Пауза').click();
  await page.getByText('Пульт сети', { exact: true }).click();
  await page.getByLabel('Цена билета').fill('3');
  await button(page, 'Установить тариф').click();
  async function next(time) {
    await button(page, new RegExp(`^К ${time}`)).click();
    await expect(page.locator('#clock')).toHaveText(time);
  }
  await next('12:00');
  await next('17:30');
  await next('21:30');
  const goals = page.getByRole('region', { name: 'Цели города' });
  await goals.getByRole('button', { name: /Открыть кольцо/ }).click();
  await expect(goals).toContainText('0 из 1');
  await extendToStation(page);
  await next('07:30');
  await next('12:00');
  await expect(goals).toContainText('Ася: Вокзал, дом 3 → Крытый рынок');
  await expect(goals).toContainText('9,7 мин');
  await goals.getByRole('button', { name: /Показать пассажира/ }).click();
  await expect(page.locator('#inspector')).toContainText('08:21');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
