import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { getConversations, getMessagingWsUrl } from '../api/messaging';
import { useAuth } from '../auth';
import { getFirstName } from '../utils/name';

export function MessagesScreen({ navigation }) {
  const { account } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  const onlineCount = useMemo(() => {
    const uniqueIds = new Set(
      items
        .map((item) => item.otherParticipant?.id)
        .filter((id) => typeof id === 'string'),
    );
    let count = 0;
    uniqueIds.forEach((id) => {
      if (presenceMap[id]) count += 1;
    });
    return count;
  }, [items, presenceMap]);

  useEffect(() => {
    let active = true;
    let socket;
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
    if (account?.id) {
      socket = new WebSocket(getMessagingWsUrl());
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'subscribe', userId: account.id }));
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'message.new') {
            fetchData();
          }
          if (payload?.type === 'presence.update') {
            const { userId, online } = payload.data || {};
            if (userId) {
              setPresenceMap((prev) => ({ ...prev, [userId]: Boolean(online) }));
            }
          }
        } catch {
          // ignore
        }
      };
    }
    return () => {
      active = false;
      if (socket) socket.close();
    };
  }, [account?.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Messages</Text>
      <Text style={text.subtitle}>
        Conversations recentes. {onlineCount} personne{onlineCount > 1 ? 's' : ''} en ligne.
      </Text>

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

      {items.map((item) => {
        const otherId = item.otherParticipant?.id;
        const online = otherId ? presenceMap[otherId] : false;
        const displayName = getFirstName(item.otherParticipant?.label) || item.otherParticipant?.label || 'Contact';
        return (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() =>
              navigation.navigate('Conversation', {
                conversationId: item.id,
                otherParticipant: item.otherParticipant,
              })
            }
          >
            <View style={styles.row}>
              <View style={[styles.avatar, online && styles.avatarOnline]}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.headerRow}>
                  <Text style={styles.name}>{displayName}</Text>
                  <Text style={styles.presence}>{online ? 'En ligne' : 'Hors ligne'}</Text>
                </View>
                <Text style={styles.preview}>{item.lastMessagePreview || 'Nouvelle conversation'}</Text>
                <Text style={styles.meta}>Non lus: {item.unreadCount ?? 0}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  avatarOnline: {
    borderColor: colors.emerald500,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate700,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presence: {
    fontSize: 11,
    color: colors.slate500,
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
