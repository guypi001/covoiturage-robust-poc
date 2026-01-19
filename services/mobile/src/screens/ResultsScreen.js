import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RideCard } from '../components/RideCard';
import { searchRides } from '../api/search';
import { getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';

const normalizeRide = (ride) => ({
  id: ride.rideId || ride.id,
  origin: ride.originCity,
  destination: ride.destinationCity,
  departure: new Date(ride.departureAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', month: 'short' }),
  seats: `${ride.seatsAvailable}/${ride.seatsTotal}`,
  price: `${Number(ride.pricePerSeat).toLocaleString('fr-FR')} XOF`,
  driver: getFirstName(ride.driverLabel) || ride.driverLabel || 'Conducteur KariGo',
  liveTracking: Boolean(ride.liveTrackingEnabled),
});

export function ResultsScreen({ navigation, route }) {
  const params = route?.params || {};
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!params.from || !params.to) return;
      setLoading(true);
      setError('');
      try {
        const data = await searchRides({
          from: params.from,
          to: params.to,
          date: params.date,
          seats: params.seats ? Number(params.seats) : undefined,
          priceMax: params.priceMax ? Number(String(params.priceMax).replace(/[^\d]/g, '')) : undefined,
          sort: params.sort,
          liveTracking: params.liveTracking,
          departureAfter: params.departureAfter,
          departureBefore: params.departureBefore,
        });
        if (active) {
          setRides(Array.isArray(data) ? data.map(normalizeRide) : []);
        }
      } catch (err) {
        if (active) setError('Impossible de charger les trajets.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [params]);

  const stats = useMemo(() => {
    if (!rides.length) return null;
    const cheapest = rides.reduce((best, ride) => {
      const bestPrice = Number(String(best.price).replace(/[^\d]/g, '')) || 0;
      const nextPrice = Number(String(ride.price).replace(/[^\d]/g, '')) || 0;
      return nextPrice < bestPrice ? ride : best;
    }, rides[0]);
    return { cheapest };
  }, [rides]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Resultats</Text>
        <Text style={text.subtitle}>Trajets disponibles pour {params.from || '?'} → {params.to || '?'}</Text>
      </View>

      {loading && (
        <SurfaceCard style={styles.loadingCard} tone="soft" delay={60}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement des trajets...</Text>
        </SurfaceCard>
      )}

      {error ? <Banner tone="error" message={error} /> : null}

      <View style={styles.summaryRow}>
        <SurfaceCard style={styles.summaryCard} tone="soft" delay={90}>
          <Text style={styles.summaryLabel}>Meilleur prix</Text>
          <Text style={styles.summaryValue}>{stats?.cheapest?.price || '--'}</Text>
          <Text style={styles.summaryMeta}>par siege</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.summaryCard} tone="soft" delay={120}>
          <Text style={styles.summaryLabel}>Depart rapide</Text>
          <Text style={styles.summaryValue}>{rides[0]?.departure?.split(' ')[0] || '--'}</Text>
          <Text style={styles.summaryMeta}>aujourd'hui</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.filterBar} tone="soft" delay={150}>
        <SectionHeader title="Filtres actifs" icon="filter-outline" />
        <View style={styles.filterRow}>
          <View>
            <Text style={styles.filterText}>Tri: plus tot</Text>
            <Text style={styles.filterMeta}>Suivi en direct active</Text>
          </View>
          <PrimaryButton label="Modifier" variant="ghost" onPress={() => navigation.navigate('Search')} />
        </View>
      </SurfaceCard>

      <View style={styles.list}>
        {loading ? (
          <View style={styles.skeletonList}>
            {Array.from({ length: 3 }).map((_, index) => (
              <SurfaceCard key={`sk-${index}`} style={styles.skeletonCard} tone="soft" animated={false}>
                <SkeletonBlock width="70%" height={14} />
                <SkeletonBlock width="45%" height={12} />
                <SkeletonBlock width="55%" height={12} />
                <View style={styles.skeletonActionRow}>
                  <SkeletonBlock width={110} height={36} rounded />
                </View>
              </SurfaceCard>
            ))}
          </View>
        ) : null}
        {rides.map((ride, index) => (
          <SurfaceCard key={ride.id} style={styles.rideCard} delay={180 + index * 40}>
            <RideCard ride={ride} />
            <View style={styles.cardActions}>
              <PrimaryButton
                label="Voir le trajet"
                onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })}
              />
            </View>
          </SurfaceCard>
        ))}
        {!loading && rides.length === 0 && !error ? (
          <SurfaceCard style={styles.emptyCard} tone="soft" delay={120}>
            <Text style={styles.emptyTitle}>Aucun trajet trouve</Text>
            <Text style={styles.emptyText}>Essaie d'ajuster les filtres ou de modifier l'horaire.</Text>
          </SurfaceCard>
        ) : null}
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
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
    marginTop: 6,
  },
  summaryMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  filterBar: {
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterText: {
    color: colors.slate700,
    fontSize: 13,
    fontWeight: '600',
  },
  filterMeta: {
    color: colors.slate500,
    fontSize: 12,
    marginTop: 4,
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
  list: {
    gap: spacing.md,
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonCard: {
    gap: spacing.sm,
  },
  skeletonActionRow: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  rideCard: {
    gap: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  emptyText: {
    fontSize: 13,
    color: colors.slate600,
    textAlign: 'center',
  },
});
