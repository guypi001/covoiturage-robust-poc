import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';

export function HomeHubScreen({ navigation }) {
  const { token } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Accueil</Text>
        <Text style={textStyles.subtitle}>Navigue rapidement vers les fonctions essentielles.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Commencer" icon="flash-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Vue generale" onPress={() => navigation.navigate('HomeFeed')} />
          <PrimaryButton label="Rechercher un trajet" variant="ghost" onPress={() => navigation.navigate('Search')} />
          <PrimaryButton
            label={token ? 'Mes trajets' : 'Se connecter'}
            variant="ghost"
            onPress={() => navigation.navigate(token ? 'Trips' : 'Profile')}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Besoin d'aide" icon="help-circle-outline" />
        <PrimaryButton label="Centre d'aide" variant="secondary" onPress={() => navigation.navigate('HelpCenter')} />
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
