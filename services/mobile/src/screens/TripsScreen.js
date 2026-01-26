import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { useAuth } from '../auth';
import { getMyBookings, getMyRides } from '../api/bff';
import { useToast } from '../ui/ToastContext';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { formatBookingStatus, formatPaymentStatus, formatRideStatus } from '../utils/status';

const TABS = [
  { id: 'upcoming', label: 'A venir' },
  { id: 'current', label: 'En cours' },
  { id: 'past', label: 'Passes' },
];

const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const classifyTrip = (departureAt) => {
  if (!departureAt) return 'upcoming';
  const ts = Date.parse(departureAt);
  if (!Number.isFinite(ts)) return 'upcoming';
  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return 'upcoming';
  if (now - ts <= 3 * 60 * 60 * 1000) return 'current';
  return 'past';
};

const formatTripLabel = (status) => {
  if (status === 'current') return 'En cours';
  if (status === 'past') return 'Passe';
  return 'A venir';
};

export function TripsScreen({ navigation }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [error, setError] = useState('');

  const loadTrips = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [bookingRes, rideRes] = await Promise.all([getMyBookings(token), getMyRides(token)]);
      setBookings(Array.isArray(bookingRes?.data) ? bookingRes.data : bookingRes?.items || []);
      setRides(Array.isArray(rideRes?.data) ? rideRes.data : rideRes?.items || []);
    } catch (err) {
      setError('Impossible de charger les trajets.');
      showToast('Impossible de charger les trajets.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips]),
  );

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const ride = booking?.ride;
      const departureAt = ride?.departureAt || booking?.departureAt || booking?.createdAt;
      return classifyTrip(departureAt) === tab;
    });
  }, [bookings, tab, nowTick]);

  const filteredRides = useMemo(() => {
    return rides.filter((ride) => classifyTrip(ride?.departureAt) === tab);
  }, [rides, tab, nowTick]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Mes trajets</Text>
        <Text style={text.subtitle}>Retrouve tes trajets a venir, en cours ou passes.</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="En tant que passager" icon="person-outline" />
        {error ? (
          <Pressable style={styles.retryPill} onPress={loadTrips}>
            <Text style={styles.retryText}>Recharger</Text>
          </Pressable>
        ) : null}
        {loading ? (
          <View style={styles.skeletonList}>
            {Array.from({ length: 2 }).map((_, index) => (
              <SurfaceCard key={`sk-pass-${index}`} style={styles.card} tone="soft" animated={false}>
                <SkeletonBlock width="70%" height={14} />
                <SkeletonBlock width="50%" height={12} />
                <SkeletonBlock width="40%" height={12} />
              </SurfaceCard>
            ))}
          </View>
        ) : null}
        {!loading && filteredBookings.length === 0 ? (
          <Text style={styles.helper}>Aucune reservation pour cette periode.</Text>
        ) : null}
        {filteredBookings.map((booking, index) => {
          const ride = booking?.ride || {};
          return (
            <SurfaceCard key={booking.id || ride.id} style={styles.card} delay={100 + index * 40}>
              <Pressable
                onPress={() => navigation.navigate('TripDetail', { type: 'booking', item: booking })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {ride.originCity || 'Depart'} → {ride.destinationCity || 'Arrivee'}
                  </Text>
                <Text style={styles.badge}>{formatBookingStatus(booking.status)}</Text>
                </View>
                <Text style={styles.cardMeta}>{formatDate(ride.departureAt || booking.departureAt)}</Text>
                <Text style={styles.cardMeta}>{ride.pricePerSeat ? `${ride.pricePerSeat} FCFA` : ''}</Text>
                <Text style={styles.cardMeta}>
                  {formatTripLabel(classifyTrip(ride.departureAt || booking.departureAt))}
                </Text>
                {booking.paymentStatus ? (
                  <Text style={styles.cardMeta}>{formatPaymentStatus(booking.paymentStatus)}</Text>
                ) : null}
              </Pressable>
            </SurfaceCard>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="En tant que conducteur" icon="car-outline" />
        {error ? (
          <Pressable style={styles.retryPill} onPress={loadTrips}>
            <Text style={styles.retryText}>Recharger</Text>
          </Pressable>
        ) : null}
        {loading ? (
          <View style={styles.skeletonList}>
            {Array.from({ length: 2 }).map((_, index) => (
              <SurfaceCard key={`sk-drive-${index}`} style={styles.card} tone="soft" animated={false}>
                <SkeletonBlock width="70%" height={14} />
                <SkeletonBlock width="50%" height={12} />
                <SkeletonBlock width="40%" height={12} />
              </SurfaceCard>
            ))}
          </View>
        ) : null}
        {!loading && filteredRides.length === 0 ? (
          <Text style={styles.helper}>Aucun trajet publie pour cette periode.</Text>
        ) : null}
        {filteredRides.map((ride, index) => (
          <SurfaceCard key={ride.id} style={styles.card} delay={180 + index * 40}>
            <Pressable onPress={() => navigation.navigate('TripDetail', { type: 'ride', item: ride })}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {ride.originCity || 'Depart'} → {ride.destinationCity || 'Arrivee'}
                </Text>
              <Text style={styles.badge}>{formatRideStatus(ride.status)}</Text>
              </View>
              <Text style={styles.cardMeta}>{formatDate(ride.departureAt)}</Text>
              <Text style={styles.cardMeta}>
                {ride.seatsAvailable != null ? `${ride.seatsAvailable} places dispo` : ''}
              </Text>
              <Text style={styles.cardMeta}>{formatTripLabel(classifyTrip(ride.departureAt))}</Text>
            </Pressable>
          </SurfaceCard>
        ))}
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
    gap: spacing.md,
  },
  header: {
    gap: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  tabButtonActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: colors.sky700,
  },
  section: {
    gap: spacing.sm,
  },
  helper: {
    fontSize: 12,
    color: colors.slate500,
  },
  retryPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  card: {
    gap: 6,
  },
  skeletonList: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.slate900,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sky700,
    backgroundColor: colors.sky100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    textTransform: 'uppercase',
  },
  cardMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
});
