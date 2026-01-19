import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { BrandMark } from '../components/BrandMark';
import { loadPreferences, savePreferences } from '../preferences';
import { useAuth } from '../auth';
import { getMyBookings, getMyRides } from '../api/bff';
import { useToast } from '../ui/ToastContext';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';

export function HomeScreen({ navigation }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripItems, setTripItems] = useState([]);
  const [tripError, setTripError] = useState('');

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const stored = await loadPreferences();
      if (!active) return;
      setPrefs(stored);
    };
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!prefs) return;
    savePreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    let active = true;
    const loadTrips = async () => {
      if (!token) {
        setTripItems([]);
        return;
      }
      setLoadingTrips(true);
      setTripError('');
      try {
        const [bookingRes, rideRes] = await Promise.all([getMyBookings(token), getMyRides(token)]);
        if (!active) return;
        const bookings = Array.isArray(bookingRes?.data) ? bookingRes.data : bookingRes?.items || [];
        const rides = Array.isArray(rideRes?.data) ? rideRes.data : rideRes?.items || [];
        const combined = [
          ...bookings.map((booking) => ({
            kind: 'booking',
            id: booking.id,
            item: booking,
            ride: booking.ride || booking,
          })),
          ...rides.map((ride) => ({
            kind: 'ride',
            id: ride.id,
            item: ride,
            ride,
          })),
        ];
        setTripItems(combined);
      } catch (err) {
        if (active) {
          setTripError('Impossible de charger tes trajets.');
          showToast('Impossible de charger tes trajets.', 'error');
        }
      } finally {
        if (active) setLoadingTrips(false);
      }
    };
    loadTrips();
    return () => {
      active = false;
    };
  }, [token, showToast]);

  const classifyTrip = (departureAt) => {
    if (!departureAt) return 'upcoming';
    const ts = Date.parse(departureAt);
    if (!Number.isFinite(ts)) return 'upcoming';
    const now = Date.now();
    if (ts > now + 5 * 60 * 1000) return 'upcoming';
    if (now - ts <= 3 * 60 * 60 * 1000) return 'upcoming';
    return 'past';
  };

  const formatDate = (value) => {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const upcomingTrips = useMemo(() => {
    return tripItems
      .filter((trip) => classifyTrip(trip.ride?.departureAt || trip.item?.departureAt) === 'upcoming')
      .sort((a, b) => {
        const aTime = Date.parse(a.ride?.departureAt || '') || 0;
        const bTime = Date.parse(b.ride?.departureAt || '') || 0;
        return aTime - bTime;
      })
      .slice(0, 4);
  }, [tripItems]);

  const pastTrips = useMemo(() => {
    return tripItems
      .filter((trip) => classifyTrip(trip.ride?.departureAt || trip.item?.departureAt) === 'past')
      .sort((a, b) => {
        const aTime = Date.parse(a.ride?.departureAt || '') || 0;
        const bTime = Date.parse(b.ride?.departureAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [tripItems]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size="lg" />
        <Text style={text.title}>Voyage sereinement avec KariGo</Text>
        <Text style={text.subtitle}>
          Trouve un trajet fiable, avec suivi en direct, en quelques secondes.
        </Text>
      </View>

      <SurfaceCard style={styles.card} delay={60}>
        <SectionHeader title="Actions rapides" icon="flash-outline" />
        <View style={styles.quickRow}>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('Search')}>
            <Text style={styles.actionTitle}>Rechercher un trajet</Text>
            <Text style={styles.actionMeta}>Accede aux filtres avances</Text>
          </Pressable>
          <Pressable style={styles.actionTileAlt} onPress={() => navigation.navigate('Trips')}>
            <Text style={styles.actionTitle}>Mes trajets</Text>
            <Text style={styles.actionMeta}>Gere tes reservations</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      {token ? (
        <SurfaceCard style={styles.card} delay={120}>
          <SectionHeader title="Mes trajets a venir" icon="calendar-outline" />
          {loadingTrips ? <Text style={styles.helperText}>Chargement...</Text> : null}
          {tripError ? <Banner tone="error" message={tripError} /> : null}
          {!loadingTrips && upcomingTrips.length === 0 && !tripError ? (
            <Text style={styles.helperText}>Aucun trajet a venir pour le moment.</Text>
          ) : null}
          {loadingTrips ? (
            <View style={styles.skeletonList}>
              {Array.from({ length: 2 }).map((_, index) => (
                <View key={`sk-up-${index}`} style={styles.tripCard}>
                  <SkeletonBlock width="70%" height={14} />
                  <SkeletonBlock width="40%" height={12} />
                  <SkeletonBlock width="50%" height={12} />
                </View>
              ))}
            </View>
          ) : null}
          {upcomingTrips.map((trip) => {
            const ride = trip.ride || {};
            return (
              <Pressable
                key={`${trip.kind}-${trip.id}`}
                style={styles.tripCard}
                onPress={() => navigation.navigate('TripDetail', { type: trip.kind, item: trip.item })}
              >
                <Text style={styles.tripRoute}>
                  {ride.originCity || ride.origin || 'Depart'} → {ride.destinationCity || ride.destination || 'Arrivee'}
                </Text>
                <Text style={styles.tripMeta}>{formatDate(ride.departureAt || trip.item?.departureAt)}</Text>
                <Text style={styles.tripMeta}>
                  {trip.kind === 'booking' ? 'Passager' : 'Conducteur'} · {ride.seatsAvailable != null ? `${ride.seatsAvailable} places` : ''}
                </Text>
              </Pressable>
            );
          })}
        </SurfaceCard>
      ) : (
        <SurfaceCard style={styles.card} delay={120}>
          <SectionHeader title="Mes trajets" icon="car-outline" />
          <Text style={styles.helperText}>Connecte-toi pour retrouver tes trajets a venir et passes.</Text>
          <PrimaryButton label="Se connecter" onPress={() => navigation.navigate('Profile')} />
        </SurfaceCard>
      )}

      {token ? (
        <SurfaceCard style={styles.card} delay={180}>
          <SectionHeader title="Mes trajets passes" icon="time-outline" />
          {loadingTrips ? <Text style={styles.helperText}>Chargement...</Text> : null}
          {!loadingTrips && pastTrips.length === 0 && !tripError ? (
            <Text style={styles.helperText}>Aucun trajet termine pour le moment.</Text>
          ) : null}
          {loadingTrips ? (
            <View style={styles.skeletonList}>
              {Array.from({ length: 2 }).map((_, index) => (
                <View key={`sk-past-${index}`} style={styles.tripCard}>
                  <SkeletonBlock width="70%" height={14} />
                  <SkeletonBlock width="40%" height={12} />
                  <SkeletonBlock width="50%" height={12} />
                </View>
              ))}
            </View>
          ) : null}
          {pastTrips.map((trip) => {
            const ride = trip.ride || {};
            return (
              <Pressable
                key={`${trip.kind}-${trip.id}`}
                style={styles.tripCard}
                onPress={() => navigation.navigate('TripDetail', { type: trip.kind, item: trip.item })}
              >
                <Text style={styles.tripRoute}>
                  {ride.originCity || ride.origin || 'Depart'} → {ride.destinationCity || ride.destination || 'Arrivee'}
                </Text>
                <Text style={styles.tripMeta}>{formatDate(ride.departureAt || trip.item?.departureAt)}</Text>
                <Text style={styles.tripMeta}>
                  {trip.kind === 'booking' ? 'Passager' : 'Conducteur'} · {ride.pricePerSeat ? `${ride.pricePerSeat} FCFA` : ''}
                </Text>
              </Pressable>
            );
          })}
        </SurfaceCard>
      ) : null}

      <View style={styles.highlights}>
        <SurfaceCard style={styles.highlightCard} tone="soft" delay={240}>
          <Text style={styles.highlightTitle}>Suivi en direct</Text>
          <Text style={styles.highlightText}>Disponible 15 min avant le depart pour les trajets actives.</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.highlightCard} tone="soft" delay={300}>
          <Text style={styles.highlightTitle}>Communautaire & Pro</Text>
          <Text style={styles.highlightText}>Filtre rapidement les trajets avec suivi active.</Text>
        </SurfaceCard>
      </View>
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
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionTile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.md,
    backgroundColor: colors.slate50,
  },
  actionTileAlt: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sky100,
    padding: spacing.md,
    backgroundColor: colors.brandSoft,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  actionMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.slate500,
  },
  tripCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
    gap: 6,
  },
  tripRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate900,
  },
  tripMeta: {
    fontSize: 12,
    color: colors.slate600,
  },
  helperText: {
    fontSize: 13,
    color: colors.slate600,
  },
  skeletonList: {
    gap: spacing.sm,
  },
  highlights: {
    gap: spacing.md,
  },
  highlightCard: {
    gap: spacing.sm,
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate900,
  },
  highlightText: {
    fontSize: 13,
    color: colors.slate600,
  },
});
