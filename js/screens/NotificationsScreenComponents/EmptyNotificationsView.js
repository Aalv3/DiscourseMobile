/* @flow */
'use strict';

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { ThemeContext } from '../../ThemeContext';
import { productTheme, radius, spacing } from '../../product/DesignSystem';

class EmptyNotificationsView extends React.Component {
  render() {
    const theme = this.context;
    const colors = productTheme(theme.name);
    return (
      <View
        style={[
          styles.container,
          this.props.nativeMemberShell && styles.memberContainer,
          this.props.nativeMemberShell && {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            this.props.nativeMemberShell && styles.memberIcon,
            this.props.nativeMemberShell && {
              backgroundColor: colors.accentSoft,
            },
          ]}
        >
          <FontAwesome5
            name={'bell'}
            size={this.props.nativeMemberShell ? 24 : 48}
            color={this.props.nativeMemberShell ? colors.accent : theme.grayUI}
            iconStyle="solid"
          />
        </View>
        <Text
          style={{
            ...styles.title,
            color: this.props.nativeMemberShell ? colors.text : theme.grayTitle,
          }}
        >
          {this.props.text}
        </Text>
        {this.props.nativeMemberShell ? (
          <Text style={{ ...styles.detail, color: colors.muted }}>
            Replies, mentions, and useful Network activity will appear here.
          </Text>
        ) : null}
      </View>
    );
  }
}

EmptyNotificationsView.contextType = ThemeContext;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    flex: 5,
  },
  memberContainer: {
    flex: 0,
    minHeight: 208,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  memberIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    paddingTop: 14,
    textAlign: 'center',
  },
  detail: { fontSize: 13, lineHeight: 18, marginTop: 5, textAlign: 'center' },
});

export default EmptyNotificationsView;
