import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { getConversations, getMessagingWsUrl } from '../api/messaging';
import { useAuth } from '../auth';
import { getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';

function AnimatedListItem({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      {children}
    </Animated.View>
  );
}

export function MessagesScreen({ navigation }) {
  const { account, token } = useAuth();
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
        if (!token) return;
        socket.send(JSON.stringify({ type: 'subscribe', token }));
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
  }, [account?.id, token]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Messages</Text>
      <Text style={text.subtitle}>
        Conversations recentes. {onlineCount} personne{onlineCount > 1 ? 's' : ''} en ligne.
      </Text>

      {loading && (
        <SurfaceCard style={styles.loadingCard} tone="soft" delay={60}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </SurfaceCard>
      )}

      {error ? <Banner tone="error" message={error} /> : null}

      {loading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SurfaceCard key={`sk-msg-${index}`} style={styles.skeletonCard} tone="soft" animated={false}>
              <View style={styles.skeletonRow}>
                <SkeletonBlock width={44} height={44} rounded />
                <View style={styles.skeletonText}>
                  <SkeletonBlock width="60%" height={12} />
                  <SkeletonBlock width="80%" height={10} />
                </View>
              </View>
            </SurfaceCard>
          ))}
        </View>
      ) : null}

      {items.map((item, index) => {
        const otherId = item.otherParticipant?.id;
        const online = otherId ? presenceMap[otherId] : false;
        const displayName = getFirstName(item.otherParticipant?.label) || item.otherParticipant?.label || 'Contact';
        return (
          <AnimatedListItem key={item.id} delay={120 + index * 35}>
            <SurfaceCard style={styles.card} animated={false}>
            <Pressable
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
            </SurfaceCard>
          </AnimatedListItem>
        );
      })}

      {!loading && items.length === 0 && !error ? (
        <SurfaceCard style={styles.emptyCard} tone="soft" delay={90}>
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptyText}>Tu verras ici tes messages recents.</Text>
        </SurfaceCard>
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
  },
  loadingText: {
    fontSize: 13,
    color: colors.slate600,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonText: {
    flex: 1,
    gap: 6,
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
