import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';
import { registerPushToken, sendTestNotification } from '../api/notifications';

const formatStatus = (value) => {
  if (value === 'granted') return 'Activees';
  if (value === 'denied') return 'Refusees';
  if (value === 'undetermined') return 'En attente';
  return 'Inconnu';
};

export function NotificationSettingsScreen({ navigation }) {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Inconnu');
  const [statusHint, setStatusHint] = useState('Verifie les autorisations pour recevoir les alertes.');
  const ownerId = useMemo(() => account?.id || 'demo-user', [account?.id]);
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const refreshPermission = async () => {
    try {
      const settings = await Notifications.getPermissionsAsync();
      setStatus(formatStatus(settings.status));
      if (settings.status === 'granted') {
        setStatusHint('Tu recevras les updates de reservations et messages.');
      } else if (settings.status === 'denied') {
        setStatusHint("Active les notifications dans les reglages systeme.");
      } else {
        setStatusHint('Autorise les notifications pour les alertes importantes.');
      }
    } catch {
      setStatus('Inconnu');
      setStatusHint('Impossible de lire le statut local.');
    }
  };

  useEffect(() => {
    refreshPermission();
  }, []);

  const handleEnable = async () => {
    if (!token || !account?.id) {
      showToast('Connecte-toi pour activer les notifications.', 'error');
      return;
    }
    try {
      if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
        setStatus('Indisponible');
        setStatusHint('Expo Go Android ne supporte pas les push complets.');
        return;
      }
      setBusy(true);
      const current = await Notifications.getPermissionsAsync();
      let permission = current.status;
      if (permission !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        permission = requested.status;
      }
      if (permission !== 'granted') {
        setStatus(formatStatus(permission));
        setStatusHint("Autorisation refusee. Passe par les reglages systeme si besoin.");
        showToast('Autorisation notifications refusee.', 'error');
        return;
      }

      let tokenResponse;
      try {
        tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      } catch (err) {
        const message = String(err?.message || err || '');
        if (message.toLowerCase().includes('projectid')) {
          setStatus('Configuration requise');
          setStatusHint('Definis EXPO_PUBLIC_EAS_PROJECT_ID pour generer le push token.');
          return;
        }
        throw err;
      }

      await registerPushToken({
        ownerId,
        token: tokenResponse.data,
        platform: Platform.OS,
      });
      setStatus('Activees');
      setStatusHint('Canal push configure avec succes.');
      showToast('Notifications activees.', 'success');
    } catch (err) {
      const message = err?.message ? String(err.message) : 'Echec activation notifications.';
      setStatus('Erreur');
      setStatusHint(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    if (!token || !account?.id) {
      showToast('Connecte-toi pour envoyer un test.', 'error');
      return;
    }
    try {
      setBusy(true);
      await sendTestNotification({
        ownerId,
        title: 'KariGo',
        body: 'Notification de test depuis Parametres.',
      });
      setStatusHint('Notification de test envoyee.');
      showToast('Notification test envoyee.', 'success');
    } catch {
      showToast('Echec notification test.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={textStyles.title}>Notifications</Text>
          <Text style={textStyles.subtitle}>Gere tes alertes de reservation, messages et trajets.</Text>
        </View>
        <SurfaceCard style={styles.card} tone="soft">
          <SectionHeader title="Connexion requise" icon="log-in-outline" />
          <Text style={styles.infoText}>Connecte-toi pour configurer les notifications push.</Text>
          <PrimaryButton label="Se connecter" onPress={() => navigation.navigate('ProfileDetails')} />
        </SurfaceCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Notifications</Text>
        <Text style={textStyles.subtitle}>Un seul endroit pour activer, tester et diagnostiquer les alertes.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Statut" icon="notifications-outline" />
        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>Etat actuel</Text>
          <Text style={styles.statusValue}>{status}</Text>
        </View>
        <Text style={styles.infoText}>{statusHint}</Text>
        <View style={styles.column}>
          <PrimaryButton
            label={busy ? 'Activation...' : 'Activer / reconfigurer'}
            onPress={handleEnable}
            disabled={busy}
          />
          <PrimaryButton
            label={busy ? 'Envoi...' : 'Envoyer un test'}
            variant="ghost"
            onPress={handleSendTest}
            disabled={busy}
          />
          <PrimaryButton label="Verifier les autorisations" variant="secondary" onPress={refreshPermission} disabled={busy} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Reglages systeme" icon="phone-portrait-outline" />
        <Text style={styles.infoText}>
          Si les alertes restent bloquees, ouvre les reglages de ton appareil pour autoriser KariGo.
        </Text>
        <PrimaryButton
          label="Ouvrir les reglages systeme"
          variant="ghost"
          onPress={async () => {
            try {
              await Linking.openSettings();
            } catch {
              showToast("Impossible d'ouvrir les reglages.", 'error');
            }
          }}
        />
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
  statusBlock: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    backgroundColor: colors.white,
    padding: 12,
    gap: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    color: colors.slate900,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 13,
    color: colors.slate600,
  },
  column: {
    gap: spacing.sm,
  },
});
