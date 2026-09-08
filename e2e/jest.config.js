/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/e2e'],
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  // Governs hooks as well as tests. The logged-out suite's beforeEach performs
  // a full device.launchApp({ delete: true }) reinstall, and on a cold macOS
  // runner that has exceeded 120s outright - one observed sibling test passed
  // at 119027ms, a second under the old budget. 180s accommodates the
  // documented slowness without touching any element matcher.
  testTimeout: 180000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
