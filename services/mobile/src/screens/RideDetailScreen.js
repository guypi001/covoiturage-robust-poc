import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { getRide } from '../api/ride';
import { createBooking } from '../api/bff';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';
import { useModal } from '../ui/ModalContext';
import { getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';

export function RideDetailScreen({ route }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { showModal } = useModal();
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
  const driverLabel = getFirstName(ride?.driverLabel) || ride?.driverLabel || 'Conducteur KariGo';

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
        <SurfaceCard style={styles.loadingCard} tone="soft" delay={60}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement du trajet...</Text>
        </SurfaceCard>
      )}

      {error ? <Banner tone="error" message={error} /> : null}

      {loading ? (
        <View style={styles.skeletonStack}>
          <SurfaceCard style={styles.mapPlaceholder} tone="accent" animated={false}>
            <SkeletonBlock width="55%" height={14} />
          </SurfaceCard>
          <View style={styles.cardRow}>
            <SurfaceCard style={styles.statCard} tone="soft" animated={false}>
              <SkeletonBlock width="40%" height={10} />
              <SkeletonBlock width="60%" height={18} />
              <SkeletonBlock width="30%" height={10} />
            </SurfaceCard>
            <SurfaceCard style={styles.statCard} tone="soft" animated={false}>
              <SkeletonBlock width="40%" height={10} />
              <SkeletonBlock width="60%" height={18} />
              <SkeletonBlock width="30%" height={10} />
            </SurfaceCard>
          </View>
          <SurfaceCard style={styles.card} animated={false}>
            <SkeletonBlock width="35%" height={12} />
            <SkeletonBlock width="60%" height={12} />
            <SkeletonBlock width="50%" height={12} />
          </SurfaceCard>
          <SurfaceCard style={styles.card} animated={false}>
            <SkeletonBlock width="45%" height={12} />
            <SkeletonBlock width="70%" height={12} />
          </SurfaceCard>
        </View>
      ) : (
        <>
          <SurfaceCard style={styles.mapPlaceholder} tone="accent" delay={90}>
            <Text style={styles.mapText}>Carte du trajet</Text>
          </SurfaceCard>

          <View style={styles.cardRow}>
            <SurfaceCard style={styles.statCard} tone="soft" delay={120}>
              <Text style={styles.statLabel}>Prix</Text>
              <Text style={styles.statValue}>{priceLabel}</Text>
              <Text style={styles.statMeta}>par siege</Text>
            </SurfaceCard>
            <SurfaceCard style={styles.statCard} tone="soft" delay={150}>
              <Text style={styles.statLabel}>Places</Text>
              <Text style={styles.statValue}>{ride?.seatsAvailable ?? '--'}</Text>
              <Text style={styles.statMeta}>disponibles</Text>
            </SurfaceCard>
          </View>

          <SurfaceCard style={styles.card} delay={180}>
            <SectionHeader title="Conducteur" icon="person-outline" />
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{driverLabel.charAt(0) || 'K'}</Text>
              </View>
              <View>
                <Text style={styles.driverName}>{driverLabel}</Text>
                <Text style={styles.driverMeta}>Profil verifie · Support KariGo</Text>
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.card} delay={210}>
            <SectionHeader title="Suivi en direct" icon="radio-outline" />
            <Text style={styles.infoValue}>
              {ride?.liveTrackingEnabled ? 'Actif 15 min avant le depart' : 'Non active par le chauffeur'}
            </Text>
            <Text style={styles.infoHint}>Disponible jusqu'a l'arrivee. Notification des grandes villes.</Text>
          </SurfaceCard>
        </>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          label="Reserver"
          onPress={async () => {
            if (!token) {
              showToast('Connecte-toi pour reserver.', 'error');
              return;
            }
            if (!rideId) return;
            showModal({
              title: 'Confirmer la reservation',
              message: 'Tu confirmes la reservation pour ce trajet ?',
              confirmLabel: 'Reserver',
              onConfirm: async () => {
                try {
                  await createBooking(token, { rideId, seats: 1 });
                  setBookingStatus('Reservation enregistree.');
                  showToast('Reservation enregistree.', 'success');
                } catch (err) {
                  setBookingStatus('');
                  showToast('Impossible de reserver.', 'error');
                }
              },
            });
          }}
        />
        <PrimaryButton label="Contacter" variant="ghost" />
      </View>
      {bookingStatus ? <Banner tone="success" message={bookingStatus} /> : null}
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
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate600,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
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
    gap: spacing.sm,
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
  skeletonStack: {
    gap: spacing.md,
  },
});
