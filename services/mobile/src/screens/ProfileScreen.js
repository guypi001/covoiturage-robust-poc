import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { colors, radius, spacing, text } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { InputField } from '../components/InputField';
import { registerPushToken, sendTestNotification } from '../api/notifications';
import { getMyBookings, getMyPaymentMethods } from '../api/bff';
import { useAuth } from '../auth';
import {
  requestGmailOtp,
  updateCompanyProfile,
  updateIndividualProfile,
  deleteProfilePhoto,
  uploadProfilePhoto,
  verifyGmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '../api/identity';
import { useToast } from '../ui/ToastContext';
import { resolveAssetUrl } from '../config';
import { getDisplayName } from '../utils/name';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonBlock } from '../components/Skeleton';
import { Banner } from '../components/Banner';

export function ProfileScreen({ navigation }) {
  const { token, account, guest, login, logout, refreshProfile, applyAuth } = useAuth();
  const { showToast } = useToast();
  const [pushStatus, setPushStatus] = useState('Notifications desactivees');
  const [pushBusy, setPushBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
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

  const isCompany = account?.type === 'COMPANY';
  const typeLabel = isCompany ? 'Entreprise' : 'Particulier';
  const statusLabel =
    account?.status === 'ACTIVE' ? 'Actif' : account?.status === 'SUSPENDED' ? 'Suspendu' : 'Inconnu';
  const roleLabel = account?.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur';
  const phoneVerified = Boolean(account?.phoneVerifiedAt);

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
  }, [account]);

  const ownerId = account?.id || 'demo-user';
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const profileLabel = useMemo(() => getDisplayName(account), [account]);

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
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
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
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
    const fileType = asset.mimeType || 'image/jpeg';
    setPhotoPreview(asset.uri);
    setPhotoAsset({
      uri: asset.uri,
      name: fileName,
      type: fileType,
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      setLoadingData(true);
      try {
        await refreshProfile();
        const [bookingRes, paymentRes] = await Promise.all([
          getMyBookings(token),
          getMyPaymentMethods(token),
        ]);
        if (active) {
          setBookings(bookingRes?.data || bookingRes?.items || []);
          setPaymentMethods(Array.isArray(paymentRes) ? paymentRes : []);
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
  }, [token, refreshProfile]);

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

  const statsLabel = `${bookings.length} reservations · ${paymentMethods.length} moyens de paiement`;

  const comfortPreferences = comfortText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={text.title}>Personnalisation du profil</Text>
        <Text style={text.subtitle}>
          Mets a jour ta photo, tes preferences de confort et l experience affichee sur ton profil.
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
          <View style={styles.avatar}>
            {photoPreview || photoUrl ? (
              <Image source={{ uri: resolveAssetUrl(photoPreview || photoUrl) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{profileLabel.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{profileLabel}</Text>
            <Text style={styles.meta}>{typeLabel}</Text>
            <Text style={styles.meta}>{account?.email || ''}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>{statusLabel}</Text>
              <Text style={styles.tag}>{roleLabel}</Text>
              <Text style={styles.tag}>{isCompany ? 'Entreprise verifiee' : 'Conducteur verifie'}</Text>
              <Text style={phoneVerified ? styles.tagSuccess : styles.tagWarning}>
                {phoneVerified ? 'Telephone verifie' : 'Telephone non verifie'}
              </Text>
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
        </View>
      )}

      {token && (
        <View style={styles.quickActions}>
          <Pressable style={styles.actionPill} onPress={() => navigation.navigate('Messages')}>
            <Text style={styles.actionText}>Messagerie</Text>
          </Pressable>
          <Pressable style={styles.actionPill} onPress={() => navigation.navigate('Trips')}>
            <Text style={styles.actionText}>Mes trajets</Text>
          </Pressable>
          <Pressable style={styles.actionPill} onPress={handleEnablePush} disabled={pushBusy}>
            <Text style={styles.actionText}>Notifications</Text>
          </Pressable>
        </View>
      )}

      <SurfaceCard style={styles.card} delay={180}>
        <SectionHeader icon="pulse-outline" title="Apercu du compte" meta={statsLabel} />
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Notifications</Text>
          <Text style={styles.preferenceValue}>{pushStatus}</Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Theme</Text>
          <Text style={styles.preferenceValue}>Clair</Text>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Mode trajet</Text>
          <Text style={styles.preferenceValue}>Passager</Text>
        </View>
        {loadingData && token ? (
          <View style={styles.skeletonList}>
            <SkeletonBlock width="55%" height={12} />
            <SkeletonBlock width="40%" height={12} />
          </View>
        ) : null}
      </SurfaceCard>

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
            onChangeText={setOtpCode}
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
            onChangeText={setPhoneOtpCode}
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
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.sky600,
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: colors.emerald100,
    color: colors.emerald500,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tagWarning: {
    backgroundColor: colors.amber100,
    color: colors.amber700,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tagSuccess: {
    backgroundColor: colors.emerald100,
    color: colors.emerald600,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
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
  skeletonList: {
    gap: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.slate600,
  },
});
