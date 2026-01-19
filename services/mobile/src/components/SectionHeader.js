import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, text } from '../theme';

export function SectionHeader({ title, subtitle, icon, meta }) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        {icon ? <Ionicons name={icon} size={16} color={colors.slate600} /> : null}
        <Text style={text.sectionTitle}>{title}</Text>
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    fontSize: 12,
    color: colors.slate500,
  },
  subtitle: {
    fontSize: 13,
    color: colors.slate600,
  },
});
