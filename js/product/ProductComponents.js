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
import { productTheme, radius, spacing, type } from './DesignSystem';

export const useProductTheme = () =>
  productTheme(useContext(ThemeContext).name);

export const BrandMark = ({ prominent = false }) => (
  <View
    accessible
    accessibilityRole="image"
    accessibilityLabel="Adjuster Network"
    style={
      prominent ? styles.brandMarkViewportProminent : styles.brandMarkViewport
    }
  >
    <Image
      source={require('../../img/adjuster-network-logo.png')}
      resizeMode="contain"
      style={prominent ? styles.brandMarkProminent : styles.brandMark}
    />
  </View>
);

export const NestedHeader = ({ onBack, title = 'Member page' }) => {
  const colors = useProductTheme();
  return (
    <View
      style={[
        styles.nestedHeader,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityHint="Returns to the previous Adjuster Network screen"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
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
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View
        accessibilityElementsHidden
        style={[
          styles.headerBrandRule,
          { backgroundColor: colors.brandAccent },
        ]}
      />
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

export const V2BrandHeader = ({
  title,
  subtitle,
  onBack,
  onSearch,
  onNotifications,
  notificationCount = 0,
}) => {
  const colors = useProductTheme();
  return (
    <View
      style={[
        styles.v2Header,
        {
          backgroundColor: colors.surfaceRaised,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.v2HeaderTop}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={onBack}
            style={styles.v2HeaderControl}
          >
            <FontAwesome5
              name="chevron-left"
              size={17}
              color={colors.text}
              iconStyle="solid"
            />
          </Pressable>
        ) : null}
        <View style={styles.v2BrandLockup}>
          <BrandMark prominent={!onBack} />
        </View>
        <View style={styles.v2HeaderActions}>
          {onSearch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search the Network"
              hitSlop={8}
              onPress={onSearch}
              style={[styles.v2HeaderControl, { borderColor: colors.border }]}
            >
              <FontAwesome5
                name="search"
                size={16}
                color={colors.text}
                iconStyle="solid"
              />
            </Pressable>
          ) : null}
          {onNotifications ? (
            <NotificationBell
              count={notificationCount}
              onPress={onNotifications}
            />
          ) : null}
        </View>
      </View>
      {title ? (
        <View
          style={[styles.v2HeaderCopy, onBack && styles.v2HeaderCopyNested]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.v2HeaderTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.v2HeaderSubtitle, { color: colors.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
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
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        pressed && !disabled ? styles.actionPressed : null,
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
    <View style={[styles.sectionTitle, { borderBottomColor: colors.border }]}>
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
    <View style={[styles.state, { borderColor: colors.border }]}>
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
    </View>
  );
};

export const Pill = ({ label, selected, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? colors.text : 'transparent',
          borderColor: selected ? colors.text : colors.borderStrong,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.canvas : colors.text,
          fontWeight: '650',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const Avatar = ({ label, uri, size = 40 }) => {
  const colors = useProductTheme();
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        accessibilityLabel={`${label} profile photo`}
        source={{ uri }}
        style={style}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${label} profile placeholder`}
      style={[styles.avatarFallback, style, { backgroundColor: colors.accent }]}
    >
      <Text
        style={[styles.avatarInitial, { fontSize: Math.max(13, size * 0.4) }]}
      >
        {(label || 'M').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
};

export const MemberAvatar = Avatar;

export const ContentSkeleton = ({ rows = 3 }) => {
  const colors = useProductTheme();
  return (
    <View accessibilityLabel="Loading content" style={styles.skeleton}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <View
            style={[
              styles.skeletonAvatar,
              { backgroundColor: colors.surfaceAlt },
            ]}
          />
          <View style={styles.skeletonCopy}>
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.surfaceAlt },
              ]}
            />
            <View
              style={[
                styles.skeletonLineShort,
                { backgroundColor: colors.surfaceAlt },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

export const InlineState = ({ title, body, icon = 'inbox', action }) => {
  const colors = useProductTheme();
  return (
    <View style={[styles.inlineState, { borderColor: colors.border }]}>
      <FontAwesome5
        name={icon}
        size={18}
        color={colors.accent}
        iconStyle="solid"
      />
      <View style={styles.stateCopy}>
        <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stateBody, { color: colors.muted }]}>{body}</Text>
        {action ? <View style={styles.inlineAction}>{action}</View> : null}
      </View>
    </View>
  );
};

export const Metadata = ({ children, accent = false }) => {
  const colors = useProductTheme();
  return (
    <Text
      style={[
        styles.metadata,
        { color: accent ? colors.accent : colors.muted },
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  v2Header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  v2HeaderTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2BrandLockup: { flex: 1, minWidth: 0 },
  v2HeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  v2HeaderControl: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  v2HeaderCopy: { paddingTop: spacing.xs, paddingBottom: spacing.xxs },
  v2HeaderCopyNested: { paddingTop: 2 },
  v2HeaderTitle: { ...type.title, fontSize: 24, lineHeight: 29 },
  v2HeaderSubtitle: {
    ...type.body,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 1,
    maxWidth: 680,
  },
  notificationBell: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  headerBrandRule: {
    position: 'absolute',
    left: spacing.md,
    bottom: -1,
    width: 42,
    height: 2,
  },
  headerCopy: { flex: 1 },
  brandRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  brandMarkViewport: {
    width: 58,
    height: 42,
    overflow: 'hidden',
    flexShrink: 0,
  },
  brandMark: {
    width: 58,
    height: 42,
  },
  brandMarkViewportProminent: {
    width: 88,
    height: 62,
    overflow: 'hidden',
    flexShrink: 0,
  },
  brandMarkProminent: { width: 88, height: 62 },
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
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    marginLeft: -spacing.xs,
  },
  backLabel: { fontSize: 16, fontWeight: '650' },
  nestedTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '750',
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  pageTitle: { ...type.display, fontSize: 29, lineHeight: 34 },
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
  actionPressed: { transform: [{ scale: 0.985 }] },
  actionText: { fontSize: 16, fontWeight: '750' },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 0,
  },
  sectionHeading: type.heading,
  detail: { fontSize: 14, marginTop: 3, lineHeight: 20 },
  state: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stateIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: { flex: 1 },
  stateTitle: { fontSize: 16, fontWeight: '700' },
  stateBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontWeight: '850' },
  metadata: type.metadata,
  skeleton: { gap: spacing.md, paddingVertical: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonCopy: { flex: 1, gap: spacing.xs },
  skeletonLine: { height: 12, width: '86%', borderRadius: radius.sm },
  skeletonLineShort: { height: 10, width: '52%', borderRadius: radius.sm },
  inlineState: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineAction: { alignSelf: 'flex-start', marginTop: spacing.md },
});
