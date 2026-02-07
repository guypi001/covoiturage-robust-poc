import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';
import { cancelBooking, createRating, getBookingRating, getRideBookings } from '../api/bff';
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
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingScores, setRatingScores] = useState({
    punctuality: 0,
    driving: 0,
    cleanliness: 0,
  });
  const [rideBookings, setRideBookings] = useState([]);
  const [rideBookingsBusy, setRideBookingsBusy] = useState(false);
  const [bookingRatings, setBookingRatings] = useState({});
  const [bookingScores, setBookingScores] = useState({});
  const rideId = ride?.rideId || ride?.id;

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = useMemo(
    () => computeLiveStatus(ride?.departureAt, isBooking ? item?.status : ride?.status),
    [ride?.departureAt, item?.status, ride?.status, isBooking, nowTick],
  );

  const showRating = isBooking && liveStatus === 'Termine' && item?.status !== 'CANCELLED';
  const ratingReady =
    ratingScores.punctuality > 0 &&
    ratingScores.driving > 0 &&
    ratingScores.cleanliness > 0;

  const isDriverView = !isBooking && account?.id && ride?.driverId === account.id;
  const canRatePassengers = isDriverView && ride?.status === 'CLOSED';

  const setPassengerScore = (bookingId, key, value) => {
    setBookingScores((prev) => ({
      ...prev,
      [bookingId]: { ...prev[bookingId], [key]: value },
    }));
  };

  const isPassengerRatingReady = (bookingId) => {
    const scores = bookingScores[bookingId];
    return scores?.punctuality > 0 && scores?.driving > 0 && scores?.cleanliness > 0;
  };

  const setScore = (key, value) => {
    setRatingScores((prev) => ({ ...prev, [key]: value }));
  };

  const renderStars = (value, onSelect) => (
    <View style={styles.ratingStars}>
      {Array.from({ length: 5 }).map((_, index) => {
        const score = index + 1;
        const active = score <= value;
        return (
          <Pressable key={`${index}`} onPress={() => onSelect(score)}>
            <Ionicons
              name={active ? 'star' : 'star-outline'}
              size={20}
              color={active ? colors.amber500 : colors.slate300}
            />
          </Pressable>
        );
      })}
    </View>
  );

  useEffect(() => {
    let active = true;
    if (!token || !isDriverView || !rideId) return;
    setRideBookingsBusy(true);
    getRideBookings(token, rideId)
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res?.data) ? res.data : res?.items || [];
        setRideBookings(items);
        return Promise.all(
          items.map((booking) =>
            getBookingRating(token, booking.id)
              .then((rating) => ({ bookingId: booking.id, rating }))
              .catch(() => ({ bookingId: booking.id, rating: null })),
          ),
        );
      })
      .then((results) => {
        if (!active || !results) return;
        const next = {};
        results.forEach(({ bookingId, rating }) => {
          if (rating?.id) next[bookingId] = true;
        });
        setBookingRatings(next);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRideBookingsBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token, isDriverView, rideId]);

  useEffect(() => {
    let active = true;
    if (!token || !item?.id || !isBooking) return;
    getBookingRating(token, item.id)
      .then((res) => {
        if (!active) return;
        if (res?.id) {
          setRatingSubmitted(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, item?.id, isBooking]);

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

      {isDriverView && (
        <SurfaceCard style={styles.card} delay={125}>
          <SectionHeader title="Passagers" icon="people-outline" />
          {rideBookingsBusy ? (
            <Text style={styles.helper}>Chargement des reservations...</Text>
          ) : null}
          {!rideBookingsBusy && rideBookings.length === 0 ? (
            <Text style={styles.helper}>Aucune reservation pour ce trajet.</Text>
          ) : null}
          {rideBookings.map((booking) => {
            const label =
              booking.passengerName ||
              booking.passengerEmail ||
              booking.passengerPhone ||
              'Passager';
            const rated = bookingRatings[booking.id];
            const scores = bookingScores[booking.id] || {};
            return (
              <View key={booking.id} style={styles.passengerCard}>
                <View style={styles.passengerHeader}>
                  <Text style={styles.passengerName}>{label}</Text>
                  <Text style={styles.passengerMeta}>
                    {booking.seats ? `${booking.seats} place(s)` : 'Reservation'}
                  </Text>
                </View>
                {canRatePassengers ? (
                  rated ? (
                    <Text style={styles.helper}>Note envoyee.</Text>
                  ) : (
                    <>
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Ponctualite</Text>
                        {renderStars(scores.punctuality || 0, (value) =>
                          setPassengerScore(booking.id, 'punctuality', value),
                        )}
                      </View>
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Conduite</Text>
                        {renderStars(scores.driving || 0, (value) =>
                          setPassengerScore(booking.id, 'driving', value),
                        )}
                      </View>
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Proprete</Text>
                        {renderStars(scores.cleanliness || 0, (value) =>
                          setPassengerScore(booking.id, 'cleanliness', value),
                        )}
                      </View>
                      <PrimaryButton
                        label="Noter ce passager"
                        variant="ghost"
                        onPress={async () => {
                          if (!token) return;
                          if (!isPassengerRatingReady(booking.id)) {
                            showToast('Complete toutes les notes.', 'error');
                            return;
                          }
                          setRatingBusy(true);
                          try {
                            await createRating(token, {
                              bookingId: booking.id,
                              raterRole: 'DRIVER',
                              ...bookingScores[booking.id],
                            });
                            setBookingRatings((prev) => ({ ...prev, [booking.id]: true }));
                            showToast('Note envoyee.', 'success');
                          } catch (err) {
                            showToast("Impossible d'envoyer la note.", 'error');
                          } finally {
                            setRatingBusy(false);
                          }
                        }}
                        disabled={ratingBusy}
                      />
                    </>
                  )
                ) : (
                  <Text style={styles.helper}>
                    La notation est disponible une fois le trajet termine.
                  </Text>
                )}
              </View>
            );
          })}
        </SurfaceCard>
      )}

      {showRating && (
        <SurfaceCard style={styles.card} delay={130}>
          <SectionHeader title="Noter le trajet" icon="star-outline" />
          {ratingSubmitted ? (
            <Text style={styles.helper}>Merci ! Ta note a deja ete envoyee.</Text>
          ) : (
            <>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Ponctualite</Text>
                {renderStars(ratingScores.punctuality, (value) => setScore('punctuality', value))}
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Conduite</Text>
                {renderStars(ratingScores.driving, (value) => setScore('driving', value))}
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Proprete</Text>
                {renderStars(ratingScores.cleanliness, (value) => setScore('cleanliness', value))}
              </View>
              <PrimaryButton
                label="Envoyer ma note"
                onPress={async () => {
                  if (!token || !item?.id) return;
                  if (!ratingReady) {
                    showToast('Complete toutes les notes.', 'error');
                    return;
                  }
                  setRatingBusy(true);
                  try {
                    await createRating(token, {
                      bookingId: item.id,
                      raterRole: 'PASSENGER',
                      ...ratingScores,
                    });
                    setRatingSubmitted(true);
                    showToast('Merci pour ta note.', 'success');
                  } catch (err) {
                    showToast("Impossible d'envoyer la note.", 'error');
                  } finally {
                    setRatingBusy(false);
                  }
                }}
                disabled={ratingBusy}
              />
            </>
          )}
        </SurfaceCard>
      )}

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
  helper: {
    fontSize: 13,
    color: colors.slate600,
  },
  ratingRow: {
    gap: 6,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 6,
  },
  passengerCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate900,
    flex: 1,
  },
  passengerMeta: {
    fontSize: 12,
    color: colors.slate500,
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
