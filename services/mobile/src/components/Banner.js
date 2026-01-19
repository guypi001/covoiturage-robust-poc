import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Banner({ tone = 'info', message }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.base, styles[`tone_${tone}`], { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  tone_info: {
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
  },
  tone_success: {
    borderColor: colors.emerald500,
    backgroundColor: colors.emerald100,
  },
  tone_error: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate900,
  },
});
