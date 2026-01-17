import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RideCard } from '../components/RideCard';
import { sampleRides } from '../data/rides';

export function ResultsScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Resultats</Text>
        <Text style={text.subtitle}>Trajets disponibles pour aujourd'hui.</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Meilleur prix</Text>
          <Text style={styles.summaryValue}>2 000 XOF</Text>
          <Text style={styles.summaryMeta}>par siege</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Depart rapide</Text>
          <Text style={styles.summaryValue}>08:30</Text>
          <Text style={styles.summaryMeta}>aujourd'hui</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View>
          <Text style={styles.filterText}>Tri: plus tot</Text>
          <Text style={styles.filterMeta}>Suivi en direct active</Text>
        </View>
        <PrimaryButton label="Modifier" variant="ghost" onPress={() => navigation.navigate('Search')} />
      </View>

      <View style={styles.list}>
        {sampleRides.map((ride) => (
          <View key={ride.id} style={styles.cardWrapper}>
            <RideCard ride={ride} />
            <View style={styles.cardActions}>
              <PrimaryButton label="Voir le trajet" onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })} />
            </View>
          </View>
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
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
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
  list: {
    gap: spacing.md,
  },
  cardWrapper: {
    gap: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
