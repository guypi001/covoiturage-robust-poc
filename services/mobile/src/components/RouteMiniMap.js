import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

export function RouteMiniMap({ origin, destination, distanceLabel, durationLabel }) {
  const fromLabel = origin || 'Depart';
  const toLabel = destination || 'Arrivee';

  return (
    <View style={styles.canvas}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 7 }).map((_, index) => (
          <View key={`grid-${index}`} style={[styles.gridLine, { top: 12 + index * 22 }]} />
        ))}
      </View>

      <View style={styles.stationRow}>
        <View style={styles.stationGroup}>
          <View style={[styles.pinCircle, styles.pinCircleStart]}>
            <Ionicons name="navigate" size={12} color={colors.sky600} />
          </View>
          <Text style={styles.stationLabel} numberOfLines={1}>
            {fromLabel}
          </Text>
        </View>
        <View style={[styles.stationGroup, styles.stationGroupEnd]}>
          <Text style={styles.stationLabel} numberOfLines={1}>
            {toLabel}
          </Text>
          <View style={[styles.pinCircle, styles.pinCircleEnd]}>
            <Ionicons name="flag" size={12} color={colors.emerald600} />
          </View>
        </View>
      </View>

      <View style={styles.trackZone}>
        <View style={styles.trackHalo} />
        <View style={styles.trackBase} />
        <View style={styles.dotRow}>
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={`dot-${index}`} style={styles.dot} />
          ))}
        </View>
        <View style={styles.stopA} />
        <View style={styles.stopB} />
        <View style={styles.vehicle}>
          <Ionicons name="car-sport" size={13} color={colors.white} />
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="sparkles-outline" size={12} color={colors.sky600} />
          <Text style={styles.metaText}>Itineraire optimise</Text>
        </View>
        {distanceLabel ? (
          <View style={styles.metaChip}>
            <Ionicons name="resize-outline" size={12} color={colors.slate600} />
            <Text style={styles.metaText}>{distanceLabel}</Text>
          </View>
        ) : null}
        {durationLabel ? (
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={12} color={colors.slate600} />
            <Text style={styles.metaText}>{durationLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    height: 186,
    borderRadius: radius.lg,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -48,
    right: -34,
    backgroundColor: colors.sky100,
    opacity: 0.7,
  },
  glowBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -52,
    left: -26,
    backgroundColor: colors.emerald100,
    opacity: 0.6,
  },
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: -30,
    right: -30,
    height: 1,
    backgroundColor: colors.slate200,
    opacity: 0.33,
    transform: [{ rotate: '-5deg' }],
  },
  stationRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  stationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '48%',
  },
  stationGroupEnd: {
    justifyContent: 'flex-end',
  },
  stationLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  pinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.white,
  },
  pinCircleStart: {
    borderColor: colors.sky500,
  },
  pinCircleEnd: {
    borderColor: colors.emerald500,
  },
  trackZone: {
    marginTop: 16,
    marginHorizontal: 16,
    height: 56,
    justifyContent: 'center',
  },
  trackHalo: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    borderRadius: 10,
    backgroundColor: colors.sky100,
    opacity: 0.7,
  },
  trackBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.sky500,
    opacity: 0.36,
  },
  dotRow: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.emerald500,
    opacity: 0.82,
  },
  stopA: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sky500,
    borderWidth: 2,
    borderColor: colors.white,
  },
  stopB: {
    position: 'absolute',
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.emerald500,
    borderWidth: 2,
    borderColor: colors.white,
  },
  vehicle: {
    position: 'absolute',
    left: '48%',
    marginLeft: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate700,
    borderWidth: 1,
    borderColor: colors.white,
  },
  metaRow: {
    marginTop: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.white,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate700,
  },
});
