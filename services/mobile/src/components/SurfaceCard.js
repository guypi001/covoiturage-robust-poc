import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors, radius, shadows } from '../theme';

export function SurfaceCard({ children, style, tone = 'default', animated = true, delay = 0 }) {
  const opacity = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animated ? 12 : 0)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }, [animated, delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.base,
        tone === 'soft' && styles.soft,
        tone === 'accent' && styles.accent,
        animated && { opacity, transform: [{ translateY }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.card,
  },
  soft: {
    backgroundColor: colors.slate50,
    ...shadows.soft,
  },
  accent: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.sky100,
  },
});
