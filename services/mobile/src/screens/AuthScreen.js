import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, text } from '../theme';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../auth';
import { getProfileQuestions, requestGmailOtp, requestPasswordReset, resetPassword, verifyGmailOtp } from '../api/identity';
import { useToast } from '../ui/ToastContext';
import { SurfaceCard } from '../components/SurfaceCard';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';
import { PROFILE_QUESTIONS } from '../utils/profileQuestions';

export function AuthScreen() {
  const { login, register, continueAsGuest, applyAuth } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [registerStep, setRegisterStep] = useState('form');
  const [profileQuestions, setProfileQuestions] = useState(PROFILE_QUESTIONS);
  const [profileAnswers, setProfileAnswers] = useState({});
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetTone, setResetTone] = useState('info');

  const sanitizeOtpInput = (value, maxLength = 6) =>
    value.replace(/\D+/g, '').slice(0, maxLength);

  const tryAutofillOtp = async (setter, maxLength = 6) => {
    try {
      const text = await Clipboard.getStringAsync();
      const code = sanitizeOtpInput(text, maxLength);
      if (code.length >= 4) setter(code);
    } catch {
      // ignore clipboard errors
    }
  };

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

  useEffect(() => {
    let active = true;
    if (mode !== 'register') return;
    getProfileQuestions()
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res?.items) ? res.items : PROFILE_QUESTIONS;
        setProfileQuestions(items);
      })
      .catch(() => {
        if (!active) return;
        setProfileQuestions(PROFILE_QUESTIONS);
      });
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'register') {
      setRegisterStep('form');
    }
  }, [mode]);

  const normalizedProfileAnswers = useMemo(() => {
    const result = {};
    profileQuestions.forEach((question) => {
      const value = profileAnswers?.[question.key];
      if (typeof value === 'boolean') {
        result[question.key] = value;
      }
    });
    return result;
  }, [profileAnswers, profileQuestions]);

  const setAnswer = (key, value) => {
    setProfileAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setErrors(validation);
    if (Object.keys(validation).length) return;
    try {
      setBusy(true);
      const emailTrimmed = email.trim();
      if (mode === 'register') {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        const res = await register({
          fullName,
          email: emailTrimmed,
          password,
          profileAnswers: normalizedProfileAnswers,
        });
        if (res?.pending) {
          setPendingEmail(emailTrimmed);
          showToast('Code OTP envoye.', 'success');
          return;
        }
        showToast('Compte cree.', 'success');
      } else {
        await login(emailTrimmed, password);
        showToast('Connexion reussie.', 'success');
      }
    } catch (err) {
      const raw = String(err?.message || 'Impossible de continuer.');
      if (raw === 'email_not_verified') {
        try {
          await requestGmailOtp({ email: email.trim() });
          setPendingEmail(email.trim());
          showToast('Email non verifie. Code OTP envoye.', 'error');
          return;
        } catch {
          showToast('Email non verifie. Impossible d envoyer le code.', 'error');
          return;
        }
      }
      if (raw === 'gmail_only') {
        showToast('Utilise une adresse Gmail valide.', 'error');
        return;
      }
      showToast(raw, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!pendingEmail) return;
    if (!otpCode.trim()) {
      showToast('Code invalide.', 'error');
      return;
    }
    try {
      setOtpBusy(true);
      const auth = await verifyGmailOtp({ email: pendingEmail.trim(), code: otpCode.trim() });
      applyAuth(auth);
      setOtpCode('');
      setPendingEmail('');
      showToast('Email verifie.', 'success');
    } catch (err) {
      const message = String(err?.message || 'Verification impossible.');
      showToast(message, 'error');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingEmail) return;
    try {
      setOtpBusy(true);
      await requestGmailOtp({ email: pendingEmail.trim() });
      showToast('Code envoye.', 'success');
    } catch (err) {
      showToast('Impossible d envoyer le code.', 'error');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleRequestReset = async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setResetTone('error');
      setResetMessage('Email invalide.');
      return;
    }
    try {
      setResetBusy(true);
      setResetMessage('');
      await requestPasswordReset({ email: trimmed });
      setResetStep('code');
      setResetTone('success');
      setResetMessage('Code OTP envoye par email.');
    } catch (err) {
      setResetTone('error');
      setResetMessage('Impossible d envoyer le code.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    const token = resetToken.trim();
    if (!token) {
      setResetTone('error');
      setResetMessage('Code OTP manquant.');
      return;
    }
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetTone('error');
      setResetMessage('8 caracteres minimum.');
      return;
    }
    try {
      setResetBusy(true);
      setResetMessage('');
      await resetPassword({ token, password: resetPasswordValue });
      setResetTone('success');
      setResetMessage('Mot de passe mis a jour.');
      setForgotMode(false);
      setResetStep('email');
      setResetToken('');
      setResetPasswordValue('');
      setEmail(resetEmail);
      setMode('login');
      showToast('Tu peux te connecter.', 'success');
    } catch (err) {
      const message = String(err?.message || 'Reset impossible.');
      setResetTone('error');
      setResetMessage(message);
    } finally {
      setResetBusy(false);
    }
  };

  if (!forgotMode && !pendingEmail && mode === 'register' && registerStep === 'onboarding') {
    return (
      <View style={styles.onboardingContainer}>
        <View style={styles.onboardingHeader}>
          <BrandMark size="lg" />
          <View style={styles.onboardingProgress}>
            <Text style={styles.onboardingStepText}>Etape 2 / 2</Text>
            <View style={styles.onboardingProgressTrack}>
              <View style={styles.onboardingProgressFill} />
            </View>
          </View>
        </View>

        <View style={styles.onboardingIllustration}>
          <View style={styles.onboardingCircle} />
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>Ton profil voyageur</Text>
            <Text style={styles.onboardingSubtitle}>
              Quelques questions rapides pour harmoniser les trajets.
            </Text>
          </View>
        </View>

        <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingContent}>
          <View style={styles.questionList}>
            {profileQuestions.map((question) => {
              const current = profileAnswers?.[question.key];
              return (
                <View key={question.key} style={styles.questionRow}>
                  <Text style={styles.questionText}>{question.label}</Text>
                  <View style={styles.questionActions}>
                    <Pressable
                      onPress={() => setAnswer(question.key, true)}
                      style={[
                        styles.questionChip,
                        current === true && styles.questionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.questionChipText,
                          current === true && styles.questionChipTextActive,
                        ]}
                      >
                        Oui
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setAnswer(question.key, false)}
                      style={[
                        styles.questionChip,
                        current === false && styles.questionChipActiveAlt,
                      ]}
                    >
                      <Text
                        style={[
                          styles.questionChipText,
                          current === false && styles.questionChipTextActiveAlt,
                        ]}
                      >
                        Non
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.onboardingActions}>
          <PrimaryButton label="Retour" variant="ghost" onPress={() => setRegisterStep('form')} />
          <PrimaryButton label="Creer mon compte" onPress={handleSubmit} disabled={busy} />
        </View>
      </View>
    );
  }

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

      <SurfaceCard style={styles.card} delay={80}>
        {forgotMode ? (
          <>
            <Text style={styles.otpTitle}>Mot de passe oublie</Text>
            <Text style={styles.otpText}>
              {resetStep === 'email'
                ? 'Entre ton email pour recevoir un code OTP.'
                : 'Entre le code OTP recu et choisis un nouveau mot de passe.'}
            </Text>
            {resetMessage ? <Banner tone={resetTone} message={resetMessage} /> : null}
            {resetStep === 'email' ? (
              <>
                <InputField
                  label="Email"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  placeholder="email@exemple.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                />
                <PrimaryButton label="Recevoir le code" onPress={handleRequestReset} disabled={resetBusy} />
                {resetBusy ? <SkeletonBlock width="40%" height={8} /> : null}
              </>
            ) : (
              <>
                <InputField
                  label="Code OTP"
                  value={resetToken}
                  onFocus={() => tryAutofillOtp(setResetToken)}
                  onChangeText={(value) => setResetToken(sanitizeOtpInput(value))}
                  placeholder="Code recu par email"
                  keyboardType="number-pad"
                />
                <InputField
                  label="Nouveau mot de passe"
                  value={resetPasswordValue}
                  onChangeText={setResetPasswordValue}
                  placeholder="********"
                  secureTextEntry
                />
                <PrimaryButton label="Reinitialiser" onPress={handleConfirmReset} disabled={resetBusy} />
                {resetBusy ? <SkeletonBlock width="40%" height={8} /> : null}
              </>
            )}
            <PrimaryButton
              label={resetStep === 'email' ? 'Retour' : 'Modifier l email'}
              variant="ghost"
              onPress={() => {
                if (resetStep === 'code') {
                  setResetStep('email');
                  setResetToken('');
                  setResetPasswordValue('');
                  return;
                }
                setForgotMode(false);
                setResetMessage('');
              }}
            />
          </>
        ) : pendingEmail ? (
          <>
            <Text style={styles.otpTitle}>Verification email</Text>
            <Text style={styles.otpText}>Entre le code envoye a {pendingEmail}.</Text>
            <InputField
              label="Code OTP"
              value={otpCode}
              onFocus={() => tryAutofillOtp(setOtpCode)}
              onChangeText={(value) => setOtpCode(sanitizeOtpInput(value))}
              placeholder="123456"
              keyboardType="number-pad"
            />
            <PrimaryButton label="Verifier" onPress={handleVerifyOtp} disabled={otpBusy} />
            {otpBusy ? <SkeletonBlock width="40%" height={8} /> : null}
            <PrimaryButton label="Renvoyer le code" variant="ghost" onPress={handleResendOtp} disabled={otpBusy} />
            <PrimaryButton
              label="Modifier l'email"
              variant="ghost"
              onPress={() => {
                setPendingEmail('');
                setOtpCode('');
              }}
            />
          </>
        ) : (
          <>
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
              label={mode === 'register' ? 'Continuer' : 'Se connecter'}
              onPress={() => {
                if (mode === 'register') {
                  setErrors(validation);
                  if (Object.keys(validation).length) return;
                  setRegisterStep('onboarding');
                  return;
                }
                handleSubmit();
              }}
              disabled={busy}
            />
            {busy ? <SkeletonBlock width="40%" height={8} /> : null}
            {mode === 'login' ? (
              <Pressable
                style={styles.forgotLink}
                onPress={() => {
                  setForgotMode(true);
                  setResetEmail(email.trim());
                  setResetMessage('');
                  setResetStep('email');
                }}
              >
                <Text style={styles.forgotText}>Mot de passe oublie ?</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </SurfaceCard>

      <SurfaceCard style={styles.visitorCard} tone="soft" delay={120}>
        <Text style={styles.visitorTitle}>Mode visiteur</Text>
        <Text style={styles.visitorText}>
          Consulte les trajets sans compte. Tu pourras te connecter plus tard.
        </Text>
        <PrimaryButton label="Continuer en visiteur" variant="ghost" onPress={continueAsGuest} />
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: colors.slate50,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  onboardingProgress: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  onboardingStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
  },
  onboardingProgressTrack: {
    width: 140,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.slate200,
    overflow: 'hidden',
  },
  onboardingProgressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.brandPrimary,
  },
  onboardingIllustration: {
    position: 'relative',
    borderRadius: radius.xl,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
  },
  onboardingCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -40,
    top: -50,
    backgroundColor: colors.sky100,
  },
  onboardingCard: {
    gap: spacing.xs,
  },
  onboardingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.slate900,
  },
  onboardingSubtitle: {
    fontSize: 13,
    color: colors.slate600,
  },
  onboardingScroll: {
    flex: 1,
  },
  onboardingContent: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
    gap: spacing.md,
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  otpText: {
    fontSize: 13,
    color: colors.slate600,
  },
  visitorCard: {
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
  questionList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  questionRow: {
    gap: 8,
  },
  questionText: {
    fontSize: 13,
    color: colors.slate700,
  },
  questionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  questionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
  },
  questionChipActive: {
    borderColor: colors.emerald400,
    backgroundColor: colors.emerald50,
  },
  questionChipActiveAlt: {
    borderColor: colors.rose400,
    backgroundColor: colors.rose50,
  },
  questionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  questionChipTextActive: {
    color: colors.emerald600,
  },
  questionChipTextActiveAlt: {
    color: colors.rose600,
  },
  onboardingActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  forgotLink: {
    alignSelf: 'flex-start',
  },
  forgotText: {
    color: colors.brandPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
