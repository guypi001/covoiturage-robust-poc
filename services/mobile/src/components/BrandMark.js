import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function BrandMark({ size = 'md' }) {
  const isLg = size === 'lg';
  return (
    <View style={[styles.row, isLg && styles.rowLg]}>
      <View style={[styles.dot, isLg && styles.dotLg]} />
      <Text style={[styles.wordmark, isLg && styles.wordmarkLg]}>
        <Text style={styles.wordmarkStrong}>Kari</Text>
        <Text style={styles.wordmarkAccent}>Go</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLg: {
    gap: spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandAccent,
  },
  dotLg: {
    width: 16,
    height: 16,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brandDark,
  },
  wordmarkLg: {
    fontSize: 22,
  },
  wordmarkStrong: {
    color: colors.brandDark,
  },
  wordmarkAccent: {
    color: colors.brandPrimary,
  },
});
