module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^expo-updates$': '<rootDir>/js/__mocks__/expo-updates.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/ios/Pods/'],
};
