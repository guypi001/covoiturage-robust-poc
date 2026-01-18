import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { useAuth } from '../auth';
import { getMyBookings, getMyRides } from '../api/bff';
import { useToast } from '../ui/ToastContext';

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

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const [bookingRes, rideRes] = await Promise.all([getMyBookings(token), getMyRides(token)]);
        if (!active) return;
        setBookings(Array.isArray(bookingRes?.data) ? bookingRes.data : bookingRes?.items || []);
        setRides(Array.isArray(rideRes?.data) ? rideRes.data : rideRes?.items || []);
      } catch (err) {
        if (active) showToast('Impossible de charger les trajets.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [token, showToast]);

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
        <Text style={styles.sectionTitle}>En tant que passager</Text>
        {loading ? <Text style={styles.helper}>Chargement...</Text> : null}
        {!loading && filteredBookings.length === 0 ? (
          <Text style={styles.helper}>Aucune reservation pour cette periode.</Text>
        ) : null}
        {filteredBookings.map((booking) => {
          const ride = booking?.ride || {};
          return (
            <Pressable
              key={booking.id || ride.id}
              style={styles.card}
              onPress={() => navigation.navigate('TripDetail', { type: 'booking', item: booking })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {ride.originCity || 'Depart'} → {ride.destinationCity || 'Arrivee'}
                </Text>
                <Text style={styles.badge}>{booking.status || 'Reservation'}</Text>
              </View>
              <Text style={styles.cardMeta}>{formatDate(ride.departureAt || booking.departureAt)}</Text>
              <Text style={styles.cardMeta}>{ride.pricePerSeat ? `${ride.pricePerSeat} FCFA` : ''}</Text>
              <Text style={styles.cardMeta}>
                {formatTripLabel(classifyTrip(ride.departureAt || booking.departureAt))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>En tant que conducteur</Text>
        {loading ? <Text style={styles.helper}>Chargement...</Text> : null}
        {!loading && filteredRides.length === 0 ? (
          <Text style={styles.helper}>Aucun trajet publie pour cette periode.</Text>
        ) : null}
        {filteredRides.map((ride) => (
          <Pressable
            key={ride.id}
            style={styles.card}
            onPress={() => navigation.navigate('TripDetail', { type: 'ride', item: ride })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {ride.originCity || 'Depart'} → {ride.destinationCity || 'Arrivee'}
              </Text>
              <Text style={styles.badge}>{ride.status || 'Publie'}</Text>
            </View>
            <Text style={styles.cardMeta}>{formatDate(ride.departureAt)}</Text>
            <Text style={styles.cardMeta}>
              {ride.seatsAvailable != null ? `${ride.seatsAvailable} places dispo` : ''}
            </Text>
            <Text style={styles.cardMeta}>{formatTripLabel(classifyTrip(ride.departureAt))}</Text>
          </Pressable>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  helper: {
    fontSize: 12,
    color: colors.slate500,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
    gap: 6,
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
