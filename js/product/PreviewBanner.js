/* @flow */
'use strict';

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { adjusterNetwork } from '../adjusterNetworkConfig';

// A persistent marker for the founder-only Preview build. It is derived from
// the compiled-in OTA channel, so it cannot appear on Production and cannot be
// switched off from inside the app.
//
// Deliberately inert: it renders nothing interactive, intercepts no touches,
// and changes no behaviour. Preview points at the real production server, and
// what is validated there has to be exactly what ships.
export const PREVIEW_LABEL = 'PREVIEW';
export const PREVIEW_AMBER = '#D9891F';

const PreviewBanner = ({ channel = adjusterNetwork.channel }) => {
  if (channel !== 'preview') return null;
  return (
    <View pointerEvents="none" style={styles.strip} accessible={false}>
      <Text
        accessibilityRole="text"
        accessibilityLabel="Adjuster Network Preview build"
        style={styles.label}
      >
        {PREVIEW_LABEL}
      </Text>
    </View>
  );
};

export default PreviewBanner;

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Above every screen and modal, including the status bar area.
    zIndex: 9999,
    elevation: 9999,
    height: Platform.OS === 'ios' ? 22 : 18,
    backgroundColor: PREVIEW_AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#1A1206',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
