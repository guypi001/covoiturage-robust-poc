import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../auth';
import { cancelBooking } from '../api/bff';
import { useToast } from '../ui/ToastContext';
import { useModal } from '../ui/ModalContext';

const statusLabels = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

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
  if (status === 'CANCELLED') return 'Annulé';
  if (!departureAt) return 'En attente';
  const ts = Date.parse(departureAt);
  if (!Number.isFinite(ts)) return 'En attente';
  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return 'A venir';
  if (now - ts <= 3 * 60 * 60 * 1000) return 'En cours';
  return 'Termine';
};

export function TripDetailScreen({ navigation, route }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const [busy, setBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const { type, item } = route.params || {};
  const ride = item?.ride || item;
  const isBooking = type === 'booking';
  const bookingStatus = isBooking ? statusLabels[item?.status] || item?.status : null;

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = useMemo(
    () => computeLiveStatus(ride?.departureAt, isBooking ? item?.status : ride?.status),
    [ride?.departureAt, item?.status, ride?.status, isBooking, nowTick],
  );

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Details du trajet</Text>
      <Text style={text.subtitle}>Retrouve toutes les informations utiles.</Text>

      <View style={styles.card}>
        <Text style={styles.route}>
          {ride?.originCity || ride?.origin || 'Depart'} → {ride?.destinationCity || ride?.destination || 'Arrivee'}
        </Text>
        <Text style={styles.meta}>Depart: {formatDate(ride?.departureAt)}</Text>
        <Text style={styles.meta}>Statut temps reel: {liveStatus}</Text>
        {isBooking ? <Text style={styles.meta}>Reservation: {bookingStatus}</Text> : null}
        {ride?.seatsAvailable != null ? (
          <Text style={styles.meta}>Places restantes: {ride.seatsAvailable}</Text>
        ) : null}
        {ride?.pricePerSeat != null ? (
          <Text style={styles.meta}>Prix par place: {ride.pricePerSeat} XOF</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <PrimaryButton
          label="Contacter"
          variant="ghost"
          onPress={() => navigation.navigate('Tabs', { screen: 'MessagesTab' })}
        />
        {isBooking && item?.status !== 'CANCELLED' ? (
          <PrimaryButton label="Annuler ma reservation" onPress={handleCancel} disabled={busy} />
        ) : null}
      </View>
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
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
});
