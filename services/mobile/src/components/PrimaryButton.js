import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

export function PrimaryButton({ label, onPress, variant = 'primary', disabled }) {
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonPrimary,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.text, isGhost && styles.textGhost]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.slate900,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  textGhost: {
    color: colors.slate700,
  },
});
