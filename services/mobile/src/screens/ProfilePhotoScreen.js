import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, text as textStyles } from '../theme';
import { useAuth } from '../auth';
import { useToast } from '../ui/ToastContext';
import { deleteProfilePhoto, uploadProfilePhoto } from '../api/identity';
import { resolveAssetUrl } from '../config';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';

export function ProfilePhotoScreen({ navigation }) {
  const { token, account, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const currentPhoto = useMemo(() => {
    if (photoPreview) return photoPreview;
    if (account?.profilePhotoUrl) return resolveAssetUrl(account.profilePhotoUrl);
    return '';
  }, [account?.profilePhotoUrl, photoPreview]);

  const pickImage = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Autorisation photo requise.', 'error');
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
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
    setPhotoPreview(asset.uri);
    setPhotoAsset({
      uri: asset.uri,
      name: asset.fileName || `profile-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const savePhoto = async () => {
    if (!token || !photoAsset) return;
    setBusy(true);
    try {
      await uploadProfilePhoto(token, photoAsset);
      await refreshProfile();
      setPhotoAsset(null);
      setPhotoPreview('');
      showToast('Photo de profil mise a jour.', 'success');
    } catch {
      showToast('Impossible de mettre a jour la photo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await deleteProfilePhoto(token);
      await refreshProfile();
      setPhotoAsset(null);
      setPhotoPreview('');
      showToast('Photo supprimee.', 'success');
    } catch {
      showToast('Suppression impossible.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={textStyles.title}>Photo de profil</Text>
        <SurfaceCard style={styles.card} tone="soft">
          <Text style={styles.info}>Connecte-toi pour gerer ta photo de profil.</Text>
          <PrimaryButton label="Se connecter" onPress={() => navigation.navigate('ProfileDetails')} />
        </SurfaceCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Photo de profil</Text>
        <Text style={textStyles.subtitle}>Ajoute une photo claire pour rassurer les passagers.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Apercu" icon="image-outline" />
        <View style={styles.previewWrap}>
          {currentPhoto ? (
            <Image source={{ uri: currentPhoto }} style={styles.previewImage} />
          ) : (
            <View style={[styles.previewImage, styles.emptyPreview]}>
              <Text style={styles.emptyPreviewText}>Aucune photo</Text>
            </View>
          )}
        </View>
        <View style={styles.buttonColumn}>
          <PrimaryButton label="Importer depuis galerie" onPress={() => pickImage(false)} />
          <PrimaryButton label="Prendre une photo" variant="ghost" onPress={() => pickImage(true)} />
          <PrimaryButton
            label={busy ? 'Enregistrement...' : 'Enregistrer'}
            disabled={busy || !photoAsset}
            onPress={savePhoto}
          />
          <Pressable onPress={removePhoto} disabled={busy} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Supprimer la photo actuelle</Text>
          </Pressable>
        </View>
      </SurfaceCard>
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
  info: {
    fontSize: 14,
    color: colors.slate600,
  },
  previewWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  previewImage: {
    width: 132,
    height: 132,
    borderRadius: radius.full,
  },
  emptyPreview: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreviewText: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '600',
  },
  buttonColumn: {
    gap: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.xs,
    alignSelf: 'center',
  },
  deleteText: {
    color: colors.rose600,
    fontWeight: '600',
  },
});
