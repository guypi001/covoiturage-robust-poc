import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { searchRides } from '../api/client';

export function HomeScreen() {
  const [from, setFrom] = useState('Abidjan');
  const [to, setTo] = useState('Yamoussoukro');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setStatus('');
    setLoading(true);
    try {
      const results = await searchRides({ from, to, seats: 1, sort: 'soonest' });
      const count = Array.isArray(results) ? results.length : 0;
      setStatus(`${count} trajet(s) trouves.`);
    } catch (err: any) {
      setStatus(err?.message || 'Erreur recherche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>KariGo Mobile</Text>
          <Text style={styles.subtitle}>Demarrage iOS - React Native</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Depart</Text>
          <TextInput
            value={from}
            onChangeText={setFrom}
            style={styles.input}
            placeholder="Abidjan"
          />
          <Text style={styles.label}>Arrivee</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            style={styles.input}
            placeholder="Yamoussoukro"
          />
          <PrimaryButton label={loading ? 'Recherche...' : 'Rechercher'} onPress={handleSearch} disabled={loading} />
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Connexion API</Text>
          <Text style={styles.noteText}>
            Configure EXPO_PUBLIC_BFF_URL, EXPO_PUBLIC_SEARCH_URL, EXPO_PUBLIC_RIDE_URL, EXPO_PUBLIC_IDENTITY_URL.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    gap: 20,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  status: {
    fontSize: 14,
    color: '#0f172a',
  },
  note: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 14,
    color: '#475569',
  },
});
