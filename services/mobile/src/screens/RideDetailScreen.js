import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { InputField } from '../components/InputField';
import { getRide } from '../api/ride';
import { addPaymentMethod, capturePayment, createBooking, getMyPaymentMethods } from '../api/bff';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';
import { getDisplayName, getFirstName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';
import { CONFIG, resolveAssetUrl } from '../config';
import { createReport } from '../api/identity';
import { useSavedRides } from '../savedRides';
import { getConversations, sendMessage } from '../api/messaging';
import { RouteMiniMap } from '../components/RouteMiniMap';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { buildRegionForCoords, resolveCityCoords } from '../utils/geo';

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

const MOBILE_PROVIDERS = ['Orange Money', 'MTN Money', 'Moov Money'];
const CARD_PROVIDERS = ['VISA', 'MASTERCARD', 'CARTE'];

export function RideDetailScreen({ route }) {
  const navigation = useNavigation();
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const { toggleSavedRide, isSaved } = useSavedRides();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [thirdPartyEnabled, setThirdPartyEnabled] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyEmail, setThirdPartyEmail] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [seatsCount, setSeatsCount] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [useNewMethod, setUseNewMethod] = useState(false);
  const [newMethodType, setNewMethodType] = useState('MOBILE_MONEY');
  const [newMethodProvider, setNewMethodProvider] = useState('Orange Money');
  const [newMethodPhone, setNewMethodPhone] = useState('');
  const [newMethodLast4, setNewMethodLast4] = useState('');
  const [reportReason, setReportReason] = useState('Comportement inapproprie');
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const rideId = route?.params?.rideId;

  useEffect(() => {
    let active = true;
    const fetchRide = async () => {
      if (!rideId) return;
      setLoading(true);
      setError('');
      try {
        const data = await getRide(rideId);
        if (active) setRide(data);
      } catch (err) {
        if (active) setError('Impossible de charger le trajet.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchRide();
    return () => {
      active = false;
    };
  }, [rideId]);

  useEffect(() => {
    let active = true;
    const loadMethods = async () => {
      if (!paymentOpen || !token) return;
      try {
        const items = await getMyPaymentMethods(token);
        if (!active) return;
        const list = Array.isArray(items) ? items : [];
        setPaymentMethods(list);
        if (!list.length) {
          setUseNewMethod(true);
          setSelectedMethodId('');
        } else if (!selectedMethodId) {
          setSelectedMethodId(list[0]?.id || '');
        }
      } catch {
        if (active) setPaymentMethods([]);
      }
    };
    loadMethods();
    return () => {
      active = false;
    };
  }, [paymentOpen, token]);

  useEffect(() => {
    if (newMethodType === 'CARD') setNewMethodProvider(CARD_PROVIDERS[0]);
    if (newMethodType === 'MOBILE_MONEY') setNewMethodProvider(MOBILE_PROVIDERS[0]);
    if (newMethodType === 'CASH') setNewMethodProvider('CASH');
  }, [newMethodType]);

  const title = ride ? `${ride.originCity} → ${ride.destinationCity}` : 'Trajet';
  const departureLabel = ride?.departureAt
    ? new Date(ride.departureAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', month: 'short' })
    : '--';
  const priceLabel = ride?.pricePerSeat ? `${Number(ride.pricePerSeat).toLocaleString('fr-FR')} XOF` : '--';
  const seatsLabel = ride ? `${ride.seatsAvailable}/${ride.seatsTotal}` : '--';
  const driverLabel = getFirstName(ride?.driverLabel) || ride?.driverLabel || 'Conducteur KariGo';
  const shareUrl = rideId ? `${CONFIG.baseUrl}/ride/${rideId}` : CONFIG.baseUrl;
  const maxSeats = Math.max(1, Number(ride?.seatsAvailable) || 1);
  const totalAmount = (Number(ride?.pricePerSeat) || 0) * (Number(seatsCount) || 1);
  const originCoord = resolveCityCoords(ride?.originCity || ride?.origin);
  const destinationCoord = resolveCityCoords(ride?.destinationCity || ride?.destination);
  const mapRegion = buildRegionForCoords(originCoord, destinationCoord);

  const savedRide = ride
    ? {
        rideId: rideId,
        originCity: ride.originCity,
        destinationCity: ride.destinationCity,
        departureAt: ride.departureAt,
        pricePerSeat: Number(ride.pricePerSeat || 0),
        seatsAvailable: Number(ride.seatsAvailable || 0),
        driverLabel: ride.driverLabel || null,
      }
    : null;

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

  const handleOpenMap = async () => {
    const origin = ride?.originCity || ride?.origin || '';
    const destination = ride?.destinationCity || ride?.destination || '';
    if (!origin || !destination) {
      showToast('Itineraire indisponible.', 'error');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin,
    )}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast('Impossible d’ouvrir la carte.', 'error');
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
    } catch {
      showToast('Signalement impossible.', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const handleContact = async () => {
    if (!token || !account?.id) {
      showToast('Connecte-toi pour contacter.', 'error');
      return;
    }
    if (!ride?.driverId) {
      showToast('Contact indisponible pour ce trajet.', 'error');
      return;
    }
    try {
      const existing = await getConversations(account.id);
      const conversation = Array.isArray(existing)
        ? existing.find((item) => item?.otherParticipant?.id === ride.driverId)
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
        recipientId: ride.driverId,
        recipientType: ride.driverType || 'INDIVIDUAL',
        recipientLabel: ride.driverLabel || driverLabel,
        body: `Bonjour, je souhaite des infos sur le trajet ${ride?.originCity || ''} → ${
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
    } catch {
      showToast('Impossible d’ouvrir la conversation.', 'error');
    }
  };

  const handlePaymentConfirm = async () => {
    if (!token || !account?.id) {
      showToast('Connecte-toi pour reserver.', 'error');
      return;
    }
    if (!rideId) return;
    if (thirdPartyEnabled && !thirdPartyName.trim()) {
      showToast('Nom du passager requis.', 'error');
      return;
    }
    if (!seatsCount || seatsCount < 1 || seatsCount > maxSeats) {
      showToast('Nombre de places invalide.', 'error');
      return;
    }

    setPaymentBusy(true);
    try {
      if (!useNewMethod && paymentMethods.length && !selectedMethodId) {
        showToast('Selectionne un moyen de paiement.', 'error');
        setPaymentBusy(false);
        return;
      }
      let method = null;
      let paymentMethodType = 'CASH';
      let paymentProvider = 'CASH';
      let paymentMethodId = undefined;

      if (useNewMethod) {
        if (newMethodType === 'MOBILE_MONEY') {
          if (!newMethodPhone.trim()) {
            showToast('Numero Mobile Money requis.', 'error');
            setPaymentBusy(false);
            return;
          }
          const created = await addPaymentMethod(token, {
            type: 'MOBILE_MONEY',
            provider: newMethodProvider,
            phoneNumber: newMethodPhone.trim(),
            label: newMethodProvider,
          });
          method = created;
        } else if (newMethodType === 'CARD') {
          if (!newMethodLast4.trim()) {
            showToast('Les 4 derniers chiffres sont requis.', 'error');
            setPaymentBusy(false);
            return;
          }
          const created = await addPaymentMethod(token, {
            type: 'CARD',
            provider: newMethodProvider,
            last4: newMethodLast4.trim(),
            label: `Carte ${newMethodProvider}`,
          });
          method = created;
        }
      } else if (selectedMethodId) {
        method = paymentMethods.find((item) => item.id === selectedMethodId) || null;
      }

      if (method) {
        paymentMethodType = method.type || 'MOBILE_MONEY';
        paymentProvider =
          method.provider ||
          (paymentMethodType === 'CARD' ? 'VISA' : paymentMethodType === 'CASH' ? 'CASH' : 'Orange Money');
        paymentMethodId = method.id;
      } else if (useNewMethod && newMethodType === 'CASH') {
        paymentMethodType = 'CASH';
        paymentProvider = 'CASH';
      }

      const saved = await createBooking(token, {
        rideId,
        seats: seatsCount,
        passengerName: thirdPartyEnabled ? thirdPartyName.trim() : undefined,
        passengerEmail: thirdPartyEnabled ? thirdPartyEmail.trim() || undefined : undefined,
        passengerPhone: thirdPartyEnabled ? thirdPartyPhone.trim() || undefined : undefined,
      });

      const bookingAmount = Number(saved?.amount || totalAmount || 0);
      await capturePayment(token, {
        bookingId: saved.id,
        amount: bookingAmount,
        paymentMethodType,
        paymentMethodId,
        paymentProvider,
        idempotencyKey: `mobile-${saved.id}-${account.id}`,
      });

      const reference = saved?.referenceCode || saved?.id || 'confirmée';
      setBookingStatus(`Reservation ${reference} payee.`);
      showToast('Paiement confirme.', 'success');
      setPaymentOpen(false);
    } catch (err) {
      setBookingStatus('');
      showToast('Paiement impossible. Reessaie.', 'error');
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={text.title}>{title}</Text>
        <View style={styles.titleActions}>
          {ride ? (
            <Pressable
              onPress={() => savedRide && toggleSavedRide(savedRide)}
              style={styles.saveButton}
              accessibilityLabel={isSaved(rideId) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Ionicons
                name={isSaved(rideId) ? 'heart' : 'heart-outline'}
                size={18}
                color={isSaved(rideId) ? colors.rose500 : colors.slate500}
              />
            </Pressable>
          ) : null}
          {ride?.liveTrackingEnabled ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>Suivi en direct</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={text.subtitle}>Depart {departureLabel} · {seatsLabel} places</Text>

      {loading && (
        <SurfaceCard style={styles.loadingCard} tone="soft" delay={60}>
          <ActivityIndicator color={colors.sky600} />
          <Text style={styles.loadingText}>Chargement du trajet...</Text>
        </SurfaceCard>
      )}

      {error ? <Banner tone="error" message={error} /> : null}

      {loading ? (
        <View style={styles.skeletonStack}>
          <SurfaceCard style={styles.mapPlaceholder} tone="accent" animated={false}>
            <SkeletonBlock width="55%" height={14} />
          </SurfaceCard>
          <View style={styles.cardRow}>
            <SurfaceCard style={styles.statCard} tone="soft" animated={false}>
              <SkeletonBlock width="40%" height={10} />
              <SkeletonBlock width="60%" height={18} />
              <SkeletonBlock width="30%" height={10} />
            </SurfaceCard>
            <SurfaceCard style={styles.statCard} tone="soft" animated={false}>
              <SkeletonBlock width="40%" height={10} />
              <SkeletonBlock width="60%" height={18} />
              <SkeletonBlock width="30%" height={10} />
            </SurfaceCard>
          </View>
          <SurfaceCard style={styles.card} animated={false}>
            <SkeletonBlock width="35%" height={12} />
            <SkeletonBlock width="60%" height={12} />
            <SkeletonBlock width="50%" height={12} />
          </SurfaceCard>
          <SurfaceCard style={styles.card} animated={false}>
            <SkeletonBlock width="45%" height={12} />
            <SkeletonBlock width="70%" height={12} />
          </SurfaceCard>
        </View>
      ) : (
        <>
          <SurfaceCard style={styles.mapCard} tone="soft" delay={90}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Apercu du trajet</Text>
              <Pressable onPress={handleOpenMap} style={styles.mapAction}>
                <Ionicons name="map-outline" size={14} color={colors.slate700} />
                <Text style={styles.mapActionText}>Ouvrir</Text>
              </Pressable>
            </View>
            <View style={styles.mapWrapper}>
              <MapView
                key={`${rideId}-map`}
                style={styles.mapView}
                initialRegion={mapRegion}
                loadingEnabled
                toolbarEnabled={false}
              >
                {originCoord ? (
                  <Marker coordinate={originCoord} title="Depart" description={ride?.originCity || ''} />
                ) : null}
                {destinationCoord ? (
                  <Marker
                    coordinate={destinationCoord}
                    pinColor={colors.emerald500}
                    title="Arrivee"
                    description={ride?.destinationCity || ''}
                  />
                ) : null}
                {originCoord && destinationCoord ? (
                  <Polyline
                    coordinates={[originCoord, destinationCoord]}
                    strokeColor={colors.sky600}
                    strokeWidth={3}
                  />
                ) : null}
              </MapView>
              {!originCoord || !destinationCoord ? (
                <View style={styles.mapOverlay}>
                  <Text style={styles.mapOverlayText}>
                    Coordonnees indisponibles, affichage approximatif.
                  </Text>
                </View>
              ) : null}
            </View>
            <RouteMiniMap
              origin={ride?.originCity || ride?.origin}
              destination={ride?.destinationCity || ride?.destination}
            />
          </SurfaceCard>

          <View style={styles.cardRow}>
            <SurfaceCard style={styles.statCard} tone="soft" delay={120}>
              <Text style={styles.statLabel}>Prix</Text>
              <Text style={styles.statValue}>{priceLabel}</Text>
              <Text style={styles.statMeta}>par siege</Text>
            </SurfaceCard>
            <SurfaceCard style={styles.statCard} tone="soft" delay={150}>
              <Text style={styles.statLabel}>Places</Text>
              <Text style={styles.statValue}>{ride?.seatsAvailable ?? '--'}</Text>
              <Text style={styles.statMeta}>disponibles</Text>
            </SurfaceCard>
          </View>

          <SurfaceCard style={styles.card} delay={180}>
            <SectionHeader title="Conducteur" icon="person-outline" />
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                {ride?.driverPhotoUrl ? (
                  <Image source={{ uri: resolveAssetUrl(ride.driverPhotoUrl) }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{driverLabel.charAt(0) || 'K'}</Text>
                )}
              </View>
              <View>
                <Text style={styles.driverName}>{driverLabel}</Text>
                <Text style={styles.driverMeta}>Profil verifie · Support KariGo</Text>
              </View>
            </View>
            {ride?.driverId ? (
              <PrimaryButton
                label="Voir le profil"
                variant="ghost"
                onPress={() => navigation.navigate('PublicProfile', { accountId: ride.driverId })}
              />
            ) : null}
          </SurfaceCard>

          <SurfaceCard style={styles.card} delay={210}>
            <SectionHeader title="Suivi en direct" icon="radio-outline" />
            <Text style={styles.infoValue}>
              {ride?.liveTrackingEnabled ? 'Actif 15 min avant le depart' : 'Non active par le chauffeur'}
            </Text>
            <Text style={styles.infoHint}>Disponible jusqu'a l'arrivee. Notification des grandes villes.</Text>
          </SurfaceCard>

          <SurfaceCard style={styles.card} delay={240}>
            <SectionHeader title="Actions rapides" icon="flash-outline" />
            <PrimaryButton label="Partager" variant="ghost" onPress={handleShare} />
            <PrimaryButton label="Ajouter au calendrier" variant="ghost" onPress={handleCalendar} />
          </SurfaceCard>

          <SurfaceCard style={styles.card} delay={260}>
            <SectionHeader title="Reservation pour un proche" icon="people-outline" />
            <View style={styles.toggleRow}>
              <Text style={styles.helperText}>Activer pour reserver a un tiers.</Text>
              <Pressable
                onPress={() => setThirdPartyEnabled((prev) => !prev)}
                style={[styles.toggleButton, thirdPartyEnabled && styles.toggleButtonActive]}
              >
                <Text style={[styles.toggleText, thirdPartyEnabled && styles.toggleTextActive]}>
                  {thirdPartyEnabled ? 'Active' : 'Desactive'}
                </Text>
              </Pressable>
            </View>
            {thirdPartyEnabled ? (
              <View style={styles.thirdPartyForm}>
                <InputField
                  label="Nom du passager"
                  value={thirdPartyName}
                  onChangeText={setThirdPartyName}
                  placeholder="Ex: Konan Aya"
                />
                <InputField
                  label="Email (optionnel)"
                  value={thirdPartyEmail}
                  onChangeText={setThirdPartyEmail}
                  placeholder="passager@email.com"
                  keyboardType="email-address"
                />
                <InputField
                  label="Telephone (optionnel)"
                  value={thirdPartyPhone}
                  onChangeText={setThirdPartyPhone}
                  placeholder="+225 01 23 45 67 89"
                  keyboardType="phone-pad"
                />
              </View>
            ) : null}
          </SurfaceCard>
        </>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          label="Reserver"
          onPress={async () => {
            if (!token) {
              showToast('Connecte-toi pour reserver.', 'error');
              return;
            }
            if (!rideId) return;
            setPaymentOpen(true);
          }}
        />
        <PrimaryButton label="Contacter" variant="ghost" onPress={handleContact} />
      </View>
      {bookingStatus ? <Banner tone="success" message={bookingStatus} /> : null}

      <SurfaceCard style={styles.card} delay={260}>
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

      <Modal transparent visible={paymentOpen} animationType="slide" onRequestClose={() => setPaymentOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Paiement</Text>
            <Text style={styles.modalSubtitle}>Choisis le nombre de places et ton moyen de paiement.</Text>

            <View style={styles.stepperRow}>
              <Pressable
                style={[styles.stepperButton, seatsCount <= 1 && styles.stepperButtonDisabled]}
                disabled={seatsCount <= 1}
                onPress={() => setSeatsCount((prev) => Math.max(1, prev - 1))}
              >
                <Text style={styles.stepperText}>-</Text>
              </Pressable>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperNumber}>{seatsCount}</Text>
                <Text style={styles.stepperLabel}>places</Text>
              </View>
              <Pressable
                style={[styles.stepperButton, seatsCount >= maxSeats && styles.stepperButtonDisabled]}
                disabled={seatsCount >= maxSeats}
                onPress={() => setSeatsCount((prev) => Math.min(maxSeats, prev + 1))}
              >
                <Text style={styles.stepperText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total a payer</Text>
              <Text style={styles.amountValue}>{totalAmount.toLocaleString('fr-FR')} XOF</Text>
            </View>

            <View style={styles.methodTabs}>
              <Pressable
                style={[styles.methodTab, !useNewMethod && styles.methodTabActive]}
                onPress={() => setUseNewMethod(false)}
              >
                <Text style={[styles.methodTabText, !useNewMethod && styles.methodTabTextActive]}>
                  Mes moyens
                </Text>
              </Pressable>
              <Pressable
                style={[styles.methodTab, useNewMethod && styles.methodTabActive]}
                onPress={() => setUseNewMethod(true)}
              >
                <Text style={[styles.methodTabText, useNewMethod && styles.methodTabTextActive]}>
                  Nouveau
                </Text>
              </Pressable>
            </View>

            {!useNewMethod ? (
              <View style={styles.methodList}>
                {paymentMethods.length === 0 ? (
                  <Text style={styles.helperText}>Aucun moyen enregistre.</Text>
                ) : null}
                {paymentMethods.map((method) => {
                  const active = selectedMethodId === method.id;
                  const label = method.label || method.provider || method.type;
                  return (
                    <Pressable
                      key={method.id}
                      onPress={() => setSelectedMethodId(method.id)}
                      style={[styles.methodItem, active && styles.methodItemActive]}
                    >
                      <Text style={[styles.methodItemTitle, active && styles.methodItemTitleActive]}>
                        {label}
                      </Text>
                      <Text style={styles.methodItemMeta}>
                        {method.type === 'CARD' && method.last4 ? `**** ${method.last4}` : method.type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.methodForm}>
                <View style={styles.methodTypeRow}>
                  {['MOBILE_MONEY', 'CARD', 'CASH'].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setNewMethodType(value)}
                      style={[styles.methodChip, newMethodType === value && styles.methodChipActive]}
                    >
                      <Text style={[styles.methodChipText, newMethodType === value && styles.methodChipTextActive]}>
                        {value === 'MOBILE_MONEY' ? 'Mobile Money' : value === 'CARD' ? 'Carte' : 'Cash'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {newMethodType === 'MOBILE_MONEY' ? (
                  <>
                    <View style={styles.methodTypeRow}>
                      {MOBILE_PROVIDERS.map((provider) => (
                        <Pressable
                          key={provider}
                          onPress={() => setNewMethodProvider(provider)}
                          style={[
                            styles.methodChip,
                            newMethodProvider === provider && styles.methodChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.methodChipText,
                              newMethodProvider === provider && styles.methodChipTextActive,
                            ]}
                          >
                            {provider}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <InputField
                      label="Numero Mobile Money"
                      value={newMethodPhone}
                      onChangeText={setNewMethodPhone}
                      keyboardType="phone-pad"
                      placeholder="+225 01 23 45 67 89"
                    />
                  </>
                ) : null}

                {newMethodType === 'CARD' ? (
                  <>
                    <View style={styles.methodTypeRow}>
                      {CARD_PROVIDERS.map((provider) => (
                        <Pressable
                          key={provider}
                          onPress={() => setNewMethodProvider(provider)}
                          style={[
                            styles.methodChip,
                            newMethodProvider === provider && styles.methodChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.methodChipText,
                              newMethodProvider === provider && styles.methodChipTextActive,
                            ]}
                          >
                            {provider}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <InputField
                      label="4 derniers chiffres"
                      value={newMethodLast4}
                      onChangeText={setNewMethodLast4}
                      keyboardType="number-pad"
                      placeholder="1234"
                    />
                  </>
                ) : null}

                {newMethodType === 'CASH' ? (
                  <Text style={styles.helperText}>Tu regleras sur place.</Text>
                ) : null}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setPaymentOpen(false)}>
                <Text style={styles.modalGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, paymentBusy && styles.modalPrimaryDisabled]}
                disabled={paymentBusy}
                onPress={handlePaymentConfirm}
              >
                <Text style={styles.modalPrimaryText}>
                  {paymentBusy ? 'Paiement...' : 'Payer et confirmer'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  liveBadge: {
    backgroundColor: colors.emerald100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald500,
    textTransform: 'uppercase',
  },
  mapCard: {
    gap: spacing.sm,
  },
  mapWrapper: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
  },
  mapView: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  mapOverlayText: {
    fontSize: 11,
    color: colors.white,
    textAlign: 'center',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  mapAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  mapActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
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
  errorCard: {
    backgroundColor: '#fee2e2',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
    marginTop: 6,
  },
  statMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  card: {
    gap: spacing.sm,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.sky600,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  driverMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  infoValue: {
    color: colors.slate900,
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 12,
    color: colors.slate500,
  },
  helperText: {
    fontSize: 12,
    color: colors.slate600,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
  },
  toggleButtonActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  toggleTextActive: {
    color: colors.sky600,
  },
  thirdPartyForm: {
    marginTop: spacing.sm,
    gap: spacing.sm,
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
  actions: {
    gap: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.md,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.slate600,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate700,
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate900,
  },
  stepperLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  methodTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  methodTabActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  methodTabTextActive: {
    color: colors.sky700,
  },
  methodList: {
    gap: spacing.sm,
  },
  methodItem: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
  },
  methodItemActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.sky50,
  },
  methodItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate900,
  },
  methodItemTitleActive: {
    color: colors.sky700,
  },
  methodItemMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
  methodForm: {
    gap: spacing.sm,
  },
  methodTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  methodChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.sky100,
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  methodChipTextActive: {
    color: colors.sky700,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  modalPrimary: {
    flex: 2,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.slate900,
  },
  modalPrimaryDisabled: {
    opacity: 0.7,
  },
  modalPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  skeletonStack: {
    gap: spacing.md,
  },
});
