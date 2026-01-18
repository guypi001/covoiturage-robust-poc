import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';

export function AuthScreen() {
  const { login, register, continueAsGuest } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const validation = useMemo(() => {
    const next = {};
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !/^\S+@\S+\.\S+$/.test(emailTrimmed)) {
      next.email = 'Email invalide.';
    }
    if (!password || password.length < 8) {
      next.password = '8 caracteres minimum.';
    }
    if (mode === 'register') {
      if (!firstName.trim() || firstName.trim().length < 2) {
        next.firstName = 'Prenom requis.';
      }
      if (!lastName.trim() || lastName.trim().length < 2) {
        next.lastName = 'Nom requis.';
      }
    }
    return next;
  }, [email, password, firstName, lastName, mode]);

  const handleSubmit = async () => {
    setErrors(validation);
    if (Object.keys(validation).length) return;
    try {
      setBusy(true);
      const emailTrimmed = email.trim();
      if (mode === 'register') {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        await register({ fullName, email: emailTrimmed, password });
        showToast('Compte cree.', 'success');
      } else {
        await login(emailTrimmed, password);
        showToast('Connexion reussie.', 'success');
      }
    } catch (err) {
      const message = String(err?.message || 'Impossible de continuer.');
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size="lg" />
        <Text style={styles.title}>Bienvenue</Text>
        <Text style={styles.subtitle}>
          Connecte-toi pour reserver, ou continue en visiteur.
        </Text>
      </View>

      <View style={styles.switchRow}>
        {[
          { id: 'login', label: 'Connexion' },
          { id: 'register', label: 'Inscription' },
        ].map((item) => {
          const active = mode === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setMode(item.id)}
              style={[styles.switchButton, active && styles.switchButtonActive]}
            >
              <Text style={[styles.switchText, active && styles.switchTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {mode === 'register' && (
          <>
            <InputField
              label="Prenom"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Aya"
              error={errors.firstName}
            />
            <InputField
              label="Nom"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Kouadio"
              error={errors.lastName}
            />
          </>
        )}
        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemple.com"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          error={errors.email}
        />
        <InputField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="********"
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          error={errors.password}
        />
        <PrimaryButton
          label={mode === 'register' ? 'Creer mon compte' : 'Se connecter'}
          onPress={handleSubmit}
          disabled={busy}
        />
      </View>

      <View style={styles.visitorCard}>
        <Text style={styles.visitorTitle}>Mode visiteur</Text>
        <Text style={styles.visitorText}>
          Consulte les trajets sans compte. Tu pourras te connecter plus tard.
        </Text>
        <PrimaryButton label="Continuer en visiteur" variant="ghost" onPress={continueAsGuest} />
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.slate900,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate600,
  },
  switchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  switchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  switchButtonActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.sky100,
  },
  switchText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate600,
  },
  switchTextActive: {
    color: colors.brandPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.md,
  },
  visitorCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.sm,
  },
  visitorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  visitorText: {
    fontSize: 13,
    color: colors.slate600,
  },
});
