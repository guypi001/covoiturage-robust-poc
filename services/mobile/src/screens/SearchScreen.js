import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { CitySelect } from '../components/CitySelect';

export function SearchScreen({ navigation }) {
  const [fromCity, setFromCity] = useState('Abidjan');
  const [toCity, setToCity] = useState('Yamoussoukro');
  const [date, setDate] = useState('2026-01-17');
  const [seats, setSeats] = useState('1');
  const [budget, setBudget] = useState('5000');
  const [timeWindow, setTimeWindow] = useState('08:00 - 12:00');
  const [liveTracking, setLiveTracking] = useState(true);
  const [sort, setSort] = useState('soonest');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={text.title}>Recherche avancee</Text>
      <Text style={text.subtitle}>Affiner l'horaire, le budget et le suivi en direct.</Text>

      <View style={styles.card}>
        <CitySelect label="Depart" placeholder="Abidjan" value={fromCity} onChange={setFromCity} />
        <CitySelect label="Arrivee" placeholder="Yamoussoukro" value={toCity} onChange={setToCity} />
        <View style={styles.row}>
          <InputField label="Date" placeholder="2026-01-17" value={date} onChangeText={setDate} />
          <InputField
            label="Places"
            placeholder="1"
            value={seats}
            onChangeText={setSeats}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.row}>
          <InputField
            label="Budget max"
            placeholder="5000 XOF"
            value={budget}
            onChangeText={setBudget}
            keyboardType="number-pad"
          />
          <InputField label="Heure" placeholder="08:00 - 12:00" value={timeWindow} onChangeText={setTimeWindow} />
        </View>

        <View style={styles.sortRow}>
          {[
            { id: 'soonest', label: 'Plus tot' },
            { id: 'cheapest', label: 'Moins cher' },
            { id: 'seats', label: 'Places' },
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

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchTitle}>Suivi en direct</Text>
            <Text style={styles.switchText}>Afficher uniquement les trajets actives.</Text>
          </View>
          <Switch value={liveTracking} onValueChange={setLiveTracking} trackColor={{ true: colors.sky500 }} />
        </View>

        <PrimaryButton label="Afficher les resultats" onPress={() => navigation.navigate('Results')} />
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
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
