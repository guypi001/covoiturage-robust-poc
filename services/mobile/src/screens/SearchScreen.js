import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { CitySelect } from '../components/CitySelect';
import { DateTimeField } from '../components/DateTimeField';
import { loadPreferences, savePreferences } from '../preferences';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';

export function SearchScreen({ navigation }) {
  const [fromCity, setFromCity] = useState('Abidjan');
  const [toCity, setToCity] = useState('Yamoussoukro');
  const [date, setDate] = useState(null);
  const [seats, setSeats] = useState('1');
  const [budget, setBudget] = useState('');
  const [afterTime, setAfterTime] = useState(null);
  const [beforeTime, setBeforeTime] = useState(null);
  const [liveTracking, setLiveTracking] = useState(true);
  const [driverVerified, setDriverVerified] = useState(false);
  const [comfortLevel, setComfortLevel] = useState('');
  const [sort, setSort] = useState('soonest');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const stored = await loadPreferences();
      if (!active) return;
      setPrefs(stored);
      const defaults = stored.searchDefaults || {};
      setFromCity(defaults.fromCity || 'Abidjan');
      setToCity(defaults.toCity || 'Yamoussoukro');
      setSeats(defaults.seats || '1');
      setBudget(defaults.budget || '');
      setLiveTracking(defaults.liveTracking ?? true);
      setDriverVerified(defaults.driverVerified ?? false);
      setComfortLevel(defaults.comfortLevel ?? '');
      setSort(defaults.sort || 'soonest');
    };
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!prefs) return;
    const next = {
      ...prefs,
      searchDefaults: {
        ...(prefs.searchDefaults || {}),
        fromCity,
        toCity,
        seats,
        budget,
        liveTracking,
        driverVerified,
        comfortLevel,
        sort,
      },
    };
    setPrefs(next);
    savePreferences(next);
  }, [fromCity, toCity, seats, budget, liveTracking, driverVerified, comfortLevel, sort]);

  const validation = useMemo(() => {
    const next = {};
    if (!fromCity.trim()) next.fromCity = 'Ville requise.';
    if (!toCity.trim()) next.toCity = 'Ville requise.';
    const seatCount = Number.parseInt(seats, 10);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 7) {
      next.seats = 'Entre 1 et 7 places.';
    }
    if (budget) {
      const budgetValue = Number.parseInt(String(budget).replace(/\D/g, ''), 10);
      if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
        next.budget = 'Budget invalide.';
      }
    }
    if (afterTime && beforeTime && afterTime.getTime() >= beforeTime.getTime()) {
      next.time = 'Plage horaire incoherente.';
    }
    return next;
  }, [fromCity, toCity, seats, budget, afterTime, beforeTime]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Recherche simplifiée</Text>
      <Text style={text.subtitle}>Commence par départ, arrivée et date. Les filtres avancés sont optionnels.</Text>

      {prefs === null ? (
        <SurfaceCard style={styles.card} delay={80} animated={false}>
          <SectionHeader title="Recherche rapide" icon="options-outline" />
          <SkeletonBlock width="60%" height={12} />
          <SkeletonBlock width="80%" height={16} />
          <View style={styles.row}>
            <SkeletonBlock width="45%" height={40} />
            <SkeletonBlock width="45%" height={40} />
          </View>
          <View style={styles.row}>
            <SkeletonBlock width="45%" height={40} />
            <SkeletonBlock width="45%" height={40} />
          </View>
          <SkeletonBlock width="40%" height={10} />
          <SkeletonBlock width="90%" height={36} />
        </SurfaceCard>
      ) : (
        <SurfaceCard style={styles.card} delay={80}>
          <SectionHeader title="Recherche rapide" icon="options-outline" />
          <CitySelect
            label="Depart"
            placeholder="Abidjan"
            value={fromCity}
            onChange={setFromCity}
            error={errors.fromCity}
          />
          <CitySelect
            label="Arrivee"
            placeholder="Yamoussoukro"
            value={toCity}
            onChange={setToCity}
            error={errors.toCity}
          />
          <View style={styles.row}>
            <DateTimeField
              label="Date"
              mode="date"
              value={date}
              onChange={setDate}
              hint="Choisis une date ou laisse vide."
            />
            <InputField
              label="Places"
              placeholder="1"
              value={seats}
              onChangeText={setSeats}
              keyboardType="number-pad"
              hint="1 a 7 places."
              error={errors.seats}
            />
          </View>
          <Pressable
            onPress={() => setShowAdvanced((prev) => !prev)}
            style={[styles.advancedToggle, showAdvanced && styles.advancedToggleActive]}
          >
            <Text style={styles.advancedToggleLabel}>
              {showAdvanced ? 'Masquer les filtres avancés' : 'Afficher les filtres avancés'}
            </Text>
          </Pressable>

          {showAdvanced ? (
            <>
              <View style={styles.row}>
                <InputField
                  label="Budget max"
                  placeholder="5000 XOF"
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="number-pad"
                  hint="Optionnel."
                  error={errors.budget}
                />
                <View style={styles.timeColumn}>
                  <DateTimeField
                    label="Après"
                    mode="time"
                    value={afterTime}
                    onChange={setAfterTime}
                    error={errors.time}
                  />
                  <DateTimeField
                    label="Avant"
                    mode="time"
                    value={beforeTime}
                    onChange={setBeforeTime}
                    error={errors.time}
                  />
                </View>
              </View>

              <View style={styles.sortRow}>
                {[
                  { id: 'soonest', label: 'Plus tôt' },
                  { id: 'cheapest', label: 'Moins cher' },
                  { id: 'seats', label: 'Places' },
                  { id: 'smart', label: 'Intelligent' },
                ].map((option) => {
                  const active = sort === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setSort(option.id)}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                    >
                      <Text style={[styles.sortText, active && styles.sortTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sortRow}>
                {[
                  { id: '', label: 'Confort' },
                  { id: 'STANDARD', label: 'Standard' },
                  { id: 'CONFORT', label: 'Confort +' },
                  { id: 'PREMIUM', label: 'Premium' },
                ].map((option) => {
                  const active = comfortLevel === option.id;
                  return (
                    <Pressable
                      key={option.id || 'comfort-any'}
                      onPress={() => setComfortLevel(option.id)}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                    >
                      <Text style={[styles.sortText, active && styles.sortTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Suivi en direct</Text>
                  <Text style={styles.switchText}>Afficher uniquement les trajets actifs.</Text>
                </View>
                <Switch value={liveTracking} onValueChange={setLiveTracking} trackColor={{ true: colors.sky500 }} />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Conducteur vérifié</Text>
                  <Text style={styles.switchText}>Email + téléphone confirmés.</Text>
                </View>
                <Switch value={driverVerified} onValueChange={setDriverVerified} trackColor={{ true: colors.sky500 }} />
              </View>
            </>
          ) : null}

          <PrimaryButton
            label="Afficher les résultats"
            onPress={() => {
              setErrors(validation);
              if (Object.keys(validation).length) return;
              navigation.navigate('Results', {
                from: fromCity,
                to: toCity,
                date: date ? date.toISOString().slice(0, 10) : undefined,
                seats,
                priceMax: budget || undefined,
                departureAfter: afterTime
                  ? afterTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : undefined,
                departureBefore: beforeTime
                  ? beforeTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : undefined,
                liveTracking,
                driverVerified,
                comfortLevel,
                sort,
              });
            }}
          />
        </SurfaceCard>
      )}
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
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  timeColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  advancedToggle: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  advancedToggleActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  advancedToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
  },
  sortChipActive: {
    backgroundColor: colors.sky100,
    borderColor: colors.sky500,
  },
  sortText: {
    fontSize: 12,
    color: colors.slate600,
    fontWeight: '600',
  },
  sortTextActive: {
    color: colors.sky600,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  switchText: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 4,
  },
});
