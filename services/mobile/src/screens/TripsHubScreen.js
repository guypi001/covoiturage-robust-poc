import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';

export function TripsHubScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Trajets</Text>
        <Text style={textStyles.subtitle}>Accede rapidement a tes reservations, publications et favoris.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Mon espace trajets" icon="car-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Historique complet" onPress={() => navigation.navigate('TripsList')} />
          <PrimaryButton label="Mes favoris" variant="ghost" onPress={() => navigation.navigate('Favorites')} />
          <PrimaryButton label="Trouver un nouveau trajet" variant="secondary" onPress={() => navigation.navigate('Search')} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Support" icon="help-circle-outline" />
        <PrimaryButton label="Aide sur les trajets" variant="ghost" onPress={() => navigation.navigate('HelpCenter')} />
      </SurfaceCard>
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
  card: {
    gap: spacing.sm,
  },
  column: {
    gap: spacing.sm,
  },
});
