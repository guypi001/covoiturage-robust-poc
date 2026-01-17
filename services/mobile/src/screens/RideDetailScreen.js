import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { getRide } from '../api/ride';
import { createBooking } from '../api/bff';
import { useAuth } from '../auth';

export function RideDetailScreen({ route }) {
  const { token } = useAuth();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const rideId = route?.params?.rideId;

  useEffect(() => {
    let active = true;
    const fetchRide = async () => {
      if (!rideId) return;
      setLoading(true);
      setError('');
      try {
        const data = await getRide(rideId);
        if (active) setRide(data);
      } catch (err) {
        if (active) setError('Impossible de charger le trajet.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchRide();
    return () => {
      active = false;
    };
  }, [rideId]);

  const title = ride ? `${ride.originCity} → ${ride.destinationCity}` : 'Trajet';
  const departureLabel = ride?.departureAt
    ? new Date(ride.departureAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', month: 'short' })
    : '--';
  const priceLabel = ride?.pricePerSeat ? `${Number(ride.pricePerSeat).toLocaleString('fr-FR')} XOF` : '--';
  const seatsLabel = ride ? `${ride.seatsAvailable}/${ride.seatsTotal}` : '--';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={text.title}>{title}</Text>
        {ride?.liveTrackingEnabled ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>Suivi en direct</Text>
          </View>
        ) : null}
      </View>
      <Text style={text.subtitle}>Depart {departureLabel} · {seatsLabel} places</Text>

      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement du trajet...</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Carte du trajet</Text>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Prix</Text>
          <Text style={styles.statValue}>{priceLabel}</Text>
          <Text style={styles.statMeta}>par siege</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Places</Text>
          <Text style={styles.statValue}>{ride?.seatsAvailable ?? '--'}</Text>
          <Text style={styles.statMeta}>disponibles</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Conducteur</Text>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ride?.driverLabel?.charAt?.(0) || 'K'}</Text>
          </View>
          <View>
            <Text style={styles.driverName}>{ride?.driverLabel || 'Conducteur KariGo'}</Text>
            <Text style={styles.driverMeta}>Profil verifie · Support KariGo</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Suivi en direct</Text>
        <Text style={styles.infoValue}>
          {ride?.liveTrackingEnabled ? 'Actif 15 min avant le depart' : 'Non active par le chauffeur'}
        </Text>
        <Text style={styles.infoHint}>Disponible jusqu'a l'arrivee. Notification des grandes villes.</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Reserver"
          onPress={async () => {
            if (!token) {
              setBookingStatus('Connecte-toi pour reserver.');
              return;
            }
            if (!rideId) return;
            setBookingStatus('');
            try {
              await createBooking(token, { rideId, seats: 1 });
              setBookingStatus('Reservation enregistree.');
            } catch (err) {
              setBookingStatus('Impossible de reserver.');
            }
          }}
        />
        <PrimaryButton label="Contacter" variant="ghost" />
      </View>
      {bookingStatus ? <Text style={styles.bookingStatus}>{bookingStatus}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveBadge: {
    backgroundColor: colors.emerald100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald500,
    textTransform: 'uppercase',
  },
  mapPlaceholder: {
    backgroundColor: colors.sky100,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
  },
  mapText: {
    color: colors.slate600,
    fontWeight: '600',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate600,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  statLabel: {
    fontSize: 11,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
    marginTop: 6,
  },
  statMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.sky600,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  driverMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  infoValue: {
    color: colors.slate900,
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 12,
    color: colors.slate500,
  },
  actions: {
    gap: spacing.sm,
  },
  bookingStatus: {
    fontSize: 12,
    color: colors.slate600,
  },
});
