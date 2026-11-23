const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({ offline: true });
for (const seed of ['Клён', 'Ива']) {
  test(`offline morning on seed ${seed}: zoom, pick a resident and follow them to work`, async ({ page }) => {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.getByRole('textbox', { name: 'Сид города' }).fill(seed);
    await page.getByRole('button', { name: 'Новая партия' }).click();
    await page.getByRole('button', { name: 'Пауза' }).click();
    await expect(page.locator('#city-seed')).toHaveText(seed);
    const svg = page.locator('#map');
    const fit = await svg.getAttribute('viewBox');
    const resident = svg.locator('[data-type="resident"]').first();
    const id = await resident.getAttribute('data-id');
    const { x, y, width, height } = await resident.locator('.hit').boundingBox();
    await page.mouse.move(x + width / 2, y + height / 2);
    await page.mouse.wheel(0, -430);
    await expect(svg).not.toHaveAttribute('viewBox', fit);
    await page.mouse.click(x + width / 2, y + height / 2);
    const inspector = page.locator('#inspector');
    await expect(inspector).toHaveAttribute('data-id', id);
    await page.getByRole('button', { name: 'Вся зона' }).click();
    await expect(svg).toHaveAttribute('viewBox', fit);
    await page.getByRole('button', { name: 'Скорость' }).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(inspector).toContainText('В вагоне', { timeout: 15000 });
    await expect(inspector.locator('[data-action="arrived"]')).toBeVisible({ timeout: 15000 });
    await expect(inspector).toHaveAttribute('data-id', id);
    await expect(inspector).toContainText('Крытый рынок');
  });
}
