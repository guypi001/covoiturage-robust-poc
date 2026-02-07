import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { InputField } from '../components/InputField';
import { registerPushToken, sendTestNotification } from '../api/notifications';
import { getMyBookings, getMyPaymentMethods, getMyWallet, getMyWalletTransactions, setDefaultPaymentMethod } from '../api/bff';
import { useAuth } from '../auth';
import {
  requestGmailOtp,
  updateCompanyProfile,
  updateIndividualProfile,
  deleteProfilePhoto,
  getCompanyVerification,
  uploadCompanyDocument,
  uploadProfilePhoto,
  verifyGmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
  getProfileQuestions,
} from '../api/identity';
import { useToast } from '../ui/ToastContext';
import { resolveAssetUrl } from '../config';
import { getDisplayName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';
import { useSavedRides } from '../savedRides';
import { PROFILE_QUESTIONS } from '../utils/profileQuestions';
import { loadPreferences, savePreferences } from '../preferences';

export function ProfileScreen({ navigation }) {
  const { token, account, guest, login, logout, refreshProfile, applyAuth } = useAuth();
  const { showToast } = useToast();
  const { savedRides } = useSavedRides();
  const [pushStatus, setPushStatus] = useState('Notifications desactivees');
  const [pushBusy, setPushBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoAsset, setPhotoAsset] = useState(null);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [tagline, setTagline] = useState('');
  const [comfortText, setComfortText] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneOtpBusy, setPhoneOtpBusy] = useState(false);
  const [companyVerification, setCompanyVerification] = useState(null);
  const [companyDocBusy, setCompanyDocBusy] = useState(false);
  const [companyDocType, setCompanyDocType] = useState('legal');
  const [profileQuestions, setProfileQuestions] = useState(PROFILE_QUESTIONS);
  const [profileAnswers, setProfileAnswers] = useState({});
  const [appSettings, setAppSettings] = useState({
    appearance: 'system',
    haptics: true,
    compactCards: false,
    autoPlayAnimations: true,
  });

  const MAX_COMPANY_DOC_SIZE = 6 * 1024 * 1024;

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

  const persistAppSettings = async (nextSettings) => {
    const current = await loadPreferences();
    await savePreferences({
      ...current,
      appSettings: {
        ...(current.appSettings || {}),
        ...nextSettings,
      },
    });
  };

  const isCompany = account?.type === 'COMPANY';
  const typeLabel = isCompany ? 'Entreprise' : 'Particulier';
  const statusLabel =
    account?.status === 'ACTIVE' ? 'Actif' : account?.status === 'SUSPENDED' ? 'Suspendu' : 'Inconnu';
  const roleLabel = account?.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur';
  const phoneVerified = Boolean(account?.phoneVerifiedAt);
  const emailVerified = Boolean(account?.emailVerifiedAt);

  useEffect(() => {
    if (!account) return;
    setPhotoUrl(account.profilePhotoUrl || '');
    setPhotoPreview('');
    setPhotoAsset(null);
    setFullName(account.fullName || '');
    setCompanyName(account.companyName || '');
    setRegistrationNumber(account.registrationNumber || '');
    setContactName(account.contactName || '');
    setContactPhone(account.contactPhone || '');
    setTagline(account.tagline || '');
    setComfortText((account.comfortPreferences || []).join(', '));
    setProfileAnswers(account.profileAnswers || {});
  }, [account]);

  useEffect(() => {
    let active = true;
    if (!token) return;
    getProfileQuestions(token)
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
  }, [token]);

  useEffect(() => {
    let active = true;
    const hydrateSettings = async () => {
      const prefs = await loadPreferences();
      if (!active) return;
      setAppSettings({
        appearance: prefs?.appSettings?.appearance || 'system',
        haptics: prefs?.appSettings?.haptics ?? true,
        compactCards: prefs?.appSettings?.compactCards ?? false,
        autoPlayAnimations: prefs?.appSettings?.autoPlayAnimations ?? true,
      });
    };
    hydrateSettings();
    return () => {
      active = false;
    };
  }, []);

  const ownerId = account?.id || 'demo-user';
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const profileLabel = useMemo(() => getDisplayName(account), [account]);
  const formatShortDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const validateProfile = () => {
    const next = {};
    if (isCompany) {
      if (!companyName.trim()) next.companyName = 'Nom requis.';
    } else {
      if (!fullName.trim() || fullName.trim().length < 2) next.fullName = 'Nom requis.';
    }
    if (registrationNumber && registrationNumber.trim().length < 4) {
      next.registrationNumber = 'Immatriculation invalide.';
    }
    if (contactPhone && !/^[+0-9\s-]{8,20}$/.test(contactPhone.trim())) {
      next.contactPhone = 'Numero invalide.';
    }
    if (tagline && tagline.length > 80) {
      next.tagline = '80 caracteres maximum.';
    }
    return next;
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Autorisation photo requise.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      showToast('Photo trop lourde. Maximum 2 Mo.', 'error');
      return;
    }
    const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
    const fileType = asset.mimeType || 'image/jpeg';
    setPhotoPreview(asset.uri);
    setPhotoAsset({
      uri: asset.uri,
      name: fileName,
      type: fileType,
    });
  };

  const handleCapturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast('Autorisation camera requise.', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      showToast('Photo trop lourde. Maximum 2 Mo.', 'error');
      return;
    }
    const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
    const fileType = asset.mimeType || 'image/jpeg';
    setPhotoPreview(asset.uri);
    setPhotoAsset({
      uri: asset.uri,
      name: fileName,
      type: fileType,
    });
  };

  const handleUploadCompanyDoc = async () => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Autorisation photo requise.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_COMPANY_DOC_SIZE) {
      showToast('Document trop lourd. 6 Mo maximum.', 'error');
      return;
    }
    const fileName = asset.fileName || `company-doc-${Date.now()}.jpg`;
    const fileType = asset.mimeType || 'image/jpeg';
    setCompanyDocBusy(true);
    try {
      await uploadCompanyDocument(
        token,
        {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        },
        companyDocType,
      );
      const verification = await getCompanyVerification(token);
      setCompanyVerification(verification);
      showToast('Document transmis pour verification.', 'success');
    } catch (err) {
      showToast('Impossible d envoyer le document.', 'error');
    } finally {
      setCompanyDocBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      setLoadingData(true);
      try {
        await refreshProfile();
        const [bookingRes, paymentRes, walletRes, txRes, verificationRes] = await Promise.all([
          getMyBookings(token),
          getMyPaymentMethods(token),
          getMyWallet(token),
          getMyWalletTransactions(token, 10),
          isCompany ? getCompanyVerification(token) : Promise.resolve(null),
        ]);
        if (active) {
          setBookings(bookingRes?.data || bookingRes?.items || []);
          setPaymentMethods(Array.isArray(paymentRes) ? paymentRes : []);
          setWallet(walletRes?.error ? null : walletRes);
          setWalletTransactions(Array.isArray(txRes) ? txRes : []);
          if (verificationRes) setCompanyVerification(verificationRes);
        }
      } catch (err) {
        if (active) setAuthError('Impossible de charger les donnees.');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [token, refreshProfile, isCompany]);

  const handleEnablePush = async () => {
    try {
      if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
        setPushStatus('Indisponible sur Expo Go (Android)');
        return;
      }
      setPushBusy(true);
      const settings = await Notifications.getPermissionsAsync();
      let status = settings.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        setPushStatus('Autorisation refusee');
        return;
      }

      let tokenResponse;
      try {
        tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      } catch (err) {
        const message = String(err?.message || err);
        if (message.toLowerCase().includes('projectid')) {
          setPushStatus('ProjectId Expo manquant. Configure EXPO_PUBLIC_EAS_PROJECT_ID.');
          return;
        }
        throw err;
      }
      await registerPushToken({
        ownerId,
        token: tokenResponse.data,
        platform: Platform.OS,
      });
      setPushStatus('Notifications actives');
      showToast('Notifications actives.', 'success');
    } catch (err) {
      const message = err?.message ? String(err.message) : 'Erreur activation.';
      setPushStatus(message);
      showToast(message, 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setPushBusy(true);
      await sendTestNotification({ ownerId, title: 'KariGo', body: 'Test notification mobile.' });
      setPushStatus('Notification test envoyee');
      showToast('Notification test envoyee.', 'success');
    } catch (err) {
      setPushStatus('Echec notification test');
      showToast('Echec notification test.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const walletBalance = wallet?.balance ?? 0;
  const statsLabel = `${bookings.length} reservations · ${paymentMethods.length} moyens de paiement · Solde ${walletBalance} XOF`;
  const favoritesCount = Object.keys(savedRides || {}).length;

  const comfortPreferences = comfortText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

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

  const setAppSetting = async (key, value) => {
    const next = { ...appSettings, [key]: value };
    setAppSettings(next);
    await persistAppSettings(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Profil</Text>
        <Text style={text.subtitle}>
          Garde tes informations a jour et personnalise ton experience KariGo.
        </Text>
      </View>

      {guest && (
        <SurfaceCard style={styles.card} delay={60}>
          <SectionHeader icon="person-outline" title="Mode visiteur" />
          <Text style={styles.helperText}>
            Tu peux consulter les trajets sans compte. Pour reserver et discuter, connecte-toi.
          </Text>
          <PrimaryButton label="Se connecter / s'inscrire" onPress={logout} />
        </SurfaceCard>
      )}

      {!token && !guest && (
        <SurfaceCard style={styles.card} delay={60}>
          <SectionHeader icon="log-in-outline" title="Connexion" />
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
          />
          <InputField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="********"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />
          {authError ? <Banner tone="error" message={authError} /> : null}
          <PrimaryButton
            label="Se connecter"
            onPress={async () => {
              setAuthError('');
              try {
                await login(email, password);
                showToast('Connexion reussie.', 'success');
              } catch (err) {
                setAuthError('Connexion impossible.');
                showToast('Connexion impossible.', 'error');
              }
            }}
          />
        </SurfaceCard>
      )}

      {token && (
        <SurfaceCard style={styles.profileCard} delay={90}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {photoPreview || photoUrl ? (
                <Image source={{ uri: resolveAssetUrl(photoPreview || photoUrl) }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{profileLabel.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profileLabel}</Text>
              <Text style={styles.meta}>{account?.email || ''}</Text>
              {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="ribbon-outline" size={12} color={colors.slate600} />
                  <Text style={styles.badgeText}>{typeLabel}</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="shield-outline" size={12} color={colors.slate600} />
                  <Text style={styles.badgeText}>{statusLabel}</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="briefcase-outline" size={12} color={colors.slate600} />
                  <Text style={styles.badgeText}>{roleLabel}</Text>
                </View>
                <View style={emailVerified ? styles.badgeSuccess : styles.badgeWarning}>
                  <Ionicons
                    name={emailVerified ? 'mail-open-outline' : 'mail-outline'}
                    size={12}
                    color={emailVerified ? colors.emerald500 : colors.amber700}
                  />
                  <Text style={emailVerified ? styles.badgeTextSuccess : styles.badgeTextWarning}>
                    {emailVerified ? 'Email verifie' : 'Email non verifie'}
                  </Text>
                </View>
                <View style={phoneVerified ? styles.badgeSuccess : styles.badgeWarning}>
                  <Ionicons
                    name={phoneVerified ? 'call-outline' : 'call-outline'}
                    size={12}
                    color={phoneVerified ? colors.emerald500 : colors.amber700}
                  />
                  <Text style={phoneVerified ? styles.badgeTextSuccess : styles.badgeTextWarning}>
                    {phoneVerified ? 'Telephone verifie' : 'Telephone non verifie'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.profileActions}>
            <Pressable style={styles.profileAction} onPress={handlePickPhoto}>
              <Ionicons name="image-outline" size={16} color={colors.slate700} />
              <Text style={styles.profileActionText}>Importer</Text>
            </Pressable>
            <Pressable style={styles.profileAction} onPress={handleCapturePhoto}>
              <Ionicons name="camera-outline" size={16} color={colors.slate700} />
              <Text style={styles.profileActionText}>Camera</Text>
            </Pressable>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Derniere connexion</Text>
              <Text style={styles.infoValue}>{formatShortDate(account?.lastLoginAt)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Inscrit le</Text>
              <Text style={styles.infoValue}>{formatShortDate(account?.createdAt)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Connexions</Text>
              <Text style={styles.infoValue}>{account?.loginCount ?? 0}</Text>
            </View>
          </View>
        </SurfaceCard>
      )}

      {token && (
        <View style={styles.statsRow}>
          <SurfaceCard style={styles.statCard} tone="soft" delay={120}>
            <Text style={styles.statValue}>{bookings.length}</Text>
            <Text style={styles.statLabel}>Reservations</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.statCard} tone="soft" delay={150}>
            <Text style={styles.statValue}>{paymentMethods.length}</Text>
            <Text style={styles.statLabel}>Moyens de paiement</Text>
          </SurfaceCard>
          <SurfaceCard style={styles.statCard} tone="soft" delay={180}>
            <Text style={styles.statValue}>{walletBalance}</Text>
            <Text style={styles.statLabel}>Solde (XOF)</Text>
          </SurfaceCard>
        </View>
      )}

      {token && (
        <View style={styles.quickActions}>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('Messages')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.slate700} />
            <Text style={styles.actionText}>Messagerie</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('Trips')}>
            <Ionicons name="car-outline" size={18} color={colors.slate700} />
            <Text style={styles.actionText}>Mes trajets</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('Favorites')}>
            <Ionicons name="heart-outline" size={18} color={colors.slate700} />
            <Text style={styles.actionText}>Favoris</Text>
            <Text style={styles.actionMeta}>{favoritesCount} trajet(s)</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={handleEnablePush} disabled={pushBusy}>
            <Ionicons name="notifications-outline" size={18} color={colors.slate700} />
            <Text style={styles.actionText}>Notifications</Text>
          </Pressable>
        </View>
      )}

      <SurfaceCard style={styles.card} delay={180}>
        <SectionHeader icon="pulse-outline" title="Preferences du compte" meta={statsLabel} />
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Notifications</Text>
          <Text style={styles.preferenceValue}>{pushStatus}</Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Apparence</Text>
          <Text style={styles.preferenceValue}>
            {appSettings.appearance === 'dark'
              ? 'Sombre'
              : appSettings.appearance === 'light'
                ? 'Clair'
                : 'Système'}
          </Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Mode trajet</Text>
          <Text style={styles.preferenceValue}>{isCompany ? 'Entreprise' : 'Particulier'}</Text>
        </View>
        {loadingData && token ? (
          <View style={styles.skeletonList}>
            <SkeletonBlock width="55%" height={12} />
            <SkeletonBlock width="40%" height={12} />
          </View>
        ) : null}
      </SurfaceCard>

      {token && (
        <SurfaceCard style={styles.card} delay={188}>
          <SectionHeader icon="settings-outline" title="Parametres de l'application" meta="Experience & accessibilite" />
          <View style={styles.appSettingRow}>
            <Text style={styles.preferenceLabel}>Theme de l'app</Text>
            <View style={styles.docTypeRow}>
              {[
                { id: 'system', label: 'Système' },
                { id: 'light', label: 'Clair' },
                { id: 'dark', label: 'Sombre' },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setAppSetting('appearance', option.id)}
                  style={[
                    styles.docTypeChip,
                    appSettings.appearance === option.id && styles.docTypeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.docTypeChipText,
                      appSettings.appearance === option.id && styles.docTypeChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Animations</Text>
            <Pressable
              onPress={() => setAppSetting('autoPlayAnimations', !appSettings.autoPlayAnimations)}
              style={appSettings.autoPlayAnimations ? styles.badgeSuccess : styles.badgeWarning}
            >
              <Text style={appSettings.autoPlayAnimations ? styles.badgeTextSuccess : styles.badgeTextWarning}>
                {appSettings.autoPlayAnimations ? 'Activees' : 'Reduites'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Retour haptique</Text>
            <Pressable
              onPress={() => setAppSetting('haptics', !appSettings.haptics)}
              style={appSettings.haptics ? styles.badgeSuccess : styles.badgeWarning}
            >
              <Text style={appSettings.haptics ? styles.badgeTextSuccess : styles.badgeTextWarning}>
                {appSettings.haptics ? 'Active' : 'Desactive'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Cartes compactes</Text>
            <Pressable
              onPress={() => setAppSetting('compactCards', !appSettings.compactCards)}
              style={appSettings.compactCards ? styles.badgeSuccess : styles.badge}
            >
              <Text style={appSettings.compactCards ? styles.badgeTextSuccess : styles.badgeText}>
                {appSettings.compactCards ? 'Oui' : 'Non'}
              </Text>
            </Pressable>
          </View>
          <PrimaryButton
            label="Reinitialiser les parametres"
            variant="ghost"
            onPress={async () => {
              const defaults = {
                appearance: 'system',
                haptics: true,
                compactCards: false,
                autoPlayAnimations: true,
              };
              setAppSettings(defaults);
              await persistAppSettings(defaults);
              showToast('Paramètres réinitialisés.', 'success');
            }}
          />
        </SurfaceCard>
      )}

      {token && (
        <SurfaceCard style={styles.card} delay={195}>
          <SectionHeader icon="card-outline" title="Paiements" meta="Portefeuille & moyens" />
          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletLabel}>Solde disponible</Text>
              <Text style={styles.walletValue}>{walletBalance} XOF</Text>
            </View>
            <View style={styles.walletBadge}>
              <Text style={styles.walletBadgeText}>{paymentMethods.length} moyen(x)</Text>
            </View>
          </View>

          <View style={styles.paymentList}>
            {paymentMethods.length === 0 ? (
              <Text style={styles.helperText}>Aucun moyen de paiement enregistre.</Text>
            ) : null}
            {paymentMethods.map((method) => (
              <Pressable
                key={method.id}
                onPress={async () => {
                  if (!token || paymentBusy) return;
                  setPaymentBusy(true);
                  try {
                    await setDefaultPaymentMethod(token, method.id);
                    const updated = paymentMethods.map((item) => ({
                      ...item,
                      isDefault: item.id === method.id,
                    }));
                    setPaymentMethods(updated);
                    showToast('Moyen par defaut mis a jour.', 'success');
                  } catch {
                    showToast('Impossible de definir par defaut.', 'error');
                  } finally {
                    setPaymentBusy(false);
                  }
                }}
                style={[styles.paymentItem, method.isDefault && styles.paymentItemActive]}
              >
                <View>
                  <Text style={styles.paymentTitle}>
                    {method.label || method.provider || method.type}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    {method.type === 'CARD' && method.last4 ? `**** ${method.last4}` : method.type}
                  </Text>
                </View>
                <View style={method.isDefault ? styles.defaultBadge : styles.defaultBadgeInactive}>
                  <Text style={method.isDefault ? styles.defaultBadgeText : styles.defaultBadgeTextInactive}>
                    {method.isDefault ? 'Par defaut' : 'Definir'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.transactionList}>
            <Text style={styles.sectionLabel}>Historique recent</Text>
            {walletTransactions.length === 0 ? (
              <Text style={styles.helperText}>Aucune transaction recente.</Text>
            ) : null}
            {walletTransactions.slice(0, 5).map((tx) => (
              <View key={tx.id} style={styles.transactionItem}>
                <View>
                  <Text style={styles.transactionTitle}>{tx.type === 'CREDIT' ? 'Credit' : 'Debit'}</Text>
                  <Text style={styles.transactionMeta}>{tx.reason || 'Operation wallet'}</Text>
                </View>
                <Text style={styles.transactionAmount}>
                  {tx.type === 'CREDIT' ? '+' : '-'}
                  {tx.amount} XOF
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      )}

      {token && (
        <SurfaceCard style={styles.card} delay={210}>
          <SectionHeader icon="create-outline" title="Edition du profil" meta="Informations publiques" />
          <View style={styles.photoRow}>
            <PrimaryButton label="Prendre une photo" variant="ghost" onPress={handleCapturePhoto} />
            <PrimaryButton label="Galerie" variant="ghost" onPress={handlePickPhoto} />
            {photoPreview || photoUrl ? (
              <PrimaryButton
                label="Supprimer"
                variant="ghost"
                onPress={async () => {
                  if (!token) return;
                  setProfileBusy(true);
                  try {
                    const updated = await deleteProfilePhoto(token);
                    applyAuth({ token, account: updated });
                    setPhotoPreview('');
                    setPhotoAsset(null);
                    setPhotoUrl('');
                    showToast('Photo supprimee.', 'success');
                  } catch (err) {
                    showToast('Impossible de supprimer.', 'error');
                  } finally {
                    setProfileBusy(false);
                  }
                }}
              />
            ) : null}
          </View>
          {isCompany ? (
            <>
              <InputField
                label="Nom de l'entreprise"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="KariGo Transport"
                error={profileErrors.companyName}
              />
              <InputField
                label="Immatriculation"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                placeholder="RC-123456"
                error={profileErrors.registrationNumber}
              />
              <InputField
                label="Contact principal"
                value={contactName}
                onChangeText={setContactName}
                placeholder="Kouadio Aya"
              />
              <InputField
                label="Telephone contact"
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+225 01 23 45 67 89"
                keyboardType="phone-pad"
                error={profileErrors.contactPhone}
              />
            </>
          ) : (
            <>
              <InputField
                label="Nom complet"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Kouadio Aya"
                error={profileErrors.fullName}
              />
              <InputField
                label="Telephone"
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+225 01 23 45 67 89"
                keyboardType="phone-pad"
                error={profileErrors.contactPhone}
              />
              <InputField
                label="Preferences de confort (separees par une virgule)"
                value={comfortText}
                onChangeText={setComfortText}
                placeholder="Musique douce, Pause cafe, Climatisation legere"
                hint="Jusqu a 10 preferences."
              />
            </>
          )}
          <View style={styles.questionSection}>
            <Text style={styles.sectionLabel}>Profil voyageur</Text>
            <Text style={styles.helperText}>
              Reponds a ces questions pour afficher des preferences claires.
            </Text>
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
          </View>
          <InputField
            label="Accroche affichee sur ton profil"
            value={tagline}
            onChangeText={setTagline}
            placeholder="Exemple: Conducteur attentif - Climatisation et playlist sur-mesure."
            hint="Affichee sur ta fiche publique et dans les conversations."
            error={profileErrors.tagline}
          />
          <PrimaryButton
            label="Sauvegarder"
            disabled={profileBusy}
            onPress={async () => {
              if (!token) return;
              const nextErrors = validateProfile();
              setProfileErrors(nextErrors);
              if (Object.keys(nextErrors).length) return;
              setProfileBusy(true);
              try {
                let currentAccount = account;
                if (photoAsset) {
                  const uploaded = await uploadProfilePhoto(token, photoAsset);
                  currentAccount = uploaded;
                  setPhotoUrl(uploaded.profilePhotoUrl || '');
                  setPhotoPreview('');
                  setPhotoAsset(null);
                }
                const payload = {
                  tagline: tagline || undefined,
                  profilePhotoUrl: photoUrl || undefined,
                  removeProfilePhoto: !photoUrl,
                  profileAnswers: normalizedProfileAnswers,
                };
                let updated;
                if (isCompany) {
                  updated = await updateCompanyProfile(token, {
                    ...payload,
                    companyName: companyName || undefined,
                    registrationNumber: registrationNumber || undefined,
                    contactName: contactName || undefined,
                    contactPhone: contactPhone || undefined,
                  });
                } else {
                  updated = await updateIndividualProfile(token, {
                    ...payload,
                    fullName: fullName || undefined,
                    contactPhone: contactPhone || undefined,
                    comfortPreferences: comfortPreferences.length ? comfortPreferences : undefined,
                  });
                }
                applyAuth({ token, account: updated || currentAccount });
                setProfileErrors({});
                showToast('Profil mis a jour.', 'success');
              } catch (err) {
                showToast('Impossible de mettre a jour.', 'error');
              } finally {
                setProfileBusy(false);
              }
            }}
          />
        </SurfaceCard>
      )}

      {token && isCompany && (
        <SurfaceCard style={styles.card} delay={225}>
          <SectionHeader icon="shield-checkmark-outline" title="Verification entreprise" meta="Documents legaux" />
          <Text style={styles.helperText}>
            Charge un document pour afficher le badge entreprise verifiee.
          </Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                companyVerification?.verifiedAt ? styles.badgeSuccess : styles.badgeWarning,
              ]}
            >
              <Text style={styles.badgeText}>
                {companyVerification?.verifiedAt ? 'Entreprise verifiee' : 'Verification en attente'}
              </Text>
            </View>
            <Text style={styles.helperText}>
              {companyVerification?.verifiedAt
                ? `Valide le ${formatShortDate(companyVerification.verifiedAt)}`
                : 'Validation sous 24-48h'}
            </Text>
          </View>
          <View style={styles.docTypeRow}>
            {['legal', 'registration', 'insurance'].map((value) => (
              <Pressable
                key={value}
                onPress={() => setCompanyDocType(value)}
                style={[
                  styles.docTypeChip,
                  companyDocType === value && styles.docTypeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.docTypeChipText,
                    companyDocType === value && styles.docTypeChipTextActive,
                  ]}
                >
                  {value === 'legal' ? 'Legal' : value === 'registration' ? 'Immatriculation' : 'Assurance'}
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            label={companyDocBusy ? 'Envoi...' : 'Ajouter un document'}
            variant="ghost"
            onPress={handleUploadCompanyDoc}
            disabled={companyDocBusy}
          />
          {companyVerification?.documents?.length ? (
            <View style={styles.docList}>
              {companyVerification.documents.map((doc) => (
                <View key={doc.id} style={styles.docItem}>
                  <Text style={styles.docTitle}>{doc.type || 'Document'}</Text>
                  <Text style={styles.docMeta}>{doc.status}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </SurfaceCard>
      )}

      {token && (
        <SurfaceCard style={styles.card} delay={240}>
          <SectionHeader icon="mail-outline" title="Verification email" />
          <Text style={styles.helperText}>
            Un code sera envoye a {account?.email || 'ton email'}. Entre-le pour verifier ton compte.
          </Text>
          <PrimaryButton
            label="Recevoir un code"
            variant="ghost"
            disabled={otpBusy}
            onPress={async () => {
              if (!account?.email) {
                showToast('Email manquant.', 'error');
                return;
              }
              setOtpBusy(true);
              try {
                await requestGmailOtp({ email: account.email });
                showToast('Code envoye.', 'success');
              } catch (err) {
                showToast('Impossible d envoyer le code.', 'error');
              } finally {
                setOtpBusy(false);
              }
            }}
          />
          <InputField
            label="Code de verification"
            value={otpCode}
            onFocus={() => tryAutofillOtp(setOtpCode)}
            onChangeText={(value) => setOtpCode(sanitizeOtpInput(value))}
            placeholder="123456"
            keyboardType="number-pad"
          />
          <PrimaryButton
            label="Verifier"
            disabled={otpBusy}
            onPress={async () => {
              if (!account?.email) {
                showToast('Email manquant.', 'error');
                return;
              }
              if (!otpCode.trim()) {
                showToast('Code invalide.', 'error');
                return;
              }
              setOtpBusy(true);
              try {
                const auth = await verifyGmailOtp({ email: account.email, code: otpCode.trim() });
                applyAuth(auth);
                setOtpCode('');
                showToast('Email verifie.', 'success');
              } catch (err) {
                showToast('Verification impossible.', 'error');
              } finally {
                setOtpBusy(false);
              }
            }}
          />
        </SurfaceCard>
      )}

      {token && (
        <SurfaceCard style={styles.card} delay={270}>
          <SectionHeader icon="call-outline" title="Verification telephone" />
          <Text style={styles.helperText}>
            Ajoute un numero valide pour rassurer les autres passagers. Cela ne bloque pas l acces.
          </Text>
          <InputField
            label="Numero de telephone"
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+225 01 23 45 67 89"
            keyboardType="phone-pad"
          />
          <PrimaryButton
            label="Envoyer un code"
            variant="ghost"
            disabled={phoneOtpBusy}
            onPress={async () => {
              if (!token || !contactPhone.trim()) {
                showToast('Numero manquant.', 'error');
                return;
              }
              setPhoneOtpBusy(true);
              try {
                await requestPhoneOtp(token, { phone: contactPhone.trim() });
                showToast('Code SMS envoye.', 'success');
              } catch (err) {
                showToast('Impossible d envoyer le code.', 'error');
              } finally {
                setPhoneOtpBusy(false);
              }
            }}
          />
          <InputField
            label="Code SMS"
            value={phoneOtpCode}
            onFocus={() => tryAutofillOtp(setPhoneOtpCode)}
            onChangeText={(value) => setPhoneOtpCode(sanitizeOtpInput(value))}
            placeholder="123456"
            keyboardType="number-pad"
          />
          <PrimaryButton
            label="Verifier le numero"
            disabled={phoneOtpBusy}
            onPress={async () => {
              if (!token) return;
              if (!contactPhone.trim() || !phoneOtpCode.trim()) {
                showToast('Code invalide.', 'error');
                return;
              }
              setPhoneOtpBusy(true);
              try {
                const updated = await verifyPhoneOtp(token, {
                  phone: contactPhone.trim(),
                  code: phoneOtpCode.trim(),
                });
                applyAuth({ token, account: updated });
                setPhoneOtpCode('');
                showToast('Telephone verifie.', 'success');
              } catch (err) {
                showToast('Verification impossible.', 'error');
              } finally {
                setPhoneOtpBusy(false);
              }
            }}
          />
        </SurfaceCard>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Activer les notifications" onPress={handleEnablePush} disabled={pushBusy} />
        <PrimaryButton label="Envoyer un test" variant="ghost" onPress={handleTestPush} disabled={pushBusy} />
        {token ? (
          <>
            <PrimaryButton label="Se deconnecter" onPress={logout} />
          </>
        ) : guest ? (
          <PrimaryButton label="Quitter le mode visiteur" onPress={logout} />
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
  header: {
    gap: 4,
  },
  profileCard: {
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.slate600,
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  meta: {
    fontSize: 13,
    color: colors.slate500,
  },
  tagline: {
    fontSize: 12,
    color: colors.slate600,
  },
  infoGrid: {
    marginTop: 10,
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate900,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
    textTransform: 'uppercase',
  },
  actionMeta: {
    fontSize: 11,
    color: colors.slate500,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate900,
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    gap: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preferenceLabel: {
    fontSize: 13,
    color: colors.slate500,
  },
  preferenceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate900,
  },
  appSettingRow: {
    gap: 8,
  },
  skeletonList: {
    gap: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.slate600,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 12,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  walletValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  walletBadge: {
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  walletBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate600,
  },
  paymentList: {
    gap: spacing.sm,
  },
  paymentItem: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentItemActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky50,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate900,
  },
  paymentMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
  defaultBadge: {
    backgroundColor: colors.emerald100,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeInactive: {
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.emerald500,
  },
  defaultBadgeTextInactive: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate600,
  },
  transactionList: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate900,
  },
  transactionMeta: {
    fontSize: 11,
    color: colors.slate500,
  },
  transactionAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate900,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeSuccess: {
    backgroundColor: colors.emerald100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeWarning: {
    backgroundColor: colors.amber100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate600,
  },
  badgeTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emerald500,
  },
  badgeTextWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.amber700,
  },
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.white,
  },
  profileActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  questionSection: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  questionList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
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
  docTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
  },
  docTypeChipActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  docTypeChipText: {
    fontSize: 12,
    color: colors.slate600,
    fontWeight: '600',
  },
  docTypeChipTextActive: {
    color: colors.sky700,
  },
  docList: {
    gap: 6,
  },
  docItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate900,
  },
  docMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
});
