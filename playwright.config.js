const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js', // keep separate from Jest's *.test.js files
  timeout: 60000,
  reporter: 'list',
  use: {
    headless: false,
  },
});
