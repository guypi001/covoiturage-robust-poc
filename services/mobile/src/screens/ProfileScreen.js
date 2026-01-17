import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { InputField } from '../components/InputField';
import { registerPushToken, sendTestNotification } from '../api/notifications';
import { getMyBookings, getMyPaymentMethods } from '../api/bff';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';

export function ProfileScreen({ navigation }) {
  const { token, account, guest, login, logout, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [pushStatus, setPushStatus] = useState('Notifications desactivees');
  const [pushBusy, setPushBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const ownerId = account?.id || 'demo-user';

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      setLoadingData(true);
      try {
        await refreshProfile();
        const [bookingRes, paymentRes] = await Promise.all([
          getMyBookings(token),
          getMyPaymentMethods(token),
        ]);
        if (active) {
          setBookings(bookingRes?.data || bookingRes?.items || []);
          setPaymentMethods(Array.isArray(paymentRes) ? paymentRes : []);
        }
      } catch (err) {
        if (active) setAuthError('Impossible de charger les donnees.');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [token, refreshProfile]);

  const handleEnablePush = async () => {
    try {
      if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
        setPushStatus('Indisponible sur Expo Go (Android)');
        return;
      }
      setPushBusy(true);
      const settings = await Notifications.getPermissionsAsync();
      let status = settings.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        setPushStatus('Autorisation refusee');
        return;
      }

      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await registerPushToken({
        ownerId,
        token: tokenResponse.data,
        platform: Platform.OS,
      });
      setPushStatus('Notifications actives');
      showToast('Notifications actives.', 'success');
    } catch (err) {
      setPushStatus('Erreur activation');
      showToast('Erreur activation.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setPushBusy(true);
      await sendTestNotification({ ownerId, title: 'KariGo', body: 'Test notification mobile.' });
      setPushStatus('Notification test envoyee');
      showToast('Notification test envoyee.', 'success');
    } catch (err) {
      setPushStatus('Echec notification test');
      showToast('Echec notification test.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Mon profil</Text>
        <Text style={text.subtitle}>Gere tes informations et preferences.</Text>
      </View>

      {guest && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mode visiteur</Text>
          <Text style={styles.helperText}>
            Tu peux consulter les trajets sans compte. Pour reserver et discuter, connecte-toi.
          </Text>
          <PrimaryButton label="Se connecter / s'inscrire" onPress={logout} />
        </View>
      )}

      {!token && !guest && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Connexion</Text>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
          />
          <InputField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="********"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <PrimaryButton
            label="Se connecter"
            onPress={async () => {
              setAuthError('');
              try {
                await login(email, password);
                showToast('Connexion reussie.', 'success');
              } catch (err) {
                setAuthError('Connexion impossible.');
                showToast('Connexion impossible.', 'error');
              }
            }}
          />
        </View>
      )}

      {token && (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{account?.fullName?.charAt?.(0) || 'K'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{account?.fullName || account?.companyName || 'KariGo User'}</Text>
            <Text style={styles.meta}>{account?.type === 'COMPANY' ? 'Compte entreprise' : 'Compte individuel'}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>Verification OK</Text>
              <Text style={styles.tag}>Suivi actif</Text>
            </View>
          </View>
        </View>
      )}

      {token && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{bookings.length}</Text>
            <Text style={styles.statLabel}>Reservations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{paymentMethods.length}</Text>
            <Text style={styles.statLabel}>Moyens de paiement</Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Notifications</Text>
          <Text style={styles.preferenceValue}>{pushStatus}</Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Theme</Text>
          <Text style={styles.preferenceValue}>Clair</Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Mode trajet</Text>
          <Text style={styles.preferenceValue}>Passager</Text>
        </View>
        {loadingData && token ? <Text style={styles.loadingText}>Chargement des donnees...</Text> : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Activer les notifications" onPress={handleEnablePush} disabled={pushBusy} />
        <PrimaryButton label="Envoyer un test" variant="ghost" onPress={handleTestPush} disabled={pushBusy} />
        {token ? (
          <>
            <PrimaryButton label="Messagerie" variant="ghost" onPress={() => navigation.navigate('Messages')} />
            <PrimaryButton label="Se deconnecter" onPress={logout} />
          </>
        ) : guest ? (
          <PrimaryButton label="Quitter le mode visiteur" onPress={logout} />
        ) : null}
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
    gap: 4,
  },
  profileCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.sky600,
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: colors.emerald100,
    color: colors.emerald500,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  meta: {
    fontSize: 13,
    color: colors.slate500,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate900,
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preferenceLabel: {
    fontSize: 13,
    color: colors.slate500,
  },
  preferenceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate900,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    color: colors.slate600,
  },
  loadingText: {
    fontSize: 12,
    color: colors.slate500,
  },
});
