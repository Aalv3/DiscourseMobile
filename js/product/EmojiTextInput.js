/* @flow */
'use strict';

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { useProductTheme } from './ProductComponents';
import { spacing } from './DesignSystem';

const QUICK_EMOJI = [
  '👍',
  '👎',
  '👏',
  '🙌',
  '🎉',
  '😊',
  '😂',
  '🤣',
  '❤️',
  '🔥',
  '💯',
  '🤝',
  '💪',
  '🙏',
  '👀',
  '🤔',
  '😮',
  '😢',
  '😡',
  '✅',
  '⚠️',
  '🚨',
  '⛈️',
  '🌪️',
  '🌊',
  '🏠',
  '🚗',
  '🧰',
  '📋',
  '📍',
  '☕',
  '🏆',
];

export default function EmojiTextInput({
  value,
  onChangeText,
  editable = true,
  style,
  containerStyle,
  ...inputProps
}) {
  const colors = useProductTheme();
  const [emojiVisible, setEmojiVisible] = useState(false);

  return (
    <View style={containerStyle}>
      <View style={styles.row}>
        <TextInput
          {...inputProps}
          editable={editable}
          onChangeText={onChangeText}
          style={[styles.input, style]}
          value={value}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            emojiVisible ? 'Close emoji choices' : 'Add emoji'
          }
          disabled={!editable}
          onPress={() => setEmojiVisible(current => !current)}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.canvas,
              borderColor: colors.border,
              opacity: !editable ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <FontAwesome5
            name="smile"
            size={18}
            color={colors.accent}
            iconStyle="solid"
          />
        </Pressable>
      </View>
      {emojiVisible ? (
        <ScrollView
          accessibilityLabel="Emoji choices"
          contentContainerStyle={styles.trayContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={[styles.tray, { backgroundColor: colors.surface }]}
        >
          {QUICK_EMOJI.map(emoji => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji} emoji`}
              onPress={() => {
                onChangeText(`${value || ''}${emoji}`);
                setEmojiVisible(false);
              }}
              style={styles.choice}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1 },
  button: {
    width: 42,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tray: {
    maxHeight: 50,
  },
  trayContent: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  choice: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24, lineHeight: 30 },
});
