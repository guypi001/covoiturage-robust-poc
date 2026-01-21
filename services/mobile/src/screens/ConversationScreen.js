import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, text } from '../theme';
import { useAuth } from '../auth';
import {
  getMessages,
  getMessagingWsUrl,
  markConversationRead,
  markMessagesRead,
  sendMessage,
  uploadMessageAttachment,
} from '../api/messaging';
import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../ui/ToastContext';
import { resolveAssetUrl } from '../config';
import { getDisplayName, getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

function AnimatedMessage({ children, delay = 0, fromRight = false, emphasis = false }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const translateX = useRef(new Animated.Value(fromRight ? 8 : -8)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!emphasis) return;
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [delay, emphasis, opacity, scale, translateX, translateY]);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateX }, { translateY }, { scale }] }}
    >
      {children}
    </Animated.View>
  );
}

function TypingPulse() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulse = (node, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(node, {
            toValue: 1,
            duration: 320,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(node, {
            toValue: 0.3,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const anim1 = createPulse(dot1, 0);
    const anim2 = createPulse(dot2, 120);
    const anim3 = createPulse(dot3, 240);
    anim1.start();
    anim2.start();
    anim3.start();
    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
    </View>
  );
}

export function ConversationScreen({ route }) {
  const { account } = useAuth();
  const { showToast } = useToast();
  const { conversationId, otherParticipant } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [lastSentId, setLastSentId] = useState('');
  const scrollRef = useRef(null);
  const socketRef = useRef(null);

  const sendTyping = (active) => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN &&
      account?.id &&
      otherParticipant?.id &&
      conversationId
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: 'typing',
          userId: account.id,
          recipientId: otherParticipant.id,
          conversationId,
          active,
        }),
      );
    }
  };

  useEffect(() => {
    let socket;
    if (account?.id && conversationId) {
      socket = new WebSocket(getMessagingWsUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'subscribe', userId: account.id }));
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'message.new') {
            const msg = payload?.data?.message;
            if (msg?.conversationId === conversationId) {
              setMessages((prev) => {
                if (prev.some((item) => item.id === msg.id)) return prev;
                return [...prev, msg];
              });
              if (msg?.recipientId === account?.id) {
                markMessagesRead(account.id, [msg.id]).catch(() => {});
                markConversationRead(conversationId, account.id).catch(() => {});
              }
            }
          }
          if (payload?.type === 'message.read' && Array.isArray(payload?.data?.messageIds)) {
            const readIds = new Set(payload.data.messageIds);
            setMessages((prev) =>
              prev.map((msg) =>
                readIds.has(msg.id)
                  ? { ...msg, status: 'READ', readAt: payload?.data?.readAt || msg.readAt || new Date().toISOString() }
                  : msg,
              ),
            );
          }
          if (payload?.type === 'message.delivered') {
            const deliveredId = payload?.data?.messageId;
            if (deliveredId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === deliveredId
                    ? { ...msg, status: 'DELIVERED', deliveredAt: payload?.data?.deliveredAt || msg.deliveredAt }
                    : msg,
                ),
              );
            }
          }
          if (payload?.type === 'presence.update') {
            const { userId, online } = payload.data || {};
            if (userId) {
              setPresenceMap((prev) => ({ ...prev, [userId]: Boolean(online) }));
            }
          }
          if (payload?.type === 'typing.update') {
            const { userId, active, conversationId: typingConversationId } = payload.data || {};
            if (userId && typingConversationId) {
              setTypingMap((prev) => ({
                ...prev,
                [userId]: {
                  active: Boolean(active),
                  conversationId: typingConversationId,
                },
              }));
            }
          }
        } catch {
          // ignore
        }
      };
    }
    return () => {
      if (socket) socket.close();
    };
  }, [account?.id, conversationId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!account?.id || !conversationId) return;
      setLoading(true);
      try {
        const items = await getMessages(conversationId, account.id);
        if (!active) return;
        setMessages(Array.isArray(items) ? items : []);
        const unreadIds = (Array.isArray(items) ? items : [])
          .filter((msg) => msg.recipientId === account.id && msg.status !== 'READ')
          .map((msg) => msg.id);
        if (unreadIds.length) {
          await markMessagesRead(account.id, unreadIds);
        }
        await markConversationRead(conversationId, account.id);
      } catch (err) {
        if (active) showToast('Impossible de charger la conversation.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [account?.id, conversationId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, [messages]);

  const title = useMemo(() => {
    if (!otherParticipant?.label) return 'Conversation';
    return getFirstName(otherParticipant.label) || otherParticipant.label;
  }, [otherParticipant]);
  const otherOnline = otherParticipant?.id ? presenceMap[otherParticipant.id] : false;
  const otherTypingEntry = otherParticipant?.id ? typingMap[otherParticipant.id] : null;
  const otherTyping =
    Boolean(otherTypingEntry?.active) && otherTypingEntry?.conversationId === conversationId;

  const triggerSendHaptic = () => {
    if (Platform.OS !== 'ios') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const createClientMessageId = () =>
    `${account?.id || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleSend = async () => {
    const trimmed = textValue.trim();
    if (!trimmed || !account?.id) return;
    sendTyping(false);
    try {
      setSending(true);
      const clientMessageId = createClientMessageId();
      const res = await sendMessage({
        senderId: account.id,
        senderType: account.type || 'INDIVIDUAL',
        senderLabel: getDisplayName(account),
        recipientId: otherParticipant?.id,
        recipientType: otherParticipant?.type || 'INDIVIDUAL',
        recipientLabel: otherParticipant?.label,
        body: trimmed,
        clientMessageId,
      });
      setTextValue('');
      sendTyping(false);
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
        setLastSentId(res.message.id);
        triggerSendHaptic();
      }
    } catch (err) {
      showToast('Envoi impossible.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Autorisation photo requise.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: asset.fileName || `piece-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };
    try {
      setSending(true);
      const upload = await uploadMessageAttachment(file);
      const clientMessageId = createClientMessageId();
      const res = await sendMessage({
        senderId: account.id,
        senderType: account.type || 'INDIVIDUAL',
        senderLabel: getDisplayName(account),
        recipientId: otherParticipant?.id,
        recipientType: otherParticipant?.type || 'INDIVIDUAL',
        recipientLabel: otherParticipant?.label,
        attachmentUrl: upload.url,
        attachmentName: upload.name,
        attachmentType: upload.type,
        clientMessageId,
      });
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
        setLastSentId(res.message.id);
        triggerSendHaptic();
      }
      showToast('Piece jointe envoyee.', 'success');
    } catch (err) {
      showToast('Upload impossible.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <SurfaceCard style={styles.headerCard} tone="soft" animated={false}>
        <SectionHeader
          title={title}
          icon="chatbubble-ellipses-outline"
          meta={otherOnline ? 'En ligne' : 'Hors ligne'}
        />
        <View style={styles.statusRow}>
          <Text style={styles.subtitle}>{otherTyping ? 'Ecrit...' : loading ? 'Sync...' : 'OK'}</Text>
          {otherTyping ? <TypingPulse /> : null}
        </View>
      </SurfaceCard>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {messages.map((msg, index) => {
          const isMine = msg.senderId === account?.id;
          return (
            <AnimatedMessage
              key={msg.id}
              delay={index * 35}
              fromRight={isMine}
              emphasis={isMine && msg.id === lastSentId}
            >
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {msg.attachmentUrl ? (
                    <View style={styles.attachment}>
                      <Text style={styles.attachmentText}>
                        Piece jointe: {msg.attachmentName || 'fichier'}
                      </Text>
                      <Text style={styles.attachmentLink}>{resolveAssetUrl(msg.attachmentUrl)}</Text>
                    </View>
                  ) : null}
                  {msg.body ? <Text style={styles.messageText}>{msg.body}</Text> : null}
                  <Text style={styles.metaText}>
                    {formatTime(msg.createdAt)}
                    {isMine && msg.status === 'READ' ? (
                      <Text style={styles.readCheck}>{` · ✓✓`}</Text>
                    ) : null}
                    {isMine && msg.status === 'DELIVERED' ? (
                      <Text style={styles.deliveredCheck}>{` · ✓✓`}</Text>
                    ) : null}
                    {isMine && msg.status === 'SENT' ? (
                      <Text style={styles.sentCheck}>{` · ✓`}</Text>
                    ) : null}
                  </Text>
                </View>
              </View>
            </AnimatedMessage>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <Pressable style={styles.attachButton} onPress={handleAttachment} disabled={sending}>
          <Text style={styles.attachText}>+</Text>
        </Pressable>
        <TextInput
          value={textValue}
          onChangeText={(val) => {
            setTextValue(val);
            sendTyping(val.length > 0);
          }}
          onFocus={() => {
            sendTyping(true);
          }}
          onBlur={() => {
            sendTyping(false);
          }}
          placeholder="Ecris un message..."
          placeholderTextColor={colors.slate500}
          style={styles.input}
        />
        <PrimaryButton label="Envoyer" onPress={handleSend} disabled={sending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  headerCard: {
    margin: spacing.lg,
    marginBottom: 0,
    gap: spacing.xs,
  },
  subtitle: {
    fontSize: 12,
    color: colors.slate500,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.slate400,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  bubbleMine: {
    backgroundColor: colors.sky100,
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  messageText: {
    fontSize: 14,
    color: colors.slate900,
  },
  metaText: {
    fontSize: 11,
    color: colors.slate500,
  },
  sentCheck: {
    color: colors.slate400,
  },
  deliveredCheck: {
    color: colors.slate500,
  },
  readCheck: {
    color: colors.emerald600,
  },
  attachment: {
    gap: 4,
  },
  attachmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  attachmentLink: {
    fontSize: 11,
    color: colors.brandPrimary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: {
    fontSize: 22,
    color: colors.slate600,
  },
});
