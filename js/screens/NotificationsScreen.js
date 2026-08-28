/* @flow */
'use strict';

import React from 'react';
import Immutable from 'immutable';
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImmutableVirtualizedList } from 'react-native-immutable-list-view';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import Components from './NotificationsScreenComponents';
import Common from './CommonComponents';
import DiscourseUtils from '../DiscourseUtils';
import { ThemeContext } from '../ThemeContext';
import i18n from 'i18n-js';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productTheme, radius, spacing } from '../product/DesignSystem';
import { classifyNotificationLoadError } from '../notificationLoadState';

class NotificationsScreen extends React.Component {
  static replyTypes = [1, 2, 3, 6, 9, 11, 15, 16, 17];

  constructor(props) {
    super(props);

    this.state = {
      progress: 0,
      renderPlaceholderOnly: true,
      selectedIndex: 0,
      connectedSites: 0,
      dataSource: Immutable.List(),
      loadError: null,
    };

    this._siteManager = this.props.screenProps.siteManager;

    if (this.props.screenProps.seenNotificationMap) {
      this._seenNotificationMap = this.props.screenProps.seenNotificationMap;
      this.refresh();
    } else {
      this._siteManager
        .getSeenNotificationMap()
        .then(map => {
          this._seenNotificationMap = map;
          this.props.screenProps.setSeenNotificationMap(map);
          this.refresh();
        })
        .catch(() => {
          this._seenNotificationMap = {};
          this.refresh();
        });
    }
  }

  componentDidMount() {
    this.setState({ connectedSites: this._siteManager.connectedSitesCount() });
    this._mounted = true;

    if (this._refreshed) {
      this.removePlaceholder();
    }
  }

  setTimeout(callback, timeout) {
    if (this._mounted) {
      setTimeout(() => {
        if (this._mounted) {
          callback();
        }
      }, timeout);
    }
  }

  removePlaceholder() {
    InteractionManager.runAfterInteractions(() => {
      this.setTimeout(() => {
        this.setState({ renderPlaceholderOnly: false });
      }, 0);
    });
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  render() {
    const theme = this.context;
    const colors = productTheme(theme.name);
    const memberShell = this.props.nativeMemberShell === true;

    if (this.state.renderPlaceholderOnly) {
      return (
        <SafeAreaView
          edges={memberShell ? ['left', 'right', 'bottom'] : undefined}
          style={{
            flex: 1,
            backgroundColor: memberShell ? colors.canvas : theme.background,
          }}
        >
          {!memberShell ? (
            <Components.NavigationBar onDidPressRightButton={() => {}} />
          ) : null}
          <View
            style={memberShell ? undefined : styles.legacyHeaderPlaceholder}
          >
            {this._renderListHeader()}
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView
        edges={memberShell ? ['left', 'right', 'bottom'] : undefined}
        style={{
          flex: 1,
          backgroundColor: memberShell ? colors.canvas : theme.background,
        }}
      >
        {!memberShell ? (
          <Components.NavigationBar progress={this.state.progress} />
        ) : null}

        {this._renderListHeader()}

        {this.state.loadError ? this._renderLoadError() : null}
        {this.state.dataSource.size > 0
          ? this._renderList()
          : this.state.loadError
          ? null
          : this._renderEmptyNotifications()}
      </SafeAreaView>
    );
  }

  _renderLoadError() {
    const colors = productTheme(this.context.name);
    const unauthorized = this.state.loadError === 'unauthorized';
    const rateLimited = this.state.loadError === 'rate_limited';
    return (
      <View
        accessibilityRole="alert"
        style={[
          styles.loadError,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <FontAwesome5
          name={unauthorized ? 'lock' : rateLimited ? 'clock' : 'wifi'}
          size={22}
          color={colors.accent}
          iconStyle="solid"
        />
        <Text style={[styles.loadErrorTitle, { color: colors.text }]}>
          {unauthorized
            ? 'Sign in again to view notifications'
            : rateLimited
            ? 'Notifications are cooling down'
            : 'Notifications could not refresh'}
        </Text>
        <Text style={[styles.loadErrorDetail, { color: colors.muted }]}>
          {unauthorized
            ? 'Your saved session is no longer available on this device.'
            : rateLimited
            ? 'The Network is limiting requests briefly. Your connection and account remain available.'
            : this.state.loadError === 'backend'
            ? 'The Network is temporarily unavailable. Your account remains secure.'
            : 'Check your connection and try again.'}
        </Text>
        {!unauthorized ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry notifications"
            onPress={() => this.refresh()}
            style={({ pressed }) => [
              styles.retryButton,
              { borderColor: colors.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.retryLabel, { color: colors.accent }]}>
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  _renderEmptyNotifications() {
    let text;
    switch (this.state.selectedIndex) {
      case 0:
        text = i18n.t('no_new_notifications');
        break;
      case 1:
        text = i18n.t('no_replies');
        break;
      case 2:
        text = i18n.t('no_notifications');
        break;
      default:
        text = '';
    }

    if (this.state.connectedSites === 0) {
      text = i18n.t('no_connected_sites');
    }

    return (
      <Components.EmptyNotificationsView
        nativeMemberShell={this.props.nativeMemberShell === true}
        text={text}
      />
    );
  }

  _renderList() {
    return (
      <BottomTabBarHeightContext.Consumer>
        {tabBarHeight => (
          <ImmutableVirtualizedList
            contentContainerStyle={
              this.props.nativeMemberShell
                ? {
                    paddingBottom: tabBarHeight + spacing.lg,
                    paddingHorizontal: spacing.md,
                  }
                : { paddingBottom: tabBarHeight }
            }
            enableEmptySections={true}
            immutableData={this.state.dataSource}
            renderItem={rowData => this._renderListRow(rowData)}
            keyExtractor={rowData => this._listIndex(rowData)}
            ListEmptyComponent={''}
          />
        )}
      </BottomTabBarHeightContext.Consumer>
    );
  }

  _openNotificationForSite(notification, site) {
    this._siteManager.markNotificationRead(site, notification).catch(() => {});

    let url = DiscourseUtils.endpointForSiteNotification(site, notification);
    this._siteManager.setActiveSite(site);
    this.props.screenProps.openUrl(url);
  }

  _listIndex(row) {
    let rowData = row.toJS();
    return rowData.notification.id.toString();
  }

  _renderListRow(row) {
    let rowData = row.item.toJS();

    return (
      <Components.Row
        nativeMemberShell={this.props.nativeMemberShell === true}
        site={rowData.site}
        onClick={() =>
          this._openNotificationForSite(rowData.notification, rowData.site)
        }
        notification={rowData.notification}
      />
    );
  }

  refresh() {
    let types =
      this.state.selectedIndex === 1
        ? NotificationsScreen.replyTypes
        : undefined;
    return this._fetchNotifications(types, {
      onlyNew: this.state.selectedIndex === 0,
      newMap: this._seenNotificationMap,
      silent: false,
      surfaceErrors: true,
    });
  }

  _renderListHeader() {
    if (this.props.nativeMemberShell) {
      const theme = this.context;
      const colors = productTheme(theme.name);
      const tabs = [i18n.t('new'), i18n.t('replies'), i18n.t('all')];

      return (
        <View
          accessibilityRole="tablist"
          style={[
            styles.memberTabs,
            {
              backgroundColor: colors.surfaceRaised,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {tabs.map((label, index) => {
            const selected = this.state.selectedIndex === index;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={label}
                onPress={() => {
                  this.setState({ selectedIndex: index }, () => {
                    this.refresh();
                  });
                }}
                style={({ pressed }) => [
                  styles.memberTab,
                  pressed && styles.memberTabPressed,
                ]}
              >
                <Text
                  style={[
                    styles.memberTabLabel,
                    { color: selected ? colors.brandAccent : colors.muted },
                  ]}
                >
                  {label}
                </Text>
                <View
                  style={[
                    styles.memberTabIndicator,
                    {
                      backgroundColor: selected
                        ? colors.brandAccent
                        : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      );
    }

    return (
      <Common.Filter
        nativeMemberShell={this.props.nativeMemberShell === true}
        selectedIndex={this.state.selectedIndex}
        tabs={[i18n.t('new'), i18n.t('replies'), i18n.t('all')]}
        onChange={index => {
          this.setState({ selectedIndex: index }, () => {
            this.refresh();
          });
        }}
      />
    );
  }

  _fetchNotifications(notificationTypes, options) {
    if (this._fetching) {
      return this._fetching;
    }
    if (this._mounted) this.setState({ loadError: null });

    if (this._mounted) {
      setTimeout(() => {
        if (this._mounted && this._fetching) {
          this.setState({
            progress: Math.random() * 0.4,
          });
        }
      }, 100);
    }

    const request = this._siteManager
      .notifications(notificationTypes, options)
      .then(notifications => {
        this._notification = notifications;
        this._refreshed = true;

        if (this._mounted) {
          if (this.state.progress !== 0) {
            this.setState({
              progress: 1,
            });

            this.removePlaceholder();

            setTimeout(() => {
              if (this._mounted) {
                this.setState({ progress: 0 });
              }
            }, 400);
          }

          this.setState({
            dataSource: Immutable.fromJS(notifications),
            loadError: null,
          });

          this.removePlaceholder();
        }
      })
      .catch(error => {
        this._refreshed = true;
        if (this._mounted) {
          this.setState({
            loadError: classifyNotificationLoadError(error),
            progress: 0,
          });
          this.removePlaceholder();
        }
      })
      .finally(() => {
        if (this._fetching === request) this._fetching = null;
      });
    this._fetching = request;
    return request;
  }
}

NotificationsScreen.contextType = ThemeContext;

export default NotificationsScreen;

const styles = StyleSheet.create({
  legacyHeaderPlaceholder: { height: 50, marginTop: 0, paddingTop: 0 },
  memberTabs: {
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberTab: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
  },
  memberTabPressed: { opacity: 0.62 },
  memberTabLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '750',
    paddingBottom: spacing.sm,
  },
  memberTabIndicator: {
    width: '58%',
    height: 3,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  loadError: {
    margin: spacing.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  loadErrorTitle: {
    marginTop: spacing.sm,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '750',
    textAlign: 'center',
  },
  loadErrorDetail: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  retryLabel: { fontSize: 14, fontWeight: '750' },
});
