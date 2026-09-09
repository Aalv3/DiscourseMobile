/* @flow */
'use strict';

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Action,
  Card,
  V2BrandHeader,
  useProductTheme,
} from './ProductComponents';
import { spacing } from './DesignSystem';

// Renders entirely from the notification payload. It makes no network request:
// everything shown here arrived with the notification, so the screen cannot
// fail, stall, or need a session. Badge artwork and description are
// deliberately absent - both would require a fetch.
const BadgeEarnedScreen = ({ navigation, route }) => {
  const colors = useProductTheme();
  const name = route?.params?.name;
  const close = () => navigation.goBack();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <V2BrandHeader title="Badge earned" onBack={close} />
      <View style={styles.body}>
        <Card accessibilityLabel={`Badge earned: ${name}`}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        </Card>
        <View style={styles.action}>
          <Action label="Close" onPress={close} secondary />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default BadgeEarnedScreen;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.md },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '750',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  action: { marginTop: spacing.lg, alignItems: 'center' },
});
