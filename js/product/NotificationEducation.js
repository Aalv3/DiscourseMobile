/* @flow */
'use strict';

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import {
  canAttemptNotificationSetup,
  notificationAttemptMessage,
  notificationSetupActionLabel,
  notificationStatusMessage,
  NOTIFICATION_STATUS,
} from '../notificationStatus';
import { spacing } from './DesignSystem';
import { useProductTheme } from './ProductComponents';

export default function NotificationEducation({
  status,
  attemptResult,
  onEnable,
}) {
  const colors = useProductTheme();
  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <FontAwesome5
          name="bell"
          size={18}
          color={colors.accent}
          iconStyle="solid"
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Notifications
        </Text>
        {canAttemptNotificationSetup(status) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              status === NOTIFICATION_STATUS.PERMISSION_DENIED
                ? 'Open notification settings'
                : notificationSetupActionLabel(status)
            }
            onPress={
              status === NOTIFICATION_STATUS.PERMISSION_DENIED
                ? () => Linking.openSettings()
                : onEnable
            }
            style={[styles.action, { borderColor: colors.accent }]}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {notificationSetupActionLabel(status)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.body, { color: colors.muted }]}>
        {notificationStatusMessage(status)}
      </Text>
      {attemptResult ? (
        <Text
          accessibilityRole={
            attemptResult.outcome === 'failed' ? 'alert' : 'status'
          }
          style={[
            styles.attempt,
            {
              color:
                attemptResult.outcome === 'failed'
                  ? colors.danger
                  : colors.text,
            },
          ]}
        >
          {notificationAttemptMessage(attemptResult)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '750' },
  body: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: '750' },
  attempt: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '650',
  },
});
