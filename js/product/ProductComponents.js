/* @flow */
'use strict';

import React, { useContext } from 'react';
import {
  ActivityIndicator,
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

export const PageHeader = ({ eyebrow, title, action }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {eyebrow}
          </Text>
        ) : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
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
