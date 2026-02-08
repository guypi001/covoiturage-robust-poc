import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, text } from '../theme';
import { useSavedRides } from '../savedRides';
import { SurfaceCard } from '../components/SurfaceCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { RideCard } from '../components/RideCard';

const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function FavoritesScreen({ navigation }) {
  const { savedRides, toggleSavedRide } = useSavedRides();
  const items = useMemo(() => {
    const list = Object.values(savedRides || {});
    return list.sort((a, b) => {
      const aTs = Date.parse(a.departureAt || '');
      const bTs = Date.parse(b.departureAt || '');
      if (!Number.isFinite(aTs) || !Number.isFinite(bTs)) return 0;
      return aTs - bTs;
    });
  }, [savedRides]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Favoris</Text>
        <Text style={text.subtitle}>Retrouve tes trajets aimés et accède rapidement aux détails.</Text>
      </View>

      {items.length === 0 ? (
        <SurfaceCard style={styles.emptyCard} tone="soft" delay={60}>
          <Ionicons name="heart-outline" size={28} color={colors.slate500} />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptyText}>
            Ajoute un trajet aux favoris depuis les résultats ou la page détail.
          </Text>
        </SurfaceCard>
      ) : null}

      {items.map((ride, index) => (
        <SurfaceCard key={ride.rideId} style={styles.card} delay={90 + index * 35}>
          <RideCard
            ride={{
              id: ride.rideId,
              origin: ride.originCity || 'Depart',
              destination: ride.destinationCity || 'Arrivee',
              departure: formatDate(ride.departureAt),
              departureRaw: ride.departureAt,
              seats: ride.seatsAvailable != null ? `${ride.seatsAvailable}/?` : '--',
              seatsRaw: ride.seatsAvailable,
              priceRaw: ride.pricePerSeat,
              driver: ride.driverLabel || 'Conducteur KariGo',
              driverPhotoUrl: ride.driverPhotoUrl || null,
              liveTracking: false,
            }}
            saved
            onToggleSave={() => toggleSavedRide(ride)}
            isFull={Number(ride.seatsAvailable) <= 0}
            isBooked={false}
          />
          <PrimaryButton
            label="Voir le trajet"
            variant="outline"
            onPress={() => navigation.navigate('RideDetail', { rideId: ride.rideId })}
          />
        </SurfaceCard>
      ))}
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
    fontSize: 12,
    color: colors.slate600,
    textAlign: 'center',
  },
  card: {
    gap: spacing.sm,
  },
});
