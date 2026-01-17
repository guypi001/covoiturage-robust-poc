import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';

export function RideDetailScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={text.title}>Abidjan → Yamoussoukro</Text>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>Suivi en direct</Text>
        </View>
      </View>
      <Text style={text.subtitle}>Depart aujourd'hui a 08:30 · 2 places disponibles</Text>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Carte du trajet</Text>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Prix</Text>
          <Text style={styles.statValue}>2 000 XOF</Text>
          <Text style={styles.statMeta}>par siege</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Places</Text>
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statMeta}>disponibles</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Conducteur</Text>
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <View>
            <Text style={styles.driverName}>Kouadio</Text>
            <Text style={styles.driverMeta}>Profil verifie · 4.8/5</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Suivi en direct</Text>
        <Text style={styles.infoValue}>Actif 15 min avant le depart</Text>
        <Text style={styles.infoHint}>Disponible jusqu'a l'arrivee. Notification des grandes villes.</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Reserver" />
        <PrimaryButton label="Contacter" variant="ghost" />
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
});
