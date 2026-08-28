/* @flow */
'use strict';

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import DiscourseUtils from '../../DiscourseUtils';
import { ThemeContext } from '../../ThemeContext';
import i18n from 'i18n-js';
import { productTheme, radius, spacing } from '../../product/DesignSystem';

const notificationAge = createdAt => {
  if (!createdAt) {
    return null;
  }
  const elapsed = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return null;
  }
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) {
    return 'Now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(createdAt).toLocaleDateString();
};

class NotificationRow extends React.Component {
  render() {
    const theme = this.context;

    if (this.props.nativeMemberShell) {
      return this._renderMemberRow(theme);
    }

    const contentView = {
      borderBottomColor: theme.grayBorder,
      borderBottomWidth: StyleSheet.hairlineWidth,
      marginHorizontal: this.props.nativeMemberShell ? 16 : 0,
      borderRadius: 0,
      marginBottom: 0,
      overflow: 'hidden',
    };

    return (
      <TouchableHighlight
        style={[contentView, this._backgroundColor()]}
        underlayColor={theme.yellowUIFeedback}
        onPress={() => this.props.onClick()}
      >
        <View
          style={[
            styles.container,
            this.props.nativeMemberShell && styles.memberContainer,
          ]}
        >
          {this._iconForNotification(this.props.notification)}
          {this._textForNotification(this.props.notification)}
          <Image
            style={styles.siteIcon}
            source={{ uri: this.props.site.icon }}
          />
        </View>
      </TouchableHighlight>
    );
  }

  _renderMemberRow(theme) {
    const colors = productTheme(theme.name);
    const notification = this.props.notification;
    const unread = !notification.read;
    const age = notificationAge(notification.created_at);
    const iconName = DiscourseUtils.iconNameForNotification(notification);

    return (
      <TouchableHighlight
        accessibilityRole="button"
        accessibilityLabel={`Open notification${unread ? ', unread' : ''}`}
        onPress={() => this.props.onClick()}
        style={[
          styles.memberRow,
          {
            backgroundColor: unread
              ? colors.brandAccentSoft
              : colors.surfaceRaised,
            borderBottomColor: colors.border,
          },
        ]}
        underlayColor={colors.accentSoft}
      >
        <View style={styles.memberRowContent}>
          <View
            style={[
              styles.memberIcon,
              {
                backgroundColor: unread
                  ? colors.surfaceRaised
                  : colors.surfaceAlt,
              },
            ]}
          >
            <FontAwesome5
              name={iconName}
              size={17}
              color={unread ? colors.brandAccent : colors.accent}
              iconStyle="solid"
            />
          </View>
          <View style={styles.memberCopy}>
            {this._textForNotification(notification)}
          </View>
          <View style={styles.memberMeta}>
            {age ? (
              <Text style={[styles.memberAge, { color: colors.muted }]}>
                {age}
              </Text>
            ) : null}
            {unread ? (
              <View
                accessibilityLabel="Unread"
                style={[
                  styles.unreadDot,
                  { backgroundColor: colors.brandAccent },
                ]}
              />
            ) : (
              <FontAwesome5
                name="chevron-right"
                size={12}
                color={colors.muted}
                iconStyle="solid"
              />
            )}
          </View>
        </View>
      </TouchableHighlight>
    );
  }

  _iconForNotification(notification) {
    let name = DiscourseUtils.iconNameForNotification(notification);

    return (
      <FontAwesome5
        style={styles.notificationIcon}
        name={name}
        size={14}
        color="#919191"
        iconStyle="solid"
      />
    );
  }

  _textForNotification(notification) {
    const theme = this.context;
    const productColors = productTheme(theme.name);
    let innerText;

    let data = this.props.notification.data;
    let displayName = data.display_username;

    if (notification.notification_type === 5) {
      // special logic for multi like
      if (data.count === 2) {
        displayName = i18n.t('liked_two_users', {
          user1: displayName,
          user2: data.username2,
        });
      } else if (data.count > 2) {
        displayName = i18n.t('liked_more', {
          user1: displayName,
          user2: data.username2,
          count: data.count - 2,
        });
      }
    }

    const textStyle = {
      color: this.props.nativeMemberShell
        ? productColors.text
        : theme.grayTitle,
      fontWeight: this.props.nativeMemberShell ? '650' : '400',
      lineHeight: this.props.nativeMemberShell ? 20 : undefined,
    };
    const topicStyle = {
      color: this.props.nativeMemberShell
        ? productColors.accent
        : theme.blueUnread,
      fontWeight: this.props.nativeMemberShell ? '700' : '400',
    };

    switch (notification.notification_type) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 13:
      case 14:
      case 15:
      case 17:
      case 18:
      case 25:
      case 36:
      case 801:
      case 802:
        innerText = (
          <Text style={textStyle}>
            {displayName}
            <Text style={topicStyle}>
              {' '}
              {this.props.notification.data.topic_title}
            </Text>
          </Text>
        );
        break;
      case 12:
        innerText = (
          <Text style={textStyle}>
            {' '}
            {this.props.notification.data.badge_name}
          </Text>
        );
        break;
      case 16:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('inbox_message', {
              count: data.inbox_count,
              group_name: data.group_name,
            })}
          </Text>
        );
        break;
      case 19:
        innerText = (
          <Text style={textStyle}>
            {displayName}
            <Text style={textStyle}>
              {' '}
              {i18n.t('liked', { count: data.count })}
            </Text>
          </Text>
        );
        break;
      case 20:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('approved', { title: notification.fancy_title })}
          </Text>
        );
        break;
      case 21:
        if (notification.fancy_title !== undefined) {
          innerText = (
            <Text style={textStyle}>
              {i18n.t('approved', { title: notification.fancy_title })}
            </Text>
          );
        } else {
          innerText = (
            <Text style={textStyle}>
              {i18n.t('approved_commits', {
                count: notification.data.num_approved_commits,
              })}
            </Text>
          );
        }
        break;
      case 22:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('membership_accepted', {
              name: notification.data.group_name,
            })}
          </Text>
        );
        break;
      case 23:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('membership_request_consolidated', {
              name: notification.data.group_name,
            })}
          </Text>
        );
        break;

      case 24: // bookmark reminder
      case 28: // event invitation
        innerText = (
          <Text style={textStyle}>
            {displayName}
            <Text style={topicStyle}>
              {' '}
              {notification.data.topic_title || notification.fancy_title}
            </Text>
          </Text>
        );
        break;
      case 26:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('votes_released', {
              description: notification.data.message,
            })}
          </Text>
        );
        break;
      case 27:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('event_reminder', {
              title: notification.data.topic_title,
            })}
          </Text>
        );
        break;
      case 29:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('chat_mention', {
              name: notification.data.mentioned_by_username,
            })}
          </Text>
        );
        break;
      case 30:
        innerText = <Text style={textStyle}>{i18n.t('chat_message')}</Text>;
        break;
      case 31:
        innerText = <Text style={textStyle}>{i18n.t('chat_invitation')}</Text>;
        break;
      case 32:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('chat_group_mention', {
              username: notification.data.mentioned_by_username,
              group_name: notification.data.group_name,
            })}
          </Text>
        );
        break;
      case 37:
        innerText = <Text style={textStyle}>{i18n.t('new_features')}</Text>;
        break;
      case 38:
        innerText = (
          <Text style={textStyle}>Site administration needs attention</Text>
        );
        break;
      case 34:
        innerText = (
          <Text style={textStyle}>
            {notification.data.display_username}
            <Text style={topicStyle}>
              {' '}
              {notification.data.topic_title || notification.fancy_title}
            </Text>
          </Text>
        );
        break;
      case 800:
        innerText = (
          <Text style={textStyle}>
            {i18n.t('user_following', {
              name: notification.data.display_username,
            })}
          </Text>
        );
        break;

      default:
        return null;
    }

    return (
      <Text
        numberOfLines={this.props.nativeMemberShell ? 3 : undefined}
        style={[
          styles.textContainer,
          this.props.nativeMemberShell && styles.memberText,
        ]}
      >
        {innerText}
      </Text>
    );
  }

  _backgroundColor() {
    const theme = this.context;
    let read = this.props.notification.read;
    if (read) {
      return { backgroundColor: theme.background };
    } else {
      return { backgroundColor: theme.grayBackground };
    }
  }
}

NotificationRow.contextType = ThemeContext;

const styles = StyleSheet.create({
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    alignSelf: 'center',
    fontSize: 15,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    margin: 12,
  },
  memberContainer: { minHeight: 70, margin: 0, padding: 14 },
  memberRow: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberRowContent: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  memberIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCopy: { flex: 1, justifyContent: 'center' },
  memberText: { fontSize: 14, lineHeight: 20 },
  memberMeta: {
    minWidth: 34,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  memberAge: { fontSize: 11, lineHeight: 15, fontWeight: '650' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  siteIcon: {
    width: 32,
    height: 32,
    alignSelf: 'center',
    marginLeft: 12,
    borderRadius: 12,
  },
  notificationIcon: {
    alignSelf: 'center',
    marginRight: 12,
    marginLeft: 6,
  },
});

export default NotificationRow;
