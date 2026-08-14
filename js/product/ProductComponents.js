/* @flow */
'use strict';

import React, { useContext } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { ThemeContext } from '../ThemeContext';
import { productTheme, radius, spacing } from './DesignSystem';

export const useProductTheme = () =>
  productTheme(useContext(ThemeContext).name);

export const BrandMark = () => (
  <View
    accessible
    accessibilityRole="image"
    accessibilityLabel="Adjuster Network"
    style={styles.brandMarkViewport}
  >
    <Image
      source={require('../../img/adjuster-network-logo.png')}
      resizeMode="contain"
      style={styles.brandMark}
    />
  </View>
);

export const NestedHeader = ({ onBack, title = 'Member page' }) => {
  const colors = useProductTheme();
  return (
    <View
      style={[
        styles.nestedHeader,
        { backgroundColor: colors.canvas, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityHint="Returns to the previous Adjuster Network screen"
        hitSlop={8}
        onPress={onBack}
        style={styles.backButton}
      >
        <FontAwesome5
          name="chevron-left"
          size={15}
          color={colors.accent}
          iconStyle="solid"
        />
        <Text style={[styles.backLabel, { color: colors.accent }]}>Back</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        numberOfLines={1}
        style={[styles.nestedTitle, { color: colors.text }]}
      >
        {title}
      </Text>
      <BrandMark />
    </View>
  );
};

export const PageHeader = ({ eyebrow, title, action }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View style={styles.brandRow}>
          <BrandMark />
          {eyebrow ? (
            <Text
              maxFontSizeMultiplier={1.35}
              numberOfLines={1}
              style={[styles.eyebrow, { color: colors.muted }]}
            >
              {eyebrow}
            </Text>
          ) : null}
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.pageTitle, { color: colors.text }]}
        >
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
};

export const NotificationBell = ({ count = 0, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Notifications, ${count} unread` : 'Notifications'
      }
      hitSlop={8}
      onPress={onPress}
      style={[styles.notificationBell, { borderColor: colors.border }]}
    >
      <FontAwesome5
        name="bell"
        size={17}
        color={colors.accent}
        iconStyle="solid"
      />
      {count > 0 ? (
        <View
          style={[styles.notificationBadge, { backgroundColor: colors.danger }]}
        >
          <Text style={styles.notificationBadgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export const Card = ({ children, style, accessibilityLabel }) => {
  const colors = useProductTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Action = ({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
}) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: secondary ? colors.surface : colors.accent,
          borderColor: colors.accent,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? (
        <FontAwesome5
          name={icon}
          size={15}
          color={secondary ? colors.accent : '#FFFFFF'}
          iconStyle="solid"
        />
      ) : null}
      <Text
        style={[
          styles.actionText,
          { color: secondary ? colors.accent : '#FFFFFF' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const SectionTitle = ({ title, detail }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionHeading, { color: colors.text }]}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text>
      ) : null}
    </View>
  );
};

export const StateCard = ({
  title,
  body,
  icon = 'inbox',
  loading = false,
  action,
}) => {
  const colors = useProductTheme();
  return (
    <Card style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.accentSoft }]}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <FontAwesome5
            name={icon}
            size={18}
            color={colors.accent}
            iconStyle="solid"
          />
        )}
      </View>
      <View style={styles.stateCopy}>
        <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stateBody, { color: colors.muted }]}>{body}</Text>
        {action}
      </View>
    </Card>
  );
};

export const Pill = ({ label, selected, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        style={{ color: selected ? '#FFFFFF' : colors.text, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  notificationBell: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerCopy: { flex: 1 },
  brandRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  brandMarkViewport: {
    width: 42,
    height: 30,
    overflow: 'hidden',
    flexShrink: 0,
  },
  brandMark: {
    position: 'absolute',
    width: 68,
    height: 49,
    left: -13,
    top: -6,
  },
  eyebrow: {
    flex: 1,
    fontSize: 11,
    fontWeight: '650',
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
  nestedHeader: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    minWidth: 76,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  backLabel: { fontSize: 16, fontWeight: '650' },
  nestedTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '750',
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  action: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 16, fontWeight: '750' },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHeading: { fontSize: 20, fontWeight: '750' },
  detail: { fontSize: 14, marginTop: 3, lineHeight: 20 },
  state: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: { flex: 1 },
  stateTitle: { fontSize: 16, fontWeight: '700' },
  stateBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  pill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
