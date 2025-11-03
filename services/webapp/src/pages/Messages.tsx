import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import {
  ArrowRight,
  Bell,
  CarFront,
  CheckCheck,
  Clock,
  MailPlus,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  UserCircle,
} from 'lucide-react';

type ContactPrefill = {
  id: string;
  type: AccountType;
  label?: string | null;
  email?: string;
};

type PrefillRideContext = {
  rideId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
};

type RideContextSummary = PrefillRideContext & {
  dateLabel: string;
  timeLabel: string;
};

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

function getInitials(label: string) {
  return label
    .split(' ')
    .map((chunk) => chunk.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function extractErrorMessage(err: any) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Erreur inattendue';
}

function buildRideTemplate(ctx: RideContextSummary) {
  return `Bonjour, je suis intéressé par votre trajet ${ctx.originCity} → ${ctx.destinationCity} prévu ${ctx.dateLabel} à ${ctx.timeLabel}. Est-ce que des sièges sont toujours disponibles ?`;
}

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
  const [rideContext, setRideContext] = useState<PrefillRideContext | null>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((conv) => conv.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    if (!conversationSearch.trim()) return conversations;
    const needle = conversationSearch.trim().toLowerCase();
    return conversations.filter((conv) => {
      const label = conv.otherParticipant.label?.toLowerCase() ?? '';
      const preview = conv.lastMessagePreview?.toLowerCase() ?? '';
      return label.includes(needle) || preview.includes(needle);
    });
  }, [conversationSearch, conversations]);

  const rideSummary = useMemo<RideContextSummary | null>(() => {
    if (!rideContext) return null;
    const departureDate = new Date(rideContext.departureAt);
    return {
      ...rideContext,
      dateLabel: departureDate.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      timeLabel: departureDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [rideContext]);

  useEffect(() => {
    const state = location.state as { contact?: ContactPrefill; rideContext?: PrefillRideContext } | null;
    if (state?.contact) {
      setContactPrefill(state.contact);
      if (state.contact.email) {
        setNewEmail((prev) => prev || state.contact.email || '');
      }
      setShowComposer(true);
    }
    if (state?.rideContext) {
      setRideContext(state.rideContext);
      if (!newBody.trim()) {
        const summary = {
          ...state.rideContext,
          dateLabel: new Date(state.rideContext.departureAt).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          timeLabel: new Date(state.rideContext.departureAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setNewBody(buildRideTemplate(summary));
        setDraft(buildRideTemplate(summary));
      }
    }
    if (state?.contact || state?.rideContext) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate, newBody]);

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
      const [convs, notif] = await Promise.all([fetchConversations(userId), getMessageNotifications(userId)]);
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
        setShowComposer(true);
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
      setShowComposer(false);
      setContactPrefill(null);
      setRideContext(null);
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

  const handleInsertTemplate = (template: string) => {
    setDraft(template);
  };

  if (!account) {
    return <div className="container-wide py-8">Connecte-toi pour accéder aux messages.</div>;
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/40 py-6">
      <div className="container-wide space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Messagerie KariGo</p>
            <h1 className="text-3xl font-semibold text-slate-900">Mes conversations</h1>
            <p className="text-sm text-slate-500">
              Discute avec les conducteurs ou passagers pour finaliser les détails d’un trajet.
            </p>
          </div>
          {notifications && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 flex items-center gap-3 shadow-sm">
              <Bell size={18} className="text-sky-500" />
              <span className="font-semibold text-slate-900">{notifications.unreadConversations}</span>
              conv. non lues /{' '}
              <span className="font-semibold text-slate-900">{notifications.unreadMessages}</span> messages
            </div>
          )}
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="grid gap-5 xl:grid-cols-[320px,minmax(0,1fr),300px]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Contacts</p>
                <p className="text-xs text-slate-400">{conversations.length} conversation(s)</p>
              </div>
              <button
                onClick={loadConversations}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
              >
                <RefreshCw size={14} />
                Sync
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="input pl-9 text-sm"
                placeholder="Rechercher un contact"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.currentTarget.value)}
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto pr-1 space-y-1">
              {loadingConversations && <p className="text-xs text-slate-400 px-1">Chargement…</p>}
              {!loadingConversations && filteredConversations.length === 0 && (
                <p className="text-sm text-slate-500 px-1">Aucun échange pour le moment.</p>
              )}
              {filteredConversations.map((conv) => {
                const label = conv.otherParticipant.label ?? conv.otherParticipant.id;
                const initials = getInitials(label);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                      conv.id === selectedConversationId ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 grid place-items-center font-semibold">
                        {initials || <UserCircle size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                          <span className="truncate">{label}</span>
                          {conv.unreadCount > 0 && (
                            <span className="rounded-full bg-sky-500 px-2 text-[11px] font-semibold text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {conv.lastMessagePreview ?? 'Aucun message'}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDate(conv.lastMessageAt)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <MailPlus size={14} />
                Nouveau message
              </div>
              <button
                type="button"
                onClick={() => setShowComposer((prev) => !prev)}
                className="w-full rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
              >
                {showComposer ? 'Fermer le formulaire' : 'Contact direct'}
              </button>
              {showComposer && (
                <div className="space-y-2">
                  {contactPrefill && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Prérempli pour{' '}
                      <span className="font-semibold text-slate-800">
                        {contactPrefill.label ?? contactPrefill.email ?? contactPrefill.id}
                      </span>
                    </div>
                  )}
                  <input
                    className="input text-sm"
                    placeholder="Email du destinataire"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.currentTarget.value)}
                  />
                  <textarea
                    className="input h-24 text-sm"
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
              )}
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[600px]">
            {selectedConversation ? (
              <>
                <header className="border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Discussion</p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedConversation.otherParticipant.label ?? selectedConversation.otherParticipant.id}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.otherParticipant.type === 'COMPANY'
                        ? 'Compte entreprise'
                        : 'Compte particulier'}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    Dernier message {formatDate(selectedConversation.lastMessageAt)}
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/40">
                  {loadingMessages && <div className="text-xs text-slate-400">Chargement des messages…</div>}
                  {messages.length === 0 && !loadingMessages && (
                    <div className="text-sm text-slate-500">
                      Commence la conversation avec un premier message.
                    </div>
                  )}
                  {messages.map((message) => {
                    const isMine = message.senderId === userId;
                    const status = message.status === 'READ';
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`rounded-2xl px-4 py-3 max-w-[75%] text-sm shadow-sm ${
                            isMine ? 'bg-sky-500 text-white' : 'bg-white text-slate-800 border border-slate-100'
                          }`}
                        >
                          <p className="whitespace-pre-line">{message.body}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] opacity-80 gap-4">
                            <span>{formatDate(message.createdAt)}</span>
                            {isMine && <CheckCheck size={14} className={status ? 'text-white' : 'text-white/60'} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <footer className="border-t border-slate-100 px-5 py-4 space-y-3">
                  {rideSummary && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Ajoute un extrait :</span>
                      <button
                        type="button"
                        onClick={() => handleInsertTemplate(buildRideTemplate(rideSummary))}
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        Trajet {rideSummary.originCity} → {rideSummary.destinationCity}
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <textarea
                      className="input flex-1 min-h-[64px]"
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
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-500 px-6 text-center">
                Sélectionne une conversation ou ouvre un nouveau message pour échanger avec un conducteur.
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            {selectedConversation ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedConversation.otherParticipant.label ?? selectedConversation.otherParticipant.id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedConversation.otherParticipant.type === 'COMPANY'
                      ? 'Professionnel'
                      : 'Particulier'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-2">
                  <p>
                    Dernier message le{' '}
                    <span className="font-semibold text-slate-800">
                      {formatDate(selectedConversation.lastMessageAt)}
                    </span>
                  </p>
                  <p>
                    Total messages:{' '}
                    <span className="font-semibold text-slate-800">
                      {selectedConversation.lastMessagePreview ? messages.length || '—' : '—'}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">
                Aucun contact sélectionné. Choisis un trajet pour afficher ses informations.
              </div>
            )}

            {rideSummary && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500 font-semibold">
                  <CarFront size={14} />
                  Trajet concerné
                </div>
                <div className="text-sm text-slate-700 font-semibold">
                  {rideSummary.originCity} → {rideSummary.destinationCity}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock size={14} />
                  {rideSummary.dateLabel} • {rideSummary.timeLabel}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <MapPin size={14} />
                  ID: {rideSummary.rideId.slice(0, 8).toUpperCase()}
                </div>
                <Link
                  to={`/ride/${rideSummary.rideId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                >
                  Ouvrir le détail
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {notifications && notifications.items.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                  <Bell size={14} className="text-sky-500" />
                  Derniers événements
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  {notifications.items.slice(0, 3).map((item) => (
                    <li key={item.id} className="text-xs">
                      <span className="font-semibold text-slate-800">
                        {item.sender?.label ?? 'Contact'}
                      </span>{' '}
                      - {item.preview ?? 'Nouveau message'} ({formatDate(item.createdAt)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
