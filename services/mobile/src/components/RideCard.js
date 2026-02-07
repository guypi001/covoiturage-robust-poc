import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, text } from '../theme';
import { getFirstName } from '../utils/name';
import { resolveAssetUrl } from '../config';
import { formatDepartureBadge, formatXof } from '../utils/format';

export function RideCard({ ride, saved, onToggleSave, isFull, isBooked }) {
  const driverLabel = getFirstName(ride.driver) || ride.driver;
  const showPhoto = Boolean(ride.driverPhotoUrl);
  const isBlocked = Boolean(isFull || isBooked);
  const departureBadge = formatDepartureBadge(ride.departureRaw);

  return (
    <View style={[styles.card, isBlocked && styles.cardMuted]}>
      <View style={styles.badgeRow}>
        <View style={styles.badgeSoft}>
          <Text style={styles.badgeSoftText}>{departureBadge}</Text>
        </View>
        {isFull ? (
          <View style={styles.badgeFull}>
            <Text style={styles.badgeFullText}>Complet</Text>
          </View>
        ) : null}
        {isBooked ? (
          <View style={styles.badgeBooked}>
            <Text style={styles.badgeBookedText}>Déjà réservé</Text>
          </View>
        ) : null}
        {onToggleSave ? (
          <Pressable
            onPress={onToggleSave}
            style={styles.saveButton}
            hitSlop={8}
            accessibilityLabel={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? colors.rose500 : colors.slate500}
            />
          </Pressable>
        ) : null}
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
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={14} color={colors.slate500} />
          <Text style={styles.infoText}>{ride.departure?.split(' ')[0] || '—'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color={colors.slate500} />
          <Text style={styles.infoText}>{formatXof(ride.priceRaw)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={colors.slate500} />
          <Text style={styles.infoText}>{ride.seats}</Text>
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
            <Text style={styles.price}>{formatXof(ride.priceRaw)}</Text>
            <Text style={styles.driver}>Conducteur: {driverLabel}</Text>
          </View>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Profil verifie</Text>
        </View>
      </View>
      {isBlocked ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {isFull ? 'Trajet complet' : 'Déjà réservé'}
          </Text>
        </View>
      ) : null}
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
  cardMuted: {
    opacity: 0.6,
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
  badgeFull: {
    backgroundColor: colors.rose100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  badgeFullText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose600,
    textTransform: 'uppercase',
  },
  badgeBooked: {
    backgroundColor: colors.sky100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  badgeBookedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.sky600,
    textTransform: 'uppercase',
  },
  overlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate600,
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
