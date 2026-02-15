import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { getConversations, getMessagingWsUrl } from '../api/messaging';
import { getPublicProfile } from '../api/bff';
import { useAuth } from '../auth';
import { getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';
import { resolveAssetUrl } from '../config';

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profilePhotoCache = new Map();

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

  return <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}

export function MessagesScreen({ navigation }) {
  const { account, token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  const [participantPhotoMap, setParticipantPhotoMap] = useState({});
  const hydratedPhotoIdsRef = useRef(new Set());
  const refreshTimeoutRef = useRef(null);

  const onlineCount = useMemo(() => {
    const uniqueIds = new Set(items.map((item) => item.otherParticipant?.id).filter((id) => typeof id === 'string'));
    let count = 0;
    uniqueIds.forEach((id) => {
      if (presenceMap[id]) count += 1;
    });
    return count;
  }, [items, presenceMap]);

  useEffect(() => {
    let active = true;
    let socket;

    const hydratePhotos = async (itemsList) => {
      if (!token) return;
      const ids = Array.from(
        new Set(itemsList.map((item) => item?.otherParticipant?.id).filter((id) => typeof id === 'string' && id.length > 0)),
      );
      const now = Date.now();
      const missing = ids.filter((id) => {
        if (hydratedPhotoIdsRef.current.has(id)) return false;
        const cached = profilePhotoCache.get(id);
        return !cached || cached.expiresAt <= now;
      });

      if (!missing.length) {
        setParticipantPhotoMap((prev) => {
          const next = { ...prev };
          ids.forEach((id) => {
            const cached = profilePhotoCache.get(id);
            if (cached?.url !== undefined) {
              next[id] = cached.url;
              hydratedPhotoIdsRef.current.add(id);
            }
          });
          return next;
        });
        return;
      }

      const profiles = await Promise.allSettled(
        missing.map(async (id) => {
          const profile = await getPublicProfile(token, id);
          return { id, photo: profile?.profilePhotoUrl || '' };
        }),
      );

      if (!active) return;

      setParticipantPhotoMap((prev) => {
        const next = { ...prev };
        profiles.forEach((entry) => {
          if (entry.status !== 'fulfilled') return;
          hydratedPhotoIdsRef.current.add(entry.value.id);
          next[entry.value.id] = entry.value.photo;
          profilePhotoCache.set(entry.value.id, {
            url: entry.value.photo,
            expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
          });
        });
        return next;
      });
    };

    const fetchData = async () => {
      if (!account?.id) return;
      setLoading(true);
      setError('');
      try {
        const data = await getConversations(account.id);
        if (!active) return;
        const itemsList = Array.isArray(data) ? data : [];
        setItems(itemsList);
        await hydratePhotos(itemsList);
      } catch {
        if (active) setError('Impossible de charger les messages.');
      } finally {
        if (active) setLoading(false);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        fetchData();
      }, 300);
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
            scheduleRefresh();
          }
          if (payload?.type === 'message.read') {
            scheduleRefresh();
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
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (socket) socket.close();
    };
  }, [account?.id, token]);

  const renderConversation = ({ item, index }) => {
    const otherId = item.otherParticipant?.id;
    const online = otherId ? presenceMap[otherId] : false;
    const displayName = getFirstName(item.otherParticipant?.label) || item.otherParticipant?.label || 'Contact';
    const participantPhoto = otherId ? participantPhotoMap[otherId] : '';
    const resolvedPhoto = participantPhoto ? resolveAssetUrl(participantPhoto) : '';

    return (
      <AnimatedListItem delay={120 + index * 35}>
        <SurfaceCard style={styles.card} animated={false}>
          <Pressable
            onPress={() =>
              navigation.navigate('Conversation', {
                conversationId: item.id,
                otherParticipant: {
                  ...item.otherParticipant,
                  profilePhotoUrl: participantPhoto || null,
                },
              })
            }
          >
            <View style={styles.row}>
              <View style={[styles.avatar, online && styles.avatarOnline]}>
                {resolvedPhoto ? (
                  <Image source={{ uri: resolvedPhoto }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                )}
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
  };

  const listHeader = (
    <View style={styles.content}>
      <Text style={text.title}>Messages</Text>
      <Text style={text.subtitle}>Conversations recentes. {onlineCount} personne{onlineCount > 1 ? 's' : ''} en ligne.</Text>

      {loading ? (
        <SurfaceCard style={styles.loadingCard} tone="soft" delay={60}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </SurfaceCard>
      ) : null}

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
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={loading ? [] : items}
      keyExtractor={(item) => item.id}
      renderItem={renderConversation}
      ListHeaderComponent={listHeader}
      ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      ListEmptyComponent={
        !loading && items.length === 0 && !error ? (
          <SurfaceCard style={styles.emptyCard} tone="soft" delay={90}>
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptyText}>Tu verras ici tes messages recents.</Text>
          </SurfaceCard>
        ) : null
      }
    />
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
  listContent: {
    paddingBottom: spacing.lg,
  },
  card: {
    marginHorizontal: spacing.lg,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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
    marginHorizontal: spacing.lg,
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
  itemSeparator: {
    height: spacing.md,
  },
});
