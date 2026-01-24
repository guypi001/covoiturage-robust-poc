import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export function RouteMiniMap({ origin, destination }) {
  const fromLabel = origin || 'Depart';
  const toLabel = destination || 'Arrivee';

  return (
    <View style={styles.canvas}>
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View
            key={`grid-${index}`}
            style={[styles.gridLine, { top: 12 + index * 22 }]}
          />
        ))}
      </View>
      <View style={styles.routeLine} />
      <View style={styles.routeStart}>
        <View style={styles.pinCircle}>
          <Ionicons name="location" size={14} color={colors.sky600} />
        </View>
        <Text style={styles.pinLabel} numberOfLines={1}>
          {fromLabel}
        </Text>
      </View>
      <View style={styles.routeEnd}>
        <View style={styles.pinCircle}>
          <Ionicons name="flag" size={12} color={colors.emerald500} />
        </View>
        <Text style={styles.pinLabel} numberOfLines={1}>
          {toLabel}
        </Text>
      </View>
      <View style={styles.routeDotMid} />
      <View style={styles.routeDotMidAlt} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  grid: {
    position: 'absolute',
    inset: 0,
  },
  gridLine: {
    position: 'absolute',
    left: -40,
    right: -40,
    height: 1,
    backgroundColor: colors.slate200,
    opacity: 0.4,
    transform: [{ rotate: '-6deg' }],
  },
  routeLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '50%',
    height: 2,
    backgroundColor: colors.slate300,
  },
  routeStart: {
    position: 'absolute',
    left: 18,
    top: 22,
    width: 140,
    gap: 6,
  },
  routeEnd: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 140,
    alignItems: 'flex-end',
    gap: 6,
  },
  pinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  routeDotMid: {
    position: 'absolute',
    left: '42%',
    top: '46%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sky500,
  },
  routeDotMidAlt: {
    position: 'absolute',
    left: '58%',
    top: '52%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald500,
  },
});
