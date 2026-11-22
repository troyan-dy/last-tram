const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test.use({ offline: true });

test('the player steps the paused city to each demand period and through midnight on the same clock', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.getByRole('button', { name: 'Пауза' }).click();
  const clock = page.locator('#clock'), period = page.locator('#clock-period');
  const next = page.getByRole('button', { name: /^К / });
  await expect(next).toHaveAccessibleName('К 12:00 · День', { timeout: 2000 });
  await page.getByRole('button', { name: /Найти жителя/ }).click();
  const inspector = page.locator('#inspector');
  const focus = await inspector.getAttribute('data-id');
  for (const [time, text] of [
    ['12:00', 'День 1 · День'], ['17:30', 'День 1 · Вечер'], ['21:30', 'День 1 · Ночь'], ['07:30', 'День 2 · Утро']
  ]) {
    await next.click();
    await expect(clock).toHaveText(time);
    await expect(period).toHaveText(text);
    await expect(page.getByRole('button', { name: 'Продолжить' })).toBeVisible();
    await expect(inspector).toHaveAttribute('data-id', focus);
  }
  await expect(inspector.locator('[data-action="moving"]')).toBeVisible();
  const model = await page.evaluate(() => {
    const { ui, clockMinute } = LastTram, r = ui.game.residents.find(r => r.id === ui.focus.id);
    return { time: clockMinute(ui.game), fromHome: r.journey.originId === r.homeId,
      goingToWork: r.journey.destinationId === r.workId, previous: r.lastJourney.destinationId === r.homeId };
  });
  expect(model).toEqual({ time: 1890, fromHome: true, goingToWork: true, previous: true });
});

// Measure the rendered pixels, including any ancestor filters; SVG fill attributes alone can lie.
async function colors(page, locator) {
  const image = (await locator.screenshot()).toString('base64');
  return page.evaluate(async png => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const palette = new Set();
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      brightness += .2126*r + .7152*g + .0722*b;
      palette.add((r << 16) + (g << 8) + b);
    }
    return { brightness: brightness/(img.width*img.height), train: palette.has(0xc65d40),
      stop: palette.has(0xbc563c), label: palette.has(0x324d42) };
  }, image);
}

test('the same street changes light while the train, stop signs, labels and selected building stay legible', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.getByRole('button', { name: 'Пауза' }).click();
  const map = page.locator('#map');
  const shop = map.getByRole('button', { name: 'Крытый рынок', exact: true });
  await shop.focus();
  await shop.press('Enter');
  const view = await map.getAttribute('viewBox');
  const inspector = page.locator('#inspector');
  const panelColor = await inspector.evaluate(el => getComputedStyle(el).backgroundColor);
  const light = [];
  for (const time of ['07:30', '12:00', '17:30', '21:30']) {
    if (time !== '07:30') {
      await page.locator('#next-period').click();
      await expect(page.locator('#clock')).toHaveText(time);
    }
    light.push((await colors(page, shop)).brightness);
    expect(await colors(page, map)).toMatchObject({ train: true, stop: true, label: true });
    await expect(map).toHaveAttribute('viewBox', view);
    await expect(inspector.getByRole('heading')).toHaveText('Крытый рынок');
    await expect(inspector).toHaveCSS('background-color', panelColor);
  }
  const [morning, day, evening, night] = light;
  expect(day).toBeGreaterThan(morning + 2);
  expect(morning).toBeGreaterThan(evening + 6);
  expect(evening).toBeGreaterThan(night + 6);
});
