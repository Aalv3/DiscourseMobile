/* global jest */
const { NativeModules } = require('react-native');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

NativeModules.DiscourseKeyboardShortcuts = {
  ...(NativeModules.DiscourseKeyboardShortcuts || {}),
  pushEnvironment: 'production',
};
