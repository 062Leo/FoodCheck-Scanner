import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate, useTranslation } from '../i18n/useTranslation';
import type { Recall } from '../domain/recalls/recall';
import { useRecallStore } from '../store/recallStore';
import { openRecall } from '../features/recalls/RecallWarning';
import { Button, Card, ScreenHeader } from '../ui/components';
import { colors, spacing, typography } from '../ui/theme';

/** Current food warnings from lebensmittelwarnung.de, newest first. */
export default function RecallsScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useRecallStore((s) => s.visible);
  const recalls = useRecallStore((s) => s.recalls);

  useEffect(() => {
    void useRecallStore.getState().load();
  }, []);

  const renderItem = ({ item }: { item: Recall }) => {
    const date = formatDate(new Date(item.publishedAt).toISOString(), language);
    const product = [item.brand, item.productName].filter(Boolean).join(' · ');
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        {product && product !== item.title ? <Text style={styles.line}>{product}</Text> : null}
        {item.reason ? (
          <Text style={styles.line}>{t('recalls.reason', { reason: item.reason })}</Text>
        ) : null}
        {item.states.length > 0 ? (
          <Text style={styles.meta}>{t('recalls.states', { states: item.states.join(', ') })}</Text>
        ) : null}
        {date ? <Text style={styles.meta}>{t('recalls.published', { date })}</Text> : null}
        <Button
          title={t('recalls.open')}
          icon="open-outline"
          variant="secondary"
          onPress={() => openRecall(item.link)}
          accessibilityHint={t('recalls.openA11y', { title: item.title })}
          style={styles.button}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('recalls.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <FlatList
        data={visible ? recalls : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={10}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        ListHeaderComponent={<Text style={styles.source}>{t('recalls.source')}</Text>}
        ListEmptyComponent={<Text style={styles.meta}>{t('recalls.empty')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.xs },
  title: { ...typography.bodyStrong, color: colors.text },
  line: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  source: { ...typography.caption, color: colors.textSecondary },
  button: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
