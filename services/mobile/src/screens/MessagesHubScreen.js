import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text as textStyles } from '../theme';
import { SurfaceCard } from '../components/SurfaceCard';
import { SectionHeader } from '../components/SectionHeader';
import { PrimaryButton } from '../components/PrimaryButton';

export function MessagesHubScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={textStyles.title}>Messagerie</Text>
        <Text style={textStyles.subtitle}>Centralise tes conversations avec conducteurs et passagers.</Text>
      </View>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Conversations" icon="chatbubble-ellipses-outline" />
        <View style={styles.column}>
          <PrimaryButton label="Boite de reception" onPress={() => navigation.navigate('MessagesInbox')} />
          <PrimaryButton label="Voir mes trajets" variant="ghost" onPress={() => navigation.navigate('Trips')} />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card} tone="soft">
        <SectionHeader title="Support" icon="help-circle-outline" />
        <PrimaryButton label="Aide messagerie" variant="secondary" onPress={() => navigation.navigate('HelpCenter')} />
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
  column: {
    gap: spacing.sm,
  },
});
