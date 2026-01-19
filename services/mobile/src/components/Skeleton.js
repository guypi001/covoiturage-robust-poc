import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

export function SkeletonBlock({ style, width = '100%', height = 14, rounded = true }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.block, { width, height, opacity }, rounded && styles.rounded, style]}>
      <View />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.slate100,
  },
  rounded: {
    borderRadius: radius.sm,
  },
});
