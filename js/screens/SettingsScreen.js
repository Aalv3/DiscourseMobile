/* @flow */
'use strict';

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeMemberSite } from '../product/ProductData';
import { useProductTheme } from '../product/ProductComponents';
import { radius, spacing } from '../product/DesignSystem';

const Row = ({ icon, title, detail, onPress, disabled = false }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={title}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.6 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <FontAwesome5 name={icon} iconStyle="solid" size={17} color={colors.accent} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      {onPress ? <FontAwesome5 name="chevron-right" iconStyle="solid" size={13} color={colors.muted} /> : null}
    </Pressable>
  );
};

const SettingsScreen = ({ screenProps }) => {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const username = site?.username;
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.muted }]}>Member controls stay inside Adjuster Network. Advanced Discourse administration is deferred for Build 1.</Text>
        <Row icon="user-circle" title="Account" detail={username ? `Signed in as @${username}` : 'Authenticated member account'} />
        <Row icon="address-card" title="Profile" detail="View contributions or edit permitted profile fields" onPress={() => screenProps.openUrl(`${site.url}/u/${username}`)} />
        <Row icon="bell" title="Notifications" detail="Manage device notification permission" onPress={screenProps.enablePush} />
        <Row icon="adjust" title="Appearance" detail="Follows the device light or dark appearance" />
        <Row icon="shield-alt" title="Privacy & Account" detail="Credentials remain in secure native storage; claim data does not belong in posts" />
        <Row icon="sliders" title="Advanced Settings" detail="Deferred for Build 1—no unauthenticated web fallback" disabled />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, paddingBottom: spacing.xl },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  row: { minHeight: 70, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});

export default SettingsScreen;
