import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RideCard } from '../components/RideCard';
import { searchRides } from '../api/search';
import { saveSearch } from '../api/identity';
import { getMyBookings } from '../api/bff';
import { getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';
import { useAuth } from '../auth';
import { useSavedRides } from '../savedRides';

const normalizeRide = (ride) => ({
  id: ride.rideId || ride.id,
  origin: ride.originCity,
  destination: ride.destinationCity,
  departure: new Date(ride.departureAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', month: 'short' }),
  departureRaw: ride.departureAt,
  seats: `${ride.seatsAvailable}/${ride.seatsTotal}`,
  seatsRaw: ride.seatsAvailable,
  seatsAvailable: ride.seatsAvailable,
  price: `${Number(ride.pricePerSeat).toLocaleString('fr-FR')} XOF`,
  priceRaw: ride.pricePerSeat,
  driver: getFirstName(ride.driverLabel) || ride.driverLabel || 'Conducteur KariGo',
  driverPhotoUrl: ride.driverPhotoUrl || null,
  driverLabel: ride.driverLabel,
  liveTracking: Boolean(ride.liveTrackingEnabled),
});

export function ResultsScreen({ navigation, route }) {
  const params = route?.params || {};
  const { token } = useAuth();
  const { toggleSavedRide, isSaved } = useSavedRides();
  const [localSort, setLocalSort] = useState(params.sort || 'soonest');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [saveNotice, setSaveNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookedRideIds, setBookedRideIds] = useState(new Set());
  const [hideUnavailable, setHideUnavailable] = useState(false);

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
          sort: localSort,
          liveTracking: params.liveTracking,
          departureAfter: params.departureAfter,
          departureBefore: params.departureBefore,
          comfortLevel: params.comfortLevel,
          driverVerified: params.driverVerified,
        });
        if (active) {
          const hits = data?.hits || [];
          setRides(hits.map(normalizeRide));
          setMeta(data?.meta || null);
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
  }, [params, localSort]);

  useEffect(() => {
    if (params.sort && params.sort !== localSort) {
      setLocalSort(params.sort);
    }
  }, [params.sort]);

  useEffect(() => {
    let active = true;
    const fetchBookings = async () => {
      if (!token) {
        setBookedRideIds(new Set());
        return;
      }
      try {
        const payload = await getMyBookings(token);
        if (!active) return;
        const list = Array.isArray(payload?.data) ? payload.data : payload?.items || [];
        const ids = new Set(
          list.map((booking) => booking?.rideId || booking?.ride?.id).filter(Boolean),
        );
        setBookedRideIds(ids);
      } catch {
        if (active) setBookedRideIds(new Set());
      }
    };
    fetchBookings();
    return () => {
      active = false;
    };
  }, [token]);

  const stats = useMemo(() => {
    if (!rides.length) return null;
    const cheapest = rides.reduce((best, ride) => {
      const bestPrice = Number(String(best.price).replace(/[^\d]/g, '')) || 0;
      const nextPrice = Number(String(ride.price).replace(/[^\d]/g, '')) || 0;
      return nextPrice < bestPrice ? ride : best;
    }, rides[0]);
    return { cheapest };
  }, [rides]);

  const buildSavedRide = (ride) => ({
    rideId: ride.id,
    originCity: ride.origin,
    destinationCity: ride.destination,
    departureAt: ride.departureRaw || '',
    pricePerSeat: Number(ride.priceRaw || 0),
    seatsAvailable: Number(ride.seatsRaw || 0),
    driverLabel: ride.driverLabel || ride.driver || null,
  });

  const visibleRides = useMemo(() => {
    if (!hideUnavailable) return rides;
    return rides.filter(
      (ride) => !(Number(ride.seatsAvailable) <= 0 || bookedRideIds.has(ride.id)),
    );
  }, [rides, hideUnavailable, bookedRideIds]);

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
      {saveNotice ? <Banner tone="success" message={saveNotice} /> : null}
      {meta?.from?.suggestions?.length || meta?.to?.suggestions?.length ? (
        <Banner
          tone="info"
          message={`Suggestions: ${(meta.from?.suggestions || [])
            .concat(meta.to?.suggestions || [])
            .slice(0, 3)
            .join(', ')}`}
        />
      ) : null}

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
            <Text style={styles.filterText}>
              Tri: {localSort === 'cheapest' ? 'moins cher' : localSort === 'seats' ? 'places' : localSort === 'smart' ? 'intelligent' : 'plus tot'}
            </Text>
            <Text style={styles.filterMeta}>
              {params.liveTracking ? 'Suivi en direct active' : 'Suivi en direct desactive'}
              {params.driverVerified ? ' · Conducteur verifie' : ''}
              {params.comfortLevel ? ` · Confort ${params.comfortLevel}` : ''}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <PrimaryButton label="Modifier" variant="ghost" onPress={() => navigation.navigate('Search')} />
            {token ? (
              <PrimaryButton
                label={saving ? 'Sauvegarde...' : 'Sauvegarder'}
                variant="ghost"
                onPress={async () => {
                  if (!token) return;
                  setSaving(true);
                  setSaveNotice('');
                  try {
                    await saveSearch(token, {
                      originCity: params.from,
                      destinationCity: params.to,
                      date: params.date,
                      seats: params.seats ? Number(params.seats) : undefined,
                      priceMax: params.priceMax ? Number(String(params.priceMax).replace(/[^\d]/g, '')) : undefined,
                      departureAfter: params.departureAfter,
                      departureBefore: params.departureBefore,
                      liveTracking: params.liveTracking,
                      comfortLevel: params.comfortLevel,
                      driverVerified: params.driverVerified,
                    });
                    setSaveNotice('Recherche sauvegardee.');
                  } catch (err) {
                    setSaveNotice('Sauvegarde impossible.');
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            ) : null}
          </View>
        </View>
        <View style={styles.quickSortRow}>
          {[
            { id: 'soonest', label: 'Plus tot' },
            { id: 'cheapest', label: 'Moins cher' },
            { id: 'seats', label: 'Places' },
            { id: 'smart', label: 'Smart' },
          ].map((item) => {
            const active = localSort === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setLocalSort(item.id)}
                style={[styles.quickSortChip, active && styles.quickSortChipActive]}
              >
                <Text style={[styles.quickSortText, active && styles.quickSortTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setHideUnavailable((prev) => !prev)}
          style={[styles.quickSortChip, hideUnavailable && styles.quickSortChipActive]}
        >
          <Text style={[styles.quickSortText, hideUnavailable && styles.quickSortTextActive]}>
            Masquer complets / deja reserves
          </Text>
        </Pressable>
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
        {visibleRides.map((ride, index) => (
          <SurfaceCard key={ride.id} style={styles.rideCard} delay={180 + index * 40}>
            <RideCard
              ride={ride}
              saved={isSaved(ride.id)}
              onToggleSave={() => toggleSavedRide(buildSavedRide(ride))}
              isFull={Number(ride.seatsAvailable) <= 0}
              isBooked={bookedRideIds.has(ride.id)}
            />
            <View style={styles.cardActions}>
              <PrimaryButton
                label="Voir le trajet"
                onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })}
              />
            </View>
          </SurfaceCard>
        ))}
        {!loading && visibleRides.length === 0 && !error ? (
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
  quickSortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickSortChip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  quickSortChipActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  quickSortText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  quickSortTextActive: {
    color: colors.sky700,
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
