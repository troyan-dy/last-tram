const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: {
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
    screenshot: 'only-on-failure'
  }
});
