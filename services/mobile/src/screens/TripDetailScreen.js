import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';
import { cancelBooking } from '../api/bff';
import { useToast } from '../ui/ToastContext';
import { useModal } from '../ui/ModalContext';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { formatBookingStatus, formatPaymentStatus } from '../utils/status';
import { createReport } from '../api/identity';
import { CONFIG } from '../config';
import { getConversations, sendMessage } from '../api/messaging';
import { getDisplayName } from '../utils/name';

const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const computeLiveStatus = (departureAt, status) => {
  if (status === 'CANCELLED' || status === 'CANCELED') return 'Annulé';
  if (!departureAt) return 'En attente';
  const ts = Date.parse(departureAt);
  if (!Number.isFinite(ts)) return 'En attente';
  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return 'A venir';
  if (now - ts <= 3 * 60 * 60 * 1000) return 'En cours';
  return 'Termine';
};

const toCalendarDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const addHours = (value, hours = 2) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export function TripDetailScreen({ navigation, route }) {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const { type, item } = route.params || {};
  const ride = item?.ride || item;
  const isBooking = type === 'booking';
  const bookingStatus = isBooking ? formatBookingStatus(item?.status) : null;
  const paymentStatus = isBooking ? formatPaymentStatus(item?.paymentStatus) : null;
  const [reportReason, setReportReason] = useState('Comportement inapproprie');
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const rideId = ride?.rideId || ride?.id;

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = useMemo(
    () => computeLiveStatus(ride?.departureAt, isBooking ? item?.status : ride?.status),
    [ride?.departureAt, item?.status, ride?.status, isBooking, nowTick],
  );

  const timelineSteps = useMemo(() => {
    const steps = [
      { id: 'created', label: 'Cree', time: item?.createdAt || ride?.createdAt },
      { id: 'departure', label: 'Depart', time: ride?.departureAt },
      { id: 'arrival', label: 'Arrivee estimee', time: addHours(ride?.departureAt, 2) },
    ];
    const now = Date.now();
    return steps.map((step) => {
      const ts = step.time ? Date.parse(step.time) : Number.NaN;
      return { ...step, done: Number.isFinite(ts) ? ts < now : false };
    });
  }, [item?.createdAt, ride?.createdAt, ride?.departureAt, nowTick]);

  const shareUrl = rideId ? `${CONFIG.baseUrl}/ride/${rideId}` : CONFIG.baseUrl;
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Trajet KariGo: ${ride?.originCity || ''} → ${ride?.destinationCity || ''}\n${shareUrl}`,
      });
    } catch {
      // ignore share errors
    }
  };

  const handleCalendar = async () => {
    if (!ride?.departureAt) return;
    const start = toCalendarDate(ride.departureAt);
    const end = toCalendarDate(addHours(ride.departureAt, 2));
    const title = encodeURIComponent(`Trajet KariGo ${ride.originCity || ''} → ${ride.destinationCity || ''}`);
    const details = encodeURIComponent('Trajet KariGo - ajoute automatiquement');
    const location = encodeURIComponent(`${ride.originCity || ''} → ${ride.destinationCity || ''}`);
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${start}/${end}`;
    try {
      await Linking.openURL(calendarUrl);
    } catch {
      showToast('Impossible d’ouvrir le calendrier.', 'error');
    }
  };

  const handleReprogram = async () => {
    if (!ride?.originCity || !ride?.destinationCity || !ride?.departureAt) return;
    const date = new Date(ride.departureAt);
    const dateStr = date.toLocaleDateString('fr-CA');
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const url = `${CONFIG.baseUrl}/create?from=${encodeURIComponent(ride.originCity)}&to=${encodeURIComponent(
      ride.destinationCity,
    )}&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&price=${encodeURIComponent(
      String(ride.pricePerSeat || ''),
    )}&seats=${encodeURIComponent(String(ride.seatsTotal || ''))}`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast('Impossible d’ouvrir la page de reprogrammation.', 'error');
    }
  };

  const handleReport = async () => {
    if (!token) {
      showToast('Connecte-toi pour signaler.', 'error');
      return;
    }
    if (!rideId) return;
    setReportBusy(true);
    try {
      await createReport(token, {
        targetRideId: rideId,
        category: 'RIDE',
        reason: reportReason,
        message: reportMessage || undefined,
      });
      showToast('Signalement envoye.', 'success');
      setReportMessage('');
    } catch (err) {
      showToast('Signalement impossible.', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const handleCancel = () => {
    if (!token || !item?.id) return;
    showModal({
      title: 'Annuler la reservation',
      message: 'Confirme l’annulation. Cette action est definitive.',
      confirmLabel: 'Annuler',
      onConfirm: async () => {
        try {
          setBusy(true);
          await cancelBooking(token, item.id);
          showToast('Reservation annulee.', 'success');
          navigation.goBack();
        } catch (err) {
          showToast('Annulation impossible.', 'error');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const resolveContact = () => {
    if (isBooking) {
      return {
        id: ride?.driverId,
        type: ride?.driverType || 'INDIVIDUAL',
        label: ride?.driverLabel,
      };
    }
    return null;
  };

  const handleContact = async () => {
    if (!token || !account?.id) {
      showToast('Connecte-toi pour contacter.', 'error');
      navigation.navigate('Tabs', { screen: 'Profile' });
      return;
    }
    const target = resolveContact();
    if (!target?.id) {
      showToast('Contact indisponible pour ce trajet.', 'error');
      return;
    }
    setContactBusy(true);
    try {
      const existing = await getConversations(account.id);
      const conversation = Array.isArray(existing)
        ? existing.find((item) => item?.otherParticipant?.id === target.id)
        : null;
      if (conversation?.id) {
        navigation.navigate('Conversation', {
          conversationId: conversation.id,
          otherParticipant: conversation.otherParticipant,
        });
        return;
      }
      const payload = await sendMessage({
        senderId: account.id,
        senderType: account.type || 'INDIVIDUAL',
        senderLabel: getDisplayName(account),
        recipientId: target.id,
        recipientType: target.type || 'INDIVIDUAL',
        recipientLabel: target.label,
        body: `Bonjour, je vous contacte a propos du trajet ${ride?.originCity || ''} → ${
          ride?.destinationCity || ''
        }.`,
      });
      if (payload?.conversation?.id) {
        navigation.navigate('Conversation', {
          conversationId: payload.conversation.id,
          otherParticipant: payload.conversation.otherParticipant,
        });
      } else {
        navigation.navigate('Messages');
      }
    } catch (err) {
      showToast('Impossible d’ouvrir la conversation.', 'error');
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Details du trajet</Text>
      <Text style={text.subtitle}>Retrouve toutes les informations utiles.</Text>

      <SurfaceCard style={styles.card} delay={80}>
        <Text style={styles.route}>
          {ride?.originCity || ride?.origin || 'Depart'} → {ride?.destinationCity || ride?.destination || 'Arrivee'}
        </Text>
        <Text style={styles.meta}>Depart: {formatDate(ride?.departureAt)}</Text>
        <Text style={styles.meta}>Statut temps reel: {liveStatus}</Text>
        {isBooking ? <Text style={styles.meta}>Reservation: {bookingStatus}</Text> : null}
        {isBooking && item?.paymentStatus ? (
          <Text style={styles.meta}>Paiement: {paymentStatus}</Text>
        ) : null}
        {ride?.seatsAvailable != null ? (
          <Text style={styles.meta}>Places restantes: {ride.seatsAvailable}</Text>
        ) : null}
        {ride?.pricePerSeat != null ? (
          <Text style={styles.meta}>Prix par place: {ride.pricePerSeat} XOF</Text>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card} delay={100}>
        <SectionHeader title="Timeline" icon="time-outline" />
        <View style={styles.timeline}>
          {timelineSteps.map((step) => (
            <View key={step.id} style={styles.timelineRow}>
              <View style={[styles.timelineDot, step.done && styles.timelineDotDone]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{step.label}</Text>
                {step.time ? <Text style={styles.timelineMeta}>{formatDate(step.time)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} delay={120}>
        <SectionHeader title="Actions rapides" icon="flash-outline" />
        <PrimaryButton
          label="Contacter"
          variant="ghost"
          onPress={handleContact}
          disabled={contactBusy}
        />
        <PrimaryButton label="Partager" variant="ghost" onPress={handleShare} />
        <PrimaryButton label="Ajouter au calendrier" variant="ghost" onPress={handleCalendar} />
        {!isBooking ? <PrimaryButton label="Reprogrammer" variant="ghost" onPress={handleReprogram} /> : null}
        {isBooking && item?.status !== 'CANCELLED' ? (
          <PrimaryButton label="Annuler ma reservation" onPress={handleCancel} disabled={busy} />
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card} delay={140}>
        <SectionHeader title="Signalement" icon="alert-circle-outline" />
        <View style={styles.reasonRow}>
          {['Comportement inapproprie', 'Informations trompeuses', 'Tarif abusif', 'Autre'].map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setReportReason(reason)}
              style={[styles.reasonChip, reportReason === reason && styles.reasonChipActive]}
            >
              <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextActive]}>{reason}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={reportMessage}
          onChangeText={setReportMessage}
          placeholder="Ajoute des details si besoin."
          placeholderTextColor={colors.slate400}
          style={styles.reportInput}
          multiline
        />
        <PrimaryButton label="Envoyer le signalement" onPress={handleReport} disabled={reportBusy} />
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
    gap: spacing.sm,
  },
  route: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  meta: {
    fontSize: 13,
    color: colors.slate600,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.slate300,
    marginTop: 6,
  },
  timelineDotDone: {
    borderColor: colors.emerald500,
    backgroundColor: colors.emerald100,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate800,
  },
  timelineMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
  },
  reasonChipActive: {
    borderColor: colors.rose600,
    backgroundColor: colors.rose100,
  },
  reasonText: {
    fontSize: 12,
    color: colors.slate600,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: colors.rose600,
  },
  reportInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13,
    color: colors.slate800,
    backgroundColor: colors.white,
  },
});
