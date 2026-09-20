import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export function TextField({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, style]}
      placeholderTextColor={Colors.inkMuted}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    color: Colors.ink,
    ...Typography.body,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
});
