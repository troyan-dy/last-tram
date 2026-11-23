const { test: base, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// The browser gets only the files a player would unpack, never a dev server or the checkout.
const test = base.extend({
  release: async ({}, use, info) => {
    const root = path.resolve(__dirname, '..');
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'last-tram-release-'));
    try {
      execFileSync('git', ['archive', '--format=zip', '--prefix=last-tram/',
        `--output=${path.join(dir, 'city.zip')}`, revision], { cwd: root });
      if (process.platform === 'win32') {
        execFileSync('tar', ['-xf', 'city.zip'], { cwd: dir });
      } else {
        execFileSync('unzip', ['-q', 'city.zip'], { cwd: dir });
      }
      info.annotations.push({ type: 'git archive', description: revision });
      await use(pathToFileURL(path.join(dir, 'last-tram', 'index.html')).href);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test.use({ offline: true, viewport: { width: 390, height: 844 } });

test('from a walking decision to a new commuter service in the unpacked offline game', async ({ page, release }, info) => {
  test.setTimeout(90000);
  const button = name => page.getByRole('button', { name, exact: true });
  const seed = page.getByLabel('Сид города');
  const displayedSeed = page.locator('#city-seed');
  const map = page.getByRole('group', { name: 'Карта города' });
  const card = page.getByRole('region', { name: 'Наблюдение' });
  const travelers = page.getByLabel('В пути сейчас');
  const clock = page.locator('#clock');
  const stops = page.locator('#line-stops');
  const directory = page.getByLabel('Наблюдать за жителем');
  const train = page.getByLabel('Выбранный поезд').locator('option:checked');
  const goals = page.getByRole('region', { name: 'Цели города' });
  const consoleToggle = page.getByText('Пульт сети', { exact: true });
  const detail = (label, value) => expect(card.locator('dl div').filter({
    has: page.getByText(label, { exact: true })
  }).locator('dd')).toHaveText(value);
  async function step(time) {
    await page.getByRole('button', { name: new RegExp(`^К ${time}`) }).click();
    await expect(clock).toHaveText(time);
  }

  const external = [];
  page.on('request', req => { if (/^https?:/.test(req.url())) external.push(req.url()); });
  await page.goto(release);
  await seed.fill('Клён');
  await button('Новая партия').click();
  await expect(displayedSeed).toHaveText('Клён');
  const startingSeed = await displayedSeed.innerText();
  const centerBounds = await map.getAttribute('viewBox');
  await expect(button('Открыть кольцо · 80 ₽')).toBeDisabled();
  await page.getByLabel('Потоки · Мысль').check();
  const vera = 'Вера → Ателье · Идёт к двери · пешком';
  await expect(travelers.getByRole('option', { name: vera })).toBeAttached({ timeout: 18000 });
  await button('Пауза').click();
  await travelers.selectOption({ label: vera });
  await expect(card.getByRole('heading', { name: 'Вера' })).toBeVisible();
  await detail('Откуда', 'Липовая, дом 1');
  await detail('Цель', 'Ателье');
  await detail('Весь путь', 'Пешком');
  await detail('Целиком пешком', '36,2 мин');
  await detail('С трамваем', '66,2 мин');
  await expect(card.getByText(/Далеко идти до остановки или от неё/)).toBeVisible();

  await consoleToggle.click();
  await page.getByLabel('Цена билета').fill('3');
  await button('Установить тариф').click();
  await expect(page.getByRole('status')).toHaveText('Тариф для новых перемещений изменён.');
  await detail('Билет', '2 ₽'); // Vera keeps the choice she made at departure.
  await step('12:00');
  await expect(card.getByText('У двери: Ателье')).toBeVisible();
  await detail('Прибытие', '08:17');
  await page.getByLabel('Выбрать здание').selectOption({ label: 'Ателье' });
  const ledger = page.getByRole('region', { name: 'Журнал здания' });
  await ledger.getByLabel('День наблюдения').selectOption({ label: 'День 1' });
  await ledger.getByLabel('Время прибытия').selectOption({ label: '07:30–09:00' });
  await expect(ledger).toContainText('Период завершён.');
  await expect(ledger).toContainText('Прибытий: 5');
  await expect(ledger).toContainText('Средний путь: 29,2 мин');
  for (const name of ['Липовая 2 0', 'Типография 1 0', 'Площадь 2 0']) {
    await expect(ledger.getByRole('row', { name, exact: true })).toBeVisible();
  }
  await expect(ledger).toContainText('Выручка сети: 21 ₽');

  await directory.selectOption({ label: 'Вера · Липовая, дом 1' });
  await step('17:30');
  await expect(card.getByText('У двери: Почта')).toBeVisible();
  await detail('Откуда', 'Ателье');
  await detail('Прибытие', '13:00');
  await button('Скорость').click();
  await button('Продолжить').click();
  await detail('Цель', 'Липовая, дом 1');
  await button('Пауза').click();
  await expect(card.getByText('Идёт к двери')).toBeVisible();
  await detail('Откуда', 'Почта');
  await step('21:30');
  await expect(card.getByRole('heading', { name: 'Вера' })).toBeVisible();
  await expect(card.getByText('У двери: Липовая, дом 1')).toBeVisible();
  await detail('Прибытие', '18:40');

  await expect(goals).toContainText('24 из 3 поездок с трамваем');
  await expect(goals).toContainText('66 из 16 ₽');
  await expect(goals).toContainText('В кассе 146 ₽ · Цена кольца 80 ₽');
  await expect(stops).toHaveText('ДворыПлощадьРынок');
  const originalTrain = await train.innerText();
  await button('Открыть кольцо · 80 ₽').click();
  await expect(button('Открыть кольцо · 80 ₽')).toBeHidden();
  await expect(goals).toContainText('0 из 1');
  await expect(page.locator('#network-money')).toHaveText('Касса 66 ₽ · Билет 3 ₽');
  await expect(page.locator('#fleet')).toHaveText('Поездов: 1');
  await expect(train).toHaveText(originalTrain);
  await expect(stops).toHaveText('ДворыПлощадьРынок');
  const ringBounds = await map.getAttribute('viewBox');
  expect(ringBounds).not.toBe(centerBounds);
  await page.getByLabel('Новый участок').selectOption({ label: 'Рынок — Вокзал' });
  await button('Построить путь · 12 ₽').click();
  await expect(page.getByRole('status')).toHaveText('Участок построен.');
  await page.getByLabel('Добавить остановку').selectOption({ label: 'Вокзал' });
  await button('Добавить').click();
  await button('Сохранить остановки').click();
  await expect(stops).toHaveText('ДворыПлощадьРынокВокзал');
  await consoleToggle.click();
  await page.getByLabel('Потоки · Мысль').uncheck();
  await step('07:30');
  await expect(page.locator('#clock-period')).toHaveText('День 2 · Утро');
  await directory.selectOption({ label: 'Марк · Сады, дом 3' });
  await button('Скорость').click(); // 12× for the longer walk to Vokzal.
  await button('Продолжить').click();
  await expect(card.getByText('В вагоне', { exact: true })).toBeVisible({ timeout: 15000 });
  await detail('Откуда', 'Сады, дом 3');
  await detail('Цель', 'Мастерская');
  await expect(card.getByText('Идёт к двери')).toBeVisible();
  await expect(goals).toContainText('0 из 1'); // Alighting is not an arrival.
  await expect(card.getByText('У двери: Мастерская')).toBeVisible();
  await button('Пауза').click();
  await step('12:00');
  await expect(goals).toContainText('Всего таких поездок: 1');
  await expect(goals).toContainText('Первая поездка — Марк: Сады, дом 3 → Мастерская. Посадка: Вокзал. Прибытие: день 2, 09:44. На 10 мин быстрее, чем пешком.');
  await directory.selectOption({label:'Ася · Вокзал, дом 3'});
  await detail('Весь путь','Пешком'); // Her 3-tick saving isn't worth a 3 ₽ ticket.
  await expect(card.getByText('Выигрыш во времени не оправдывает билет.')).toBeVisible();
  await goals.getByRole('button', { name: /Показать пассажира сейчас/ }).click();
  await expect(card.getByRole('heading', { name: 'Марк' })).toBeVisible();
  await expect(card.getByText('У двери: Мастерская')).toBeVisible();
  await detail('Прибытие', '09:44');
  await detail('Весь путь', 'С трамваем');

  await button('Приблизить').click();
  await expect(map).not.toHaveAttribute('viewBox', ringBounds);
  await button('Вся зона').click();
  await expect(map).toHaveAttribute('viewBox', ringBounds);
  await expect(button('Вся зона')).toBeInViewport();
  expect(await page.locator('html').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390);
  // A desktop view of this actual paused game, suitable for the playtest notes.
  await page.setViewportSize({ width: 1366, height: 1000 });
  await seed.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ring-passenger.jpg'), quality: 88 });

  // Enter the seed printed on the map again. The service and city clock reset;
  // the same city's geometry and Vera's original walking choice recur.
  await seed.fill(startingSeed);
  await button('Новая партия').click();
  await expect(map).toHaveAttribute('viewBox', centerBounds);
  await expect(page.locator('#clock-period')).toHaveText('День 1 · Утро');
  await expect(stops).toHaveText('ДворыПлощадьРынок');
  await expect(page.locator('#network-money')).toHaveText('Касса 80 ₽ · Билет 2 ₽');
  await expect(button('Открыть кольцо · 80 ₽')).toBeDisabled();
  await expect(map.getByRole('button', { name: 'Вокзал, дом 3', exact: true })).toHaveCount(0);
  await button('Пауза').click();
  await step('12:00');
  await directory.selectOption({ label: 'Вера · Липовая, дом 1' });
  await expect(card.getByText('У двери: Ателье')).toBeVisible();
  await detail('Прибытие', '08:17');
  await detail('С трамваем', '66,2 мин');
  await page.getByLabel('Выбрать здание').selectOption({ label: 'Ателье' });
  await expect(ledger).toContainText('Прибытий: 5');
  await expect(ledger).toContainText('Средний путь: 29,2 мин');
  await expect(ledger).toContainText('Выручка сети: 18 ₽');
  expect(external).toEqual([]);
});
