import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { CitySelect } from '../components/CitySelect';
import { DateTimeField } from '../components/DateTimeField';
import { InputField } from '../components/InputField';
import { BrandMark } from '../components/BrandMark';
import { loadPreferences, savePreferences } from '../preferences';

export function HomeScreen({ navigation }) {
  const [fromCity, setFromCity] = useState('Abidjan');
  const [toCity, setToCity] = useState('Yamoussoukro');
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [seats, setSeats] = useState('1');
  const [prefs, setPrefs] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const stored = await loadPreferences();
      if (!active) return;
      setPrefs(stored);
      const defaults = stored.homeDefaults || {};
      setFromCity(defaults.fromCity || 'Abidjan');
      setToCity(defaults.toCity || 'Yamoussoukro');
      setSeats(defaults.seats || '1');
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
      homeDefaults: {
        ...(prefs.homeDefaults || {}),
        fromCity,
        toCity,
        seats,
      },
    };
    setPrefs(next);
    savePreferences(next);
  }, [fromCity, toCity, seats]);

  const validation = useMemo(() => {
    const next = {};
    if (!fromCity.trim()) next.fromCity = 'Ville requise.';
    if (!toCity.trim()) next.toCity = 'Ville requise.';
    const seatCount = Number.parseInt(seats, 10);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 7) {
      next.seats = 'Entre 1 et 7 places.';
    }
    return next;
  }, [fromCity, toCity, seats]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size="lg" />
        <Text style={text.title}>Voyage sereinement avec KariGo</Text>
        <Text style={text.subtitle}>
          Trouve un trajet fiable, avec suivi en direct, en quelques secondes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rechercher un trajet</Text>
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
          <DateTimeField label="Date" mode="date" value={date} onChange={setDate} hint="Optionnel" />
          <DateTimeField label="Heure" mode="time" value={time} onChange={setTime} hint="Optionnel" />
        </View>
        <InputField
          label="Places"
          placeholder="1"
          value={seats}
          onChangeText={setSeats}
          keyboardType="number-pad"
          hint="1 a 7 places."
          error={errors.seats}
        />
        <PrimaryButton
          label="Lancer la recherche"
          onPress={() => {
            setErrors(validation);
            if (Object.keys(validation).length) return;
            navigation.navigate('Results', {
              from: fromCity,
              to: toCity,
              date: date ? date.toISOString().slice(0, 10) : undefined,
              time: time ? time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : undefined,
              seats,
            });
          }}
        />
      </View>

      <View style={styles.highlights}>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightTitle}>Suivi en direct</Text>
          <Text style={styles.highlightText}>Disponible 15 min avant le depart pour les trajets actives.</Text>
        </View>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightTitle}>Communautaire & Pro</Text>
          <Text style={styles.highlightText}>Filtre rapidement les trajets avec suivi active.</Text>
        </View>
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
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  highlights: {
    gap: spacing.md,
  },
  highlightCard: {
    backgroundColor: colors.sky100,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  highlightText: {
    marginTop: 6,
    fontSize: 13,
    color: colors.slate700,
  },
});
