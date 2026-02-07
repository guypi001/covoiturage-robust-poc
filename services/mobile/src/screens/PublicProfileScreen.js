import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, text } from '../theme';
import { useAuth } from '../auth';
import { getPublicProfile } from '../api/bff';
import { SurfaceCard } from '../components/SurfaceCard';
import { BrandMark } from '../components/BrandMark';
import { Banner } from '../components/Banner';
import { PROFILE_QUESTIONS } from '../utils/profileQuestions';

export function PublicProfileScreen({ route }) {
  const { token } = useAuth();
  const accountId = route?.params?.accountId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ratingSummary = profile?.ratingSummary;
  const ratingAverage = ratingSummary?.averages?.overall || 0;
  const ratingCount = ratingSummary?.count || 0;

  const answeredQuestions = useMemo(() => {
    const answers = profile?.profileAnswers || {};
    return PROFILE_QUESTIONS.map((question) => ({
      ...question,
      value: answers?.[question.key],
    })).filter((item) => typeof item.value === 'boolean');
  }, [profile]);

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
            <View style={styles.infoItemWide}>
              <Text style={styles.label}>Note globale</Text>
              <View style={styles.ratingRow}>
                {Array.from({ length: 5 }).map((_, index) => {
                  const active = index + 1 <= Math.round(ratingAverage);
                  return (
                    <Ionicons
                      key={`star-${index}`}
                      name={active ? 'star' : 'star-outline'}
                      size={18}
                      color={active ? colors.amber500 : colors.slate300}
                    />
                  );
                })}
                <Text style={styles.ratingValue}>
                  {ratingCount ? ratingAverage.toFixed(1) : '--'} ({ratingCount})
                </Text>
              </View>
              <View style={styles.ratingMetaRow}>
                <Text style={styles.ratingMeta}>
                  Ponctualite: {ratingCount ? ratingSummary?.averages?.punctuality?.toFixed?.(1) : '--'}
                </Text>
                <Text style={styles.ratingMeta}>
                  Conduite: {ratingCount ? ratingSummary?.averages?.driving?.toFixed?.(1) : '--'}
                </Text>
                <Text style={styles.ratingMeta}>
                  Proprete: {ratingCount ? ratingSummary?.averages?.cleanliness?.toFixed?.(1) : '--'}
                </Text>
              </View>
            </View>
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
            {answeredQuestions.length ? (
              <View style={styles.infoItemWide}>
                <Text style={styles.label}>Profil voyageur</Text>
                <View style={styles.answerGrid}>
                  {answeredQuestions.map((item) => (
                    <View key={item.key} style={styles.answerRow}>
                      <Ionicons
                        name={item.value ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={item.value ? colors.emerald500 : colors.rose400}
                      />
                      <Text style={styles.answerText}>{item.label}</Text>
                    </View>
                  ))}
                </View>
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ratingValue: {
    fontSize: 13,
    color: colors.slate700,
    marginLeft: 4,
  },
  ratingMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ratingMeta: {
    fontSize: 12,
    color: colors.slate500,
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
  answerGrid: {
    marginTop: 6,
    gap: 6,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  answerText: {
    fontSize: 13,
    color: colors.slate700,
  },
});
