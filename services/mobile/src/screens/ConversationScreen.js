import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

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

  const handleSend = async () => {
    const trimmed = textValue.trim();
    if (!trimmed || !account?.id) return;
    sendTyping(false);
    try {
      setSending(true);
      const res = await sendMessage({
        senderId: account.id,
        senderType: account.type || 'INDIVIDUAL',
        senderLabel: getDisplayName(account),
        recipientId: otherParticipant?.id,
        recipientType: otherParticipant?.type || 'INDIVIDUAL',
        recipientLabel: otherParticipant?.label,
        body: trimmed,
      });
      setTextValue('');
      sendTyping(false);
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
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
      });
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
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
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {otherOnline ? 'En ligne' : 'Hors ligne'} · {otherTyping ? 'Ecrit...' : loading ? 'Sync...' : 'OK'}
        </Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {messages.map((msg) => {
          const isMine = msg.senderId === account?.id;
          return (
            <View key={msg.id} style={[styles.messageRow, isMine && styles.messageRowMine]}>
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
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    backgroundColor: colors.white,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  subtitle: {
    fontSize: 12,
    color: colors.slate500,
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
