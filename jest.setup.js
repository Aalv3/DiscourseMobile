const { NativeModules } = require('react-native');

NativeModules.DiscourseKeyboardShortcuts = {
  ...(NativeModules.DiscourseKeyboardShortcuts || {}),
  pushEnvironment: 'production',
};
