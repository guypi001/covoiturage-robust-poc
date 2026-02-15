import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';

export function PreferencesHomeScreen({ navigation }) {
  const { token } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Préférences</Text>
        <Text style={textStyles.subtitle}>Réglages de l’app regroupés par usage, sans redondance.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Experience app" icon="settings-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Parametres de l'application" onPress={() => navigation.navigate('AppSettings')} />
          <PrimaryButton
            label="Notifications"
            variant="ghost"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Assistance" icon="help-circle-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Centre d'aide" variant="secondary" onPress={() => navigation.navigate('HelpCenter')} />
          <PrimaryButton
            label={token ? 'Gérer mon compte' : 'Connexion / inscription'}
            variant="ghost"
            onPress={() => navigation.navigate('AccountHome')}
          />
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
