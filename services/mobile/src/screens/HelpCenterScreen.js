import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';

export function HelpCenterScreen({ navigation }) {
  const { token } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Centre d'aide</Text>
        <Text style={textStyles.subtitle}>Trouve rapidement le bon parcours pour ton besoin.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Parcours recommandes" icon="compass-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Trouver un trajet" onPress={() => navigation.navigate('Search')} />
          <PrimaryButton label="Gerer mes trajets" variant="ghost" onPress={() => navigation.navigate('Trips')} />
          <PrimaryButton label="Gerer mon compte" variant="ghost" onPress={() => navigation.navigate('Profile')} />
          <PrimaryButton
            label={token ? 'Messagerie' : 'Connexion'}
            variant="secondary"
            onPress={() => navigation.navigate(token ? 'MessagesTab' : 'Profile')}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Conseils" icon="information-circle-outline" />
        <Text style={styles.tip}>1. Verifie ton profil pour inspirer confiance.</Text>
        <Text style={styles.tip}>2. Active les notifications pour repondre vite.</Text>
        <Text style={styles.tip}>3. Utilise les favoris pour relancer tes recherches en un geste.</Text>
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
  tip: {
    fontSize: 13,
    color: colors.slate700,
  },
});
