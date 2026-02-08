import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { loadPreferences, savePreferences } from '../preferences';
import { useToast } from '../ui/ToastContext';

const DEFAULT_SETTINGS = {
  appearance: 'system',
  haptics: true,
  compactCards: false,
  autoPlayAnimations: true,
};

export function AppSettingsScreen({ navigation }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    loadPreferences().then((prefs) => {
      if (!active) return;
      setSettings({
        appearance: prefs?.appSettings?.appearance || 'system',
        haptics: prefs?.appSettings?.haptics ?? true,
        compactCards: prefs?.appSettings?.compactCards ?? false,
        autoPlayAnimations: prefs?.appSettings?.autoPlayAnimations ?? true,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = async (nextSettings) => {
    const current = await loadPreferences();
    await savePreferences({
      ...current,
      appSettings: {
        ...(current.appSettings || {}),
        ...nextSettings,
      },
    });
  };

  const setSetting = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await persist(next);
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await persist(DEFAULT_SETTINGS);
    showToast('Parametres reinitialises.', 'success');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Parametres</Text>
        <Text style={textStyles.subtitle}>Personnalise l'app selon tes preferences.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Apparence" icon="color-palette-outline" />
        <View style={styles.chips}>
          {[
            { id: 'system', label: 'Systeme' },
            { id: 'light', label: 'Clair' },
            { id: 'dark', label: 'Sombre' },
          ].map((item) => {
            const active = settings.appearance === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSetting('appearance', item.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Comportement" icon="options-outline" />
        <View style={styles.toggleColumn}>
          <Pressable
            onPress={() => setSetting('autoPlayAnimations', !settings.autoPlayAnimations)}
            style={[styles.toggle, settings.autoPlayAnimations && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, settings.autoPlayAnimations && styles.toggleTextOn]}>
              Animations automatiques
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSetting('haptics', !settings.haptics)}
            style={[styles.toggle, settings.haptics && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, settings.haptics && styles.toggleTextOn]}>
              Vibrations / retours haptiques
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSetting('compactCards', !settings.compactCards)}
            style={[styles.toggle, settings.compactCards && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, settings.compactCards && styles.toggleTextOn]}>
              Cartes compactes
            </Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Autres preferences" icon="navigate-outline" />
        <View style={styles.toggleColumn}>
          <PrimaryRowButton label="Notifications" onPress={() => navigation.navigate('NotificationSettings')} />
          <PrimaryRowButton label="Centre preferences" onPress={() => navigation.navigate('PreferencesHome')} />
        </View>
      </SurfaceCard>

      <Pressable onPress={resetSettings} style={styles.resetButton}>
        <Text style={styles.resetText}>Reinitialiser les parametres</Text>
      </Pressable>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.sky500,
    backgroundColor: colors.sky100,
  },
  chipText: {
    fontSize: 13,
    color: colors.slate600,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.sky700,
  },
  toggleColumn: {
    gap: spacing.sm,
  },
  toggle: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleOn: {
    borderColor: colors.emerald500,
    backgroundColor: colors.emerald50,
  },
  toggleText: {
    fontSize: 13,
    color: colors.slate700,
    fontWeight: '600',
  },
  toggleTextOn: {
    color: colors.emerald600,
  },
  resetButton: {
    alignSelf: 'center',
  },
  resetText: {
    color: colors.rose600,
    fontWeight: '600',
  },
  rowButton: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowButtonText: {
    fontSize: 13,
    color: colors.slate700,
    fontWeight: '600',
  },
});

function PrimaryRowButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.rowButton}>
      <Text style={styles.rowButtonText}>{label}</Text>
    </Pressable>
  );
}
