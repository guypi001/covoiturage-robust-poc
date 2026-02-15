import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionHeader } from '../components/SectionHeader';
import { SurfaceCard } from '../components/SurfaceCard';
import { Banner } from '../components/Banner';
import { useAuth } from '../auth';
import { createRide } from '../api/bff';
import { useToast } from '../ui/ToastContext';
import { colors, radius, spacing, text } from '../theme';

const ROUTE_TEMPLATES = [
  { id: 'abj-yam', originCity: 'Abidjan', destinationCity: 'Yamoussoukro', pricePerSeat: 2000, seatsTotal: 3 },
  { id: 'abj-bke', originCity: 'Abidjan', destinationCity: 'Bouake', pricePerSeat: 2500, seatsTotal: 3 },
  { id: 'bke-kgo', originCity: 'Bouake', destinationCity: 'Korhogo', pricePerSeat: 3500, seatsTotal: 3 },
];

const PRICE_PRESETS = [1500, 2000, 2500, 3000, 4000, 5000];
const SEAT_PRESETS = [1, 2, 3, 4, 5, 6];

const toInputDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toInputTime = (value) => {
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

const roundToNextQuarter = (value) => {
  const date = new Date(value);
  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  date.setMinutes(rounded);
  return date;
};

const getDefaultDeparture = () => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const rounded = roundToNextQuarter(now);
  return {
    date: toInputDate(rounded),
    time: toInputTime(rounded),
  };
};

const normalizeRoute = (value) => value.trim().toLowerCase();

const buildIsoDeparture = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return '';
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XOF`;

export function CreateRideScreen({ navigation, route }) {
  const { token, account } = useAuth();
  const { showToast } = useToast();
  const defaults = useMemo(() => getDefaultDeparture(), []);
  const prefill = route?.params?.prefill || {};
  const [originCity, setOriginCity] = useState(prefill.originCity || 'Abidjan');
  const [destinationCity, setDestinationCity] = useState(prefill.destinationCity || 'Yamoussoukro');
  const [date, setDate] = useState(prefill.date || defaults.date);
  const [time, setTime] = useState(prefill.time || defaults.time);
  const [pricePerSeat, setPricePerSeat] = useState(String(prefill.pricePerSeat || 2000));
  const [seatsTotal, setSeatsTotal] = useState(String(prefill.seatsTotal || 3));
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(account?.type === 'COMPANY');
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCompany = account?.type === 'COMPANY';
  const departureAt = buildIsoDeparture(date, time);
  const estimatedRevenue = (Number(pricePerSeat) || 0) * (Number(seatsTotal) || 0);

  const applyTemplate = (template) => {
    setOriginCity(template.originCity);
    setDestinationCity(template.destinationCity);
    setPricePerSeat(String(template.pricePerSeat));
    setSeatsTotal(String(template.seatsTotal));
    setErrors((prev) => ({ ...prev, originCity: '', destinationCity: '', route: '' }));
  };

  const swapRoute = () => {
    setOriginCity(destinationCity);
    setDestinationCity(originCity);
    setErrors((prev) => ({ ...prev, originCity: '', destinationCity: '', route: '' }));
  };

  const applyDeparture = (targetDate) => {
    const rounded = roundToNextQuarter(targetDate);
    setDate(toInputDate(rounded));
    setTime(toInputTime(rounded));
    setErrors((prev) => ({ ...prev, date: '', time: '', departureAt: '' }));
  };

  const validate = () => {
    const next = {};
    if (!originCity.trim()) next.originCity = 'Ville de depart requise.';
    if (!destinationCity.trim()) next.destinationCity = "Ville d'arrivee requise.";
    if (
      originCity.trim() &&
      destinationCity.trim() &&
      normalizeRoute(originCity) === normalizeRoute(destinationCity)
    ) {
      next.route = "Le depart et l'arrivee doivent etre differents.";
    }
    if (!date) next.date = 'Date requise.';
    if (!time) next.time = 'Heure requise.';
    if (!departureAt) {
      next.departureAt = 'Date/heure invalide.';
    } else if (Date.parse(departureAt) <= Date.now() + 5 * 60 * 1000) {
      next.departureAt = 'Le depart doit etre dans le futur.';
    }

    const price = Number(pricePerSeat);
    if (!Number.isFinite(price) || price < 500 || price > 100000) {
      next.pricePerSeat = 'Prix entre 500 et 100000 XOF.';
    }

    const seats = Number(seatsTotal);
    if (!Number.isFinite(seats) || seats < 1 || seats > 8) {
      next.seatsTotal = 'Places entre 1 et 8.';
    }
    return next;
  };

  const handlePublish = async () => {
    if (!token) {
      showToast('Connecte-toi pour publier un trajet.', 'error');
      navigation.navigate('Profile');
      return;
    }

    setFeedback('');
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback('Corrige les champs obligatoires avant de publier.');
      return;
    }

    const seats = Math.round(Number(seatsTotal));
    const price = Math.round(Number(pricePerSeat));
    const tracking = isCompany ? true : liveTrackingEnabled;
    const payload = {
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      departureAt,
      seatsTotal: seats,
      seatsAvailable: seats,
      pricePerSeat: price,
      driverId: account?.id,
      driverLabel: account?.fullName || account?.companyName || account?.email || undefined,
      driverPhotoUrl: account?.profilePhotoUrl || undefined,
      liveTrackingEnabled: tracking,
      liveTrackingMode: tracking ? (isCompany ? 'CITY_ALERTS' : 'FULL') : undefined,
    };

    try {
      setSubmitting(true);
      const created = await createRide(token, payload);
      showToast('Trajet publie avec succes.', 'success');
      if (created?.id) {
        navigation.navigate('TripDetail', { type: 'ride', item: created });
        return;
      }
      navigation.navigate('TripsList');
    } catch (error) {
      const message = error?.message === 'auth_required'
        ? 'Session expiree. Reconnecte-toi puis republie.'
        : "Echec de publication du trajet.";
      setFeedback(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(now.getHours() >= 18 ? 20 : 18, 0, 0, 0);
  if (tonight.getTime() <= now.getTime()) tonight.setDate(tonight.getDate() + 1);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);
  const tomorrowEvening = new Date(now);
  tomorrowEvening.setDate(now.getDate() + 1);
  tomorrowEvening.setHours(18, 0, 0, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Publier un trajet</Text>
        <Text style={text.subtitle}>2 minutes pour mettre ton trajet en ligne, avec un formulaire clair.</Text>
      </View>

      {feedback ? <Banner tone="error" message={feedback} /> : null}

      <SurfaceCard style={styles.card} delay={40}>
        <SectionHeader title="Itineraire" icon="map-outline" subtitle="Choisis un modele ou saisis tes villes." />
        <View style={styles.chipsRow}>
          {ROUTE_TEMPLATES.map((template) => (
            <Pressable key={template.id} onPress={() => applyTemplate(template)} style={styles.templateChip}>
              <Text style={styles.templateText}>{template.originCity} -> {template.destinationCity}</Text>
            </Pressable>
          ))}
        </View>
        <InputField
          label="Depart"
          value={originCity}
          onChangeText={(value) => setOriginCity(value)}
          placeholder="Ville de depart"
          error={errors.originCity}
          autoCapitalize="words"
        />
        <InputField
          label="Arrivee"
          value={destinationCity}
          onChangeText={(value) => setDestinationCity(value)}
          placeholder="Ville d'arrivee"
          error={errors.destinationCity}
          autoCapitalize="words"
        />
        {errors.route ? <Text style={styles.errorText}>{errors.route}</Text> : null}
        <PrimaryButton label="Inverser depart/arrivee" variant="ghost" onPress={swapRoute} />
      </SurfaceCard>

      <SurfaceCard style={styles.card} delay={90}>
        <SectionHeader title="Date et heure" icon="calendar-outline" subtitle="Utilise un preset ou saisis manuellement." />
        <View style={styles.chipsRow}>
          <Pressable style={styles.presetChip} onPress={() => applyDeparture(tonight)}>
            <Text style={styles.presetText}>Ce soir</Text>
          </Pressable>
          <Pressable style={styles.presetChip} onPress={() => applyDeparture(tomorrowMorning)}>
            <Text style={styles.presetText}>Demain matin</Text>
          </Pressable>
          <Pressable style={styles.presetChip} onPress={() => applyDeparture(tomorrowEvening)}>
            <Text style={styles.presetText}>Demain soir</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <InputField
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              error={errors.date}
            />
          </View>
          <View style={styles.rowItem}>
            <InputField
              label="Heure"
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
              error={errors.time}
            />
          </View>
        </View>
        {errors.departureAt ? <Text style={styles.errorText}>{errors.departureAt}</Text> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card} delay={130}>
        <SectionHeader title="Prix et places" icon="cash-outline" subtitle="Fixe ton offre en un clic." />
        <View style={styles.chipsRow}>
          {PRICE_PRESETS.map((value) => (
            <Pressable key={value} style={styles.presetChip} onPress={() => setPricePerSeat(String(value))}>
              <Text style={styles.presetText}>{formatMoney(value)}</Text>
            </Pressable>
          ))}
        </View>
        <InputField
          label="Prix par place (XOF)"
          value={pricePerSeat}
          onChangeText={(value) => setPricePerSeat(value.replace(/\D+/g, ''))}
          keyboardType="number-pad"
          placeholder="2000"
          error={errors.pricePerSeat}
        />
        <View style={styles.chipsRow}>
          {SEAT_PRESETS.map((value) => (
            <Pressable key={value} style={styles.presetChip} onPress={() => setSeatsTotal(String(value))}>
              <Text style={styles.presetText}>{value} place{value > 1 ? 's' : ''}</Text>
            </Pressable>
          ))}
        </View>
        <InputField
          label="Nombre de places"
          value={seatsTotal}
          onChangeText={(value) => setSeatsTotal(value.replace(/\D+/g, ''))}
          keyboardType="number-pad"
          placeholder="3"
          error={errors.seatsTotal}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Suivi en direct</Text>
            <Text style={styles.switchSubtitle}>
              {isCompany ? 'Active automatiquement pour les comptes pro.' : 'Permet aux passagers de te suivre.'}
            </Text>
          </View>
          <Switch
            value={isCompany ? true : liveTrackingEnabled}
            onValueChange={setLiveTrackingEnabled}
            disabled={isCompany}
            thumbColor={colors.white}
            trackColor={{ false: colors.slate300, true: colors.sky500 }}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft" delay={170}>
        <SectionHeader title="Resume publication" icon="checkmark-circle-outline" />
        <Text style={styles.summaryLine}>{originCity || 'Depart'} -> {destinationCity || 'Arrivee'}</Text>
        <Text style={styles.summaryLine}>{date} a {time}</Text>
        <Text style={styles.summaryLine}>
          {formatMoney(pricePerSeat)} x {Number(seatsTotal) || 0} = {formatMoney(estimatedRevenue)}
        </Text>
      </SurfaceCard>

      <PrimaryButton label="Publier ce trajet" onPress={handlePublish} loading={submitting} />
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
  header: {
    gap: 6,
  },
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateChip: {
    borderWidth: 1,
    borderColor: colors.sky100,
    borderRadius: radius.full,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  templateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.sky700,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  switchRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchCopy: {
    flex: 1,
    gap: 3,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  switchSubtitle: {
    fontSize: 12,
    color: colors.slate600,
  },
  summaryLine: {
    fontSize: 13,
    color: colors.slate700,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: colors.rose600,
    fontWeight: '600',
  },
});
