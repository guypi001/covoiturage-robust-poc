import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { CitySelect } from '../components/CitySelect';
import { DateTimeField } from '../components/DateTimeField';
import { InputField } from '../components/InputField';

export function HomeScreen({ navigation }) {
  const [fromCity, setFromCity] = useState('Abidjan');
  const [toCity, setToCity] = useState('Yamoussoukro');
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [seats, setSeats] = useState('1');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={text.title}>Voyage sereinement avec KariGo</Text>
        <Text style={text.subtitle}>
          Trouve un trajet fiable, avec suivi en direct, en quelques secondes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rechercher un trajet</Text>
        <CitySelect label="Depart" placeholder="Abidjan" value={fromCity} onChange={setFromCity} />
        <CitySelect label="Arrivee" placeholder="Yamoussoukro" value={toCity} onChange={setToCity} />
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
        />
        <PrimaryButton
          label="Lancer la recherche"
          onPress={() =>
            navigation.navigate('Results', {
              from: fromCity,
              to: toCity,
              date: date ? date.toISOString().slice(0, 10) : undefined,
              time: time ? time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : undefined,
              seats,
            })
          }
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
