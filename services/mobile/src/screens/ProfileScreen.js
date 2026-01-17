import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { registerPushToken, sendTestNotification } from '../api/notifications';

export function ProfileScreen() {
  const [pushStatus, setPushStatus] = useState('Notifications desactivees');
  const [pushBusy, setPushBusy] = useState(false);
  const [ownerId] = useState('demo-user');

  const handleEnablePush = async () => {
    try {
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
    } catch (err) {
      setPushStatus('Erreur activation');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setPushBusy(true);
      await sendTestNotification({ ownerId, title: 'KariGo', body: 'Test notification mobile.' });
      setPushStatus('Notification test envoyee');
    } catch (err) {
      setPushStatus('Echec notification test');
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

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>KariGo User</Text>
          <Text style={styles.meta}>Compte individuel · Abidjan</Text>
          <View style={styles.tagRow}>
            <Text style={styles.tag}>Verification OK</Text>
            <Text style={styles.tag}>Suivi actif</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>4</Text>
          <Text style={styles.statLabel}>Trajets effectues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statLabel}>Reservations</Text>
        </View>
      </View>

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
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Activer les notifications" onPress={handleEnablePush} disabled={pushBusy} />
        <PrimaryButton label="Envoyer un test" variant="ghost" onPress={handleTestPush} disabled={pushBusy} />
        <PrimaryButton label="Se deconnecter" />
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
});
