import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../theme';
import { getFirstName } from '../utils/name';
import { resolveAssetUrl } from '../config';
import { formatDepartureBadge, formatXof } from '../utils/format';

export function RideCard({ ride, saved, onToggleSave, isFull, isBooked }) {
  const driverLabel = getFirstName(ride.driver) || ride.driver;
  const showPhoto = Boolean(ride.driverPhotoUrl);
  const isBlocked = Boolean(isFull || isBooked);
  const departureBadge = formatDepartureBadge(ride.departureRaw);
  const departureLabel = typeof ride.departure === 'string' ? ride.departure : '';
  const departureHour = departureLabel.match(/\d{1,2}:\d{2}/)?.[0] || '--:--';
  const fallbackSeats = Number(String(ride.seats || '').split('/')[0]);
  const availableSeats = Number.isFinite(Number(ride.seatsRaw)) ? Number(ride.seatsRaw) : fallbackSeats;
  const totalSeats = Number(String(ride.seats || '').split('/')[1]);
  const occupancyRate =
    Number.isFinite(availableSeats) && Number.isFinite(totalSeats) && totalSeats > 0
      ? Math.max(0, Math.min(100, Math.round(((totalSeats - availableSeats) / totalSeats) * 100)))
      : null;
  const seatLabel =
    Number.isFinite(availableSeats) && availableSeats >= 0
      ? `${availableSeats} place${availableSeats > 1 ? 's' : ''} disponible${availableSeats > 1 ? 's' : ''}`
      : 'Disponibilite a confirmer';
  const statusLabel = isFull ? 'Complet' : isBooked ? 'Reserve' : 'Disponible';

  return (
    <View style={[styles.card, isBlocked && styles.cardMuted]}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.topRow}>
        <View style={styles.badgeSoft}>
          <Ionicons name="calendar-outline" size={13} color={colors.slate600} />
          <Text style={styles.badgeSoftText}>{departureBadge}</Text>
        </View>
        <View style={styles.topRightRow}>
          {ride.liveTracking ? (
            <View style={styles.badgeLive}>
              <Ionicons name="pulse-outline" size={12} color={colors.emerald600} />
              <Text style={styles.badgeLiveText}>Live</Text>
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
        </View>
      </View>

      <View style={styles.routeShell}>
        <View style={styles.timeline}>
          <View style={[styles.timelineDot, styles.timelineDotStart]} />
          <View style={styles.timelineTrack} />
          <View style={[styles.timelineDot, styles.timelineDotEnd]} />
        </View>

        <View style={styles.routeMain}>
          <View>
            <Text style={styles.stopLabel}>DEPART</Text>
            <Text style={styles.city}>{ride.origin || 'Depart'}</Text>
            <Text style={styles.meta}>{departureLabel || 'Horaire a confirmer'}</Text>
          </View>
          <View style={styles.routeDivider} />
          <View>
            <Text style={styles.stopLabel}>ARRIVEE</Text>
            <Text style={styles.city}>{ride.destination || 'Arrivee'}</Text>
            <Text style={styles.meta}>{seatLabel}</Text>
          </View>
        </View>

        <View style={styles.pricePanel}>
          <Text style={styles.priceCaption}>A partir de</Text>
          <Text style={styles.price}>{formatXof(ride.priceRaw)}</Text>
          <Text style={styles.priceSubcaption}>par place</Text>
          <View
            style={[
              styles.statusBadge,
              isFull ? styles.statusBadgeDanger : isBooked ? styles.statusBadgeInfo : styles.statusBadgeSuccess,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isFull
                  ? styles.statusBadgeTextDanger
                  : isBooked
                    ? styles.statusBadgeTextInfo
                    : styles.statusBadgeTextSuccess,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={14} color={colors.slate600} />
          <Text style={styles.infoText}>{departureHour}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="people-outline" size={14} color={colors.slate600} />
          <Text style={styles.infoText}>{ride.seats || '--'}</Text>
        </View>
        {occupancyRate != null ? (
          <View style={styles.infoItem}>
            <Ionicons name="analytics-outline" size={14} color={colors.slate600} />
            <Text style={styles.infoText}>Remplissage {occupancyRate}%</Text>
          </View>
        ) : null}
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
            <Text style={styles.driver}>Conducteur · {driverLabel}</Text>
          </View>
        </View>
        <View style={styles.pill}>
          <Ionicons name="checkmark-circle" size={13} color={colors.emerald600} />
          <Text style={styles.pillText}>Profil verifie</Text>
        </View>
      </View>

      {isFull ? (
        <View style={styles.badgeFull}>
          <Text style={styles.badgeFullText}>Trajet complet</Text>
        </View>
      ) : null}
      {isBooked ? (
        <View style={styles.badgeBooked}>
          <Text style={styles.badgeBookedText}>Reservation deja effectuee</Text>
        </View>
      ) : null}

      {isBlocked ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {isFull ? 'Trajet complet' : 'Trajet deja reserve'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    backgroundColor: colors.white,
    gap: 13,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardMuted: {
    opacity: 0.78,
  },
  glowTop: {
    position: 'absolute',
    right: -36,
    top: -36,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.sky50,
  },
  glowBottom: {
    position: 'absolute',
    left: -52,
    bottom: -68,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.emerald50,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.slate50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  badgeSoftText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate700,
    textTransform: 'uppercase',
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emerald100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.emerald400,
  },
  badgeLiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald600,
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
  routeShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  timeline: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: radius.full,
  },
  timelineDotStart: {
    backgroundColor: colors.sky500,
  },
  timelineDotEnd: {
    backgroundColor: colors.emerald500,
  },
  timelineTrack: {
    flex: 1,
    width: 2,
    borderRadius: radius.full,
    backgroundColor: colors.slate200,
    marginVertical: 4,
  },
  routeMain: {
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
  },
  stopLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: colors.slate500,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.slate200,
  },
  pricePanel: {
    minWidth: 104,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceCaption: {
    fontSize: 10,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  priceSubcaption: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: -2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.emerald100,
    borderColor: colors.emerald400,
  },
  statusBadgeDanger: {
    backgroundColor: colors.rose100,
    borderColor: colors.rose400,
  },
  statusBadgeInfo: {
    backgroundColor: colors.sky100,
    borderColor: colors.sky500,
  },
  statusBadgeText: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadgeTextSuccess: {
    color: colors.emerald600,
  },
  statusBadgeTextDanger: {
    color: colors.rose600,
  },
  statusBadgeTextInfo: {
    color: colors.sky700,
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
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.slate200,
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
    marginTop: 3,
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
    width: 38,
    height: 38,
    borderRadius: radius.full,
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
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.emerald400,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.emerald50,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald600,
    textTransform: 'uppercase',
  },
});
