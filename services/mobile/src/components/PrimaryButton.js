import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, shadows } from '../theme';

export function PrimaryButton({ label, onPress, variant = 'primary', disabled, loading }) {
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isPrimary = !isGhost && !isSecondary && !isOutline;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        isSecondary && styles.buttonSecondary,
        isOutline && styles.buttonOutline,
        isGhost && styles.buttonGhost,
        pressed && !disabled && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.slate700} />
      ) : (
        <Text
          style={[
            styles.text,
            (isGhost || isOutline || isSecondary) && styles.textDark,
            isOutline && styles.textOutline,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: colors.brandPrimary,
    ...shadows.soft,
  },
  buttonSecondary: {
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  buttonOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  buttonPressed: {
    transform: [{ translateY: 1 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: fonts.display,
  },
  textDark: {
    color: colors.slate700,
  },
  textOutline: {
    color: colors.brandPrimary,
  },
});
