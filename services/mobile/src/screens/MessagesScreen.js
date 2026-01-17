import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { getConversations } from '../api/messaging';
import { useAuth } from '../auth';

export function MessagesScreen() {
  const { account } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!account?.id) return;
      setLoading(true);
      setError('');
      try {
        const data = await getConversations(account.id);
        if (active) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError('Impossible de charger les messages.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [account?.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Messages</Text>
      <Text style={text.subtitle}>Conversations recentes.</Text>

      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.otherParticipant?.label || 'Contact'}</Text>
          <Text style={styles.preview}>{item.lastMessagePreview || 'Nouvelle conversation'}</Text>
          <Text style={styles.meta}>Non lus: {item.unreadCount ?? 0}</Text>
        </View>
      ))}

      {!loading && items.length === 0 && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptyText}>Tu verras ici tes messages recents.</Text>
        </View>
      ) : null}
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  preview: {
    fontSize: 13,
    color: colors.slate600,
  },
  meta: {
    fontSize: 12,
    color: colors.slate500,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate600,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  emptyText: {
    fontSize: 13,
    color: colors.slate600,
    textAlign: 'center',
  },
});
