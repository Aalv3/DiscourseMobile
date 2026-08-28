/* @flow */
'use strict';

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from './DesignSystem';

export default function ProfileSaveCooldownControl({ seconds, colors }) {
  return (
    <View
      accessibilityLabel={`Save profile unavailable. Please wait ${seconds} seconds.`}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={[
        styles.control,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.muted }]}>
        Cooldown active
      </Text>
      <Text style={[styles.countdown, { color: colors.muted }]}>
        Please wait {seconds}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    minHeight: 52,
    minWidth: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    opacity: 0.72,
  },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  countdown: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
});
