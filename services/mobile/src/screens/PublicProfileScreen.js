import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { useAuth } from '../auth';
import { getPublicProfile } from '../api/identity';
import { SurfaceCard } from '../components/SurfaceCard';
import { BrandMark } from '../components/BrandMark';
import { Banner } from '../components/Banner';

export function PublicProfileScreen({ route }) {
  const { token } = useAuth();
  const accountId = route?.params?.accountId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token || !accountId) return;
      setLoading(true);
      setError('');
      try {
        const data = await getPublicProfile(token, accountId);
        if (active) setProfile(data);
      } catch (err) {
        if (active) setError('Impossible de charger le profil.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [accountId, token]);

  const displayName =
    profile?.fullName ||
    profile?.companyName ||
    profile?.email?.split('@')?.[0] ||
    'Profil KariGo';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SurfaceCard style={styles.card} delay={80}>
        <View style={styles.header}>
          <BrandMark size={48} />
          <View style={styles.headerText}>
            <Text style={text.sectionTitle}>{displayName}</Text>
            <Text style={text.caption}>{profile?.type === 'COMPANY' ? 'Entreprise' : 'Conducteur'}</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.sky600} /> : null}
        {error ? <Banner tone="error" message={error} /> : null}
        {profile && !loading ? (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{profile.email || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Verification email</Text>
              <Text style={styles.value}>
                {profile.emailVerifiedAt ? 'Verifie' : 'Non verifie'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Telephone</Text>
              <Text style={styles.value}>{profile.contactPhone || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Verification telephone</Text>
              <Text style={styles.value}>
                {profile.phoneVerifiedAt ? 'Verifie' : 'Non verifie'}
              </Text>
            </View>
            {profile.tagline ? (
              <View style={styles.infoItemWide}>
                <Text style={styles.label}>Presentation</Text>
                <Text style={styles.value}>{profile.tagline}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
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
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  infoGrid: {
    gap: spacing.sm,
  },
  infoItem: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  infoItemWide: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 14,
    color: colors.slate900,
    marginTop: 4,
  },
});
