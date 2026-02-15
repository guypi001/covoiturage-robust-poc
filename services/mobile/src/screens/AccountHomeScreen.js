import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, text as textStyles } from '../theme';
import { useAuth } from '../auth';
import { getDisplayName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';

export function AccountHomeScreen({ navigation }) {
  const { token, account, guest } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Compte</Text>
        <Text style={textStyles.subtitle}>Centre de pilotage du profil, sécurité et préférences.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Profil" icon="person-circle-outline" />
        <View style={styles.identityRow}>
          <Ionicons name="person-outline" size={18} color={colors.slate600} />
          <Text style={styles.identityText}>{getDisplayName(account) || (guest ? 'Mode invite' : 'Compte')}</Text>
        </View>
        <View style={styles.identityRow}>
          <Ionicons name="mail-outline" size={18} color={colors.slate600} />
          <Text style={styles.identityText}>{account?.email || 'Aucun email'}</Text>
        </View>
        <View style={styles.buttonColumn}>
          <PrimaryButton label={token ? 'Modifier mon profil' : 'Connexion / inscription'} onPress={() => navigation.navigate('ProfileDetails')} />
          <PrimaryButton label="Photo de profil" variant="ghost" onPress={() => navigation.navigate('ProfilePhoto')} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Parametres et preferences" icon="settings-outline" />
        <View style={styles.buttonColumn}>
          <PrimaryButton label="Centre preferences" onPress={() => navigation.navigate('PreferencesHome')} />
          <PrimaryButton label="Parametres de l'application" variant="ghost" onPress={() => navigation.navigate('AppSettings')} />
          <PrimaryButton label="Notifications" variant="ghost" onPress={() => navigation.navigate('NotificationSettings')} />
          <PrimaryButton label="Centre d'aide" variant="secondary" onPress={() => navigation.navigate('HelpCenter')} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Raccourcis utiles" icon="apps-outline" />
        <View style={styles.buttonColumn}>
          {token ? (
            <>
              <PrimaryButton label="Mes favoris" variant="ghost" onPress={() => navigation.navigate('Favorites')} />
              <PrimaryButton label="Mes trajets" variant="ghost" onPress={() => navigation.navigate('Trips')} />
              <PrimaryButton label="Messagerie" variant="ghost" onPress={() => navigation.navigate('MessagesTab')} />
            </>
          ) : (
            <>
              <PrimaryButton label="Trouver un trajet" variant="ghost" onPress={() => navigation.navigate('Search')} />
              <PrimaryButton label="Connexion / inscription" variant="ghost" onPress={() => navigation.navigate('ProfileDetails')} />
            </>
          )}
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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityText: {
    fontSize: 14,
    color: colors.slate700,
    flex: 1,
  },
  buttonColumn: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
