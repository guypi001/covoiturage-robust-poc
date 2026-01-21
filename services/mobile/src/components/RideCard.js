import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, text } from '../theme';
import { getFirstName } from '../utils/name';
import { resolveAssetUrl } from '../config';

export function RideCard({ ride }) {
  const driverLabel = getFirstName(ride.driver) || ride.driver;
  const showPhoto = Boolean(ride.driverPhotoUrl);

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badgeSoft}>
          <Text style={styles.badgeSoftText}>Depart proche</Text>
        </View>
        {ride.liveTracking ? (
          <View style={styles.badgeLive}>
            <Text style={styles.badgeLiveText}>Suivi en direct</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.city}>{ride.origin}</Text>
          <Text style={styles.meta}>{ride.departure}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View>
          <Text style={styles.city}>{ride.destination}</Text>
          <Text style={styles.meta}>{ride.seats} sièges</Text>
        </View>
      </View>
      <View style={styles.footerRow}>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            {showPhoto ? (
              <Image source={{ uri: resolveAssetUrl(ride.driverPhotoUrl) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{driverLabel?.charAt(0) || 'K'}</Text>
            )}
          </View>
          <View>
            <Text style={styles.price}>{ride.price}</Text>
            <Text style={styles.driver}>Chauffeur: {driverLabel}</Text>
          </View>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Profil verifie</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
    gap: 12,
    ...shadows.card,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeSoft: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  badgeSoftText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate700,
    textTransform: 'uppercase',
  },
  badgeLive: {
    backgroundColor: colors.emerald100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  badgeLiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald500,
    textTransform: 'uppercase',
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  city: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
  },
  meta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  arrow: {
    fontSize: 20,
    color: colors.brandPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate600,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  driver: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate600,
    textTransform: 'uppercase',
  },
});
