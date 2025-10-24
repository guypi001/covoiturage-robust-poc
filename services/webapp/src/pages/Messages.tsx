import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  type AccountType,
  ChatMessage,
  ConversationSummary,
  MessageNotificationSummary,
  fetchConversations,
  fetchConversationMessages,
  getMessageNotifications,
  lookupAccountByEmail,
  markConversationRead,
  sendChatMessage,
} from '../api';
import { useApp } from '../store';
import { Bell, CheckCheck, MailPlus, MessageSquareText, RefreshCw, Send } from 'lucide-react';

function formatDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return value;
  }
}

function extractErrorMessage(err: any) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Erreur inattendue';
}

type ContactPrefill = {
  id: string;
  type: AccountType;
  label?: string | null;
  email?: string;
};

export default function Messages() {
  const account = useApp((state) => state.account);
  const token = useApp((state) => state.token);
  const refreshBadge = useApp((state) => state.refreshMessageBadge);
  const location = useLocation();
  const navigate = useNavigate();

  const userId = account?.id ?? '';
  const userType = account?.type ?? 'INDIVIDUAL';
  const userLabel = account?.fullName ?? account?.companyName ?? account?.email ?? 'Moi';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<MessageNotificationSummary | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [draft, setDraft] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBody, setNewBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conv) => conv.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    const state = location.state as { contact?: ContactPrefill } | null;
    if (state?.contact) {
      setContactPrefill(state.contact);
      if (state.contact.email) {
        setNewEmail((prev) => prev || state.contact.email || '');
      }
      // Nettoie l'état d'historique pour éviter la répétition lors des navigations
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!userId) return;
    void loadConversations();
  }, [userId]);

  useEffect(() => {
    if (!selectedConversationId || !userId) return;
    void loadMessages(selectedConversationId);
  }, [selectedConversationId, userId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
    }
  }, [selectedConversationId]);

  const loadConversations = async () => {
    if (!userId) return;
    setLoadingConversations(true);
    setError(null);
    try {
      const [convs, notif] = await Promise.all([
        fetchConversations(userId),
        getMessageNotifications(userId),
      ]);
      setConversations(convs);
      setNotifications(notif);
      setSelectedConversationId((prev) => {
        if (prev && convs.some((conv) => conv.id === prev)) return prev;
        if (contactPrefill) {
          const existing = convs.find((conv) => conv.otherParticipant.id === contactPrefill.id);
          if (existing) return existing.id;
        }
        return convs[0]?.id ?? null;
      });
      if (
        contactPrefill &&
        !convs.some((conv) => conv.otherParticipant.id === contactPrefill.id) &&
        contactPrefill.email
      ) {
        setNewEmail(contactPrefill.email);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const items = await fetchConversationMessages(conversationId, userId);
      setMessages(items);
      await markConversationRead(conversationId, userId).catch(() => undefined);
      await refreshBadge();
      const notif = await getMessageNotifications(userId);
      setNotifications(notif);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !draft.trim()) return;
    const other = selectedConversation.otherParticipant;
    setSending(true);
    setError(null);
    try {
      const response = await sendChatMessage({
        senderId: userId,
        senderType: userType,
        senderLabel: userLabel,
        recipientId: other.id,
        recipientType: other.type,
        recipientLabel: other.label ?? 'Destinataire',
        body: draft.trim(),
      });
      setDraft('');
      setMessages((prev) => [...prev, response.message]);
      setConversations((prev) => {
        const remaining = prev.filter((conv) => conv.id !== response.conversation.id);
        return [response.conversation, ...remaining];
      });
      setSelectedConversationId(response.conversation.id);
      await refreshBadge();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!newEmail.trim() || !newBody.trim() || !userId || !token) return;
    setStartingConversation(true);
    setError(null);
    try {
      const profile = await lookupAccountByEmail(newEmail.trim(), token);
      if (profile.id === userId) {
        throw new Error('Tu ne peux pas te contacter toi-même.');
      }
      const response = await sendChatMessage({
        senderId: userId,
        senderType: userType,
        senderLabel: userLabel,
        recipientId: profile.id,
        recipientType: profile.type,
        recipientLabel: profile.fullName ?? profile.companyName ?? profile.email,
        body: newBody.trim(),
      });
      setNewEmail('');
      setNewBody('');
      setMessages([response.message]);
      setConversations((prev) => {
        const others = prev.filter((conv) => conv.id !== response.conversation.id);
        return [response.conversation, ...others];
      });
      setSelectedConversationId(response.conversation.id);
      await refreshBadge();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setStartingConversation(false);
    }
  };

  if (!account) {
    return <div className="container-wide py-8">Connecte-toi pour accéder aux messages.</div>;
  }

  return (
    <div className="container-wide py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Centre de messagerie</p>
          <h1 className="text-2xl font-semibold text-slate-900">Conversations</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <button
            onClick={loadConversations}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
          {notifications && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Bell size={16} className="text-sky-500" />
              <span className="text-xs">
                {notifications.unreadConversations} conv • {notifications.unreadMessages} msg
              </span>
            </div>
          )}
        </div>
      </div>

      {notifications && notifications.items.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Bell size={16} className="text-sky-500" />
            Nouvelle activité
          </div>
          <ul className="space-y-1 text-sm text-slate-600">
            {notifications.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="text-slate-800 font-medium">
                  {item.sender?.label ?? 'Nouveau message'}
                </span>
                <span className="text-slate-400 text-xs">{formatDate(item.createdAt)}</span>
                <span className="text-slate-500">{item.preview ?? 'Pièce jointe'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px,minmax(0,1fr)]">
        <aside className="card p-4 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Conversations</p>
            {loadingConversations && <div className="text-xs text-slate-400">Chargement…</div>}
            {conversations.length === 0 && !loadingConversations && (
              <p className="text-sm text-slate-500">Aucune conversation pour le moment.</p>
            )}
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      conv.id === selectedConversationId
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800">
                        {conv.otherParticipant.label ?? conv.otherParticipant.id}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="rounded-full bg-sky-500 px-2 text-[11px] font-semibold text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {conv.lastMessagePreview ?? 'Aucun message'}
                    </p>
                    <p className="text-[11px] text-slate-400">{formatDate(conv.lastMessageAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <MailPlus size={14} />
              Nouvel échange
            </div>
            {contactPrefill && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                Tu t'apprêtes à contacter{' '}
                <span className="font-semibold text-slate-800">
                  {contactPrefill.label ?? contactPrefill.email ?? contactPrefill.id}
                </span>
                . Si aucune conversation n'existe encore, renseigne son adresse mail puis ton message ci-dessous.
              </div>
            )}
            <input
              className="input w-full text-sm"
              placeholder="Email du destinataire"
              value={newEmail}
              onChange={(e) => setNewEmail(e.currentTarget.value)}
            />
            <textarea
              className="input w-full text-sm h-24"
              placeholder="Ton message…"
              value={newBody}
              onChange={(e) => setNewBody(e.currentTarget.value)}
            />
            <button
              onClick={handleStartConversation}
              disabled={startingConversation || !newEmail.trim() || !newBody.trim() || !token}
              className="btn-primary w-full h-10 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MessageSquareText size={16} />
              Démarrer
            </button>
          </div>
        </aside>

        <section className="card flex flex-col h-[600px]">
          {selectedConversation ? (
            <>
              <header className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-500">Discussion</p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedConversation.otherParticipant.label ??
                      selectedConversation.otherParticipant.id}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedConversation.otherParticipant.type === 'COMPANY'
                      ? 'Compte entreprise'
                      : 'Compte particulier'}
                  </p>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingMessages && <div className="text-xs text-slate-400">Chargement des messages…</div>}
                {messages.length === 0 && !loadingMessages && (
                  <div className="text-sm text-slate-500">Commence la conversation avec un premier message.</div>
                )}
                {messages.map((message) => {
                  const isMine = message.senderId === userId;
                  const status = message.status === 'READ';
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[75%] text-sm shadow-sm ${
                          isMine ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p>{message.body}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] opacity-80">
                          <span>{formatDate(message.createdAt)}</span>
                          {isMine && (
                            <CheckCheck
                              size={14}
                              className={status ? 'text-sky-200' : 'text-white/60'}
                              style={{
                                filter: status ? 'drop-shadow(0 0 4px rgba(14,165,233,.65))' : undefined,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer className="border-t border-slate-100 px-5 py-4 flex items-center gap-3">
                <textarea
                  className="input flex-1 min-h-[54px]"
                  placeholder="Écrire un message…"
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !draft.trim()}
                  className="btn-primary h-12 px-4 flex items-center gap-2 disabled:opacity-60"
                >
                  <Send size={18} />
                  Envoyer
                </button>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              Sélectionne une conversation ou crée un nouvel échange.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
