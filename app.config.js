'use strict';

const runtimeVersion = 'an-ios-android-1.0.0-native-1';

module.exports = {
  name: 'Adjuster Network',
  slug: 'adjuster-network',
  version: '1.0.0',
  owner: 'aalvarez33',
  runtimeVersion,
  updates: {
    url: 'https://u.expo.dev/1142c79f-1c43-412a-a2ef-1efb3951177a',
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    useEmbeddedUpdate: true,
    disableAntiBrickingMeasures: false,
    requestHeaders: {
      'expo-channel-name': process.env.AN_OTA_CHANNEL || 'production',
    },
  },
  extra: {
    eas: {
      projectId: '1142c79f-1c43-412a-a2ef-1efb3951177a',
    },
    ota: {
      gitSha: process.env.AN_OTA_GIT_SHA || 'local-unset',
      runtimeVersion,
    },
  },
  android: {},
  ios: {},
};
