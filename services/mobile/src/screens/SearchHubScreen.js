import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';

const todayIso = new Date().toISOString().slice(0, 10);

export function SearchHubScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Explorer</Text>
        <Text style={textStyles.subtitle}>Lance une recherche guidee ou utilise un parcours rapide.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Recherche" icon="search-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Recherche avancee" onPress={() => navigation.navigate('SearchForm')} />
          <PrimaryButton
            label="Trajets du jour (Abidjan -> Bouake)"
            variant="ghost"
            onPress={() =>
              navigation.navigate('Results', {
                from: 'Abidjan',
                to: 'Bouake',
                date: todayIso,
                seats: '1',
                sort: 'soonest',
              })
            }
          />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Raccourcis" icon="star-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Mes favoris" variant="secondary" onPress={() => navigation.navigate('Favorites')} />
          <PrimaryButton label="Aide recherche" variant="ghost" onPress={() => navigation.navigate('HelpCenter')} />
        </View>
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
