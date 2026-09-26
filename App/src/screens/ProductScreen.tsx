import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { Product } from '../types/Product';
import { useTranslation, formatNumber, type TranslateFn } from '../i18n/useTranslation';
import type { SupportedLanguage } from '../i18n/translations';
import { allergenList } from '../i18n/allergenLabels';
import { useCatalogStore } from '../store/catalogStore';
import { displayProductName } from '../domain/product/productName';
import { useProductDetails, type FoundProduct } from '../features/product/useProductDetails';
import { useRobotoffInsights } from '../features/product/useRobotoffInsights';
import { FindingsList } from '../features/product/FindingsList';
import { IngredientsSection } from '../features/product/IngredientsSection';
import { SkeletonLoadingScreen } from '../components/SkeletonLoading';
import { Accordion } from '../components/Accordion';
import { NutritionTable } from '../components/NutritionTable';
import { ImageGallery } from '../components/ImageGallery';
import { Button, Card, EmptyState, IconButton, ScreenHeader, SectionTitle } from '../ui/components';
import { StatusHero } from '../ui/status';
import { colors, radius, spacing, typography } from '../ui/theme';

type ProductParams = { ean?: string; source?: string };

export default function ProductScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<ProductParams>();
  const ean = params.ean;
  const { state, reload, refreshLocal } = useProductDetails(
    ean,
    params.source === 'scan' || params.source === 'recent' ? params.source : 'view'
  );

  // Coming back from the edit screen: show the saved changes without a network call.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refreshLocal();
      focusedOnce.current = true;
    }, [refreshLocal])
  );

  const openEditor = useCallback(() => {
    if (ean) router.push({ pathname: '/edit/[ean]', params: { ean } });
  }, [ean, router]);

  if (state.phase === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader onBack={() => router.back()} backLabel={t('common.back')} />
        <SkeletonLoadingScreen label={t('common.loading')} />
      </View>
    );
  }

  if (state.phase === 'failed') {
    const content = {
      offline: {
        icon: 'cloud-offline-outline' as const,
        title: t('product.error.offlineTitle'),
        body: t('product.error.offlineBody'),
      },
      'not-found': {
        icon: 'help-buoy-outline' as const,
        title: t('product.error.notFoundTitle'),
        body: t('product.error.notFoundBody'),
      },
      error: {
        icon: 'warning-outline' as const,
        title: t('product.error.genericTitle'),
        body: t('product.error.genericBody'),
      },
    }[state.reason];

    return (
      <View style={styles.container}>
        <ScreenHeader onBack={() => router.back()} backLabel={t('common.back')} />
        <EmptyState
          icon={content.icon}
          title={content.title}
          message={`${content.body}\n${ean ? t('product.ean', { ean }) : ''}`.trim()}
          action={
            state.reason === 'not-found' ? (
              <Button title={t('product.addProduct')} icon="create-outline" onPress={openEditor} />
            ) : (
              <Button title={t('common.retry')} icon="refresh" onPress={() => void reload()} />
            )
          }
        />
      </View>
    );
  }

  return <ProductDetails data={state.data} t={t} language={language} onEdit={openEditor} />;
}

function ProductDetails({
  data,
  t,
  language,
  onEdit,
}: {
  data: FoundProduct;
  t: TranslateFn;
  language: SupportedLanguage;
  onEdit: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { product, rating, record } = data;
  const favorites = useCatalogStore((s) => s.favorites);
  const toggleFavorite = useCatalogStore((s) => s.toggleFavorite);
  const productId = record?.id;
  const isFavorite = productId !== undefined && favorites.some((f) => f.id === productId);
  const hasIngredients = Boolean(product.ingredientsText?.trim());
  const { insights, loading: insightsLoading } = useRobotoffInsights(
    product.ean,
    data.source !== 'cache',
    language
  );

  const sourceNote = data.networkFailed
    ? t('product.source.networkFailed')
    : data.source === 'cache'
      ? t('product.source.offline')
      : undefined;
  const staleNote = data.isStale && data.source === 'cache' ? t('product.source.stale') : undefined;
  const footnote = [sourceNote, staleNote].filter(Boolean).join(' · ') || undefined;

  const gallery = useMemo(() => galleryImages(product, t), [product, t]);

  const onToggleFavorite = async () => {
    if (productId === undefined) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await toggleFavorite(productId);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        onBack={() => router.back()}
        backLabel={t('common.back')}
        right={
          <>
            <IconButton icon="create-outline" label={t('a11y.editProduct')} onPress={onEdit} />
            <IconButton
              icon={isFavorite ? 'star' : 'star-outline'}
              color={isFavorite ? colors.favorite : colors.text}
              label={t(isFavorite ? 'a11y.favoriteRemove' : 'a11y.favoriteAdd')}
              selected={isFavorite}
              disabled={productId === undefined}
              onPress={() => void onToggleFavorite()}
              testID="favorite-toggle"
            />
          </>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <View style={styles.identity}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.thumbnail}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <View style={styles.identityText}>
            <Text style={styles.name} accessibilityRole="header">
              {displayProductName(product.name, t('product.unknown'))}
            </Text>
            {product.brand || product.quantity ? (
              <Text style={styles.brand}>
                {[product.brand, product.quantity].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.ean}>{t('product.ean', { ean: product.ean })}</Text>
            {record?.edited_at ? (
              <Text style={styles.edited}>{t('product.editedLocally')}</Text>
            ) : null}
          </View>
        </View>

        <StatusHero status={rating.status} reasons={rating.reasons} t={t} footnote={footnote} />

        {!hasIngredients && (
          <Card style={styles.missingCard}>
            <Text style={styles.missingTitle}>{t('product.missingIngredients.title')}</Text>
            <Text style={styles.missingBody}>{t('product.missingIngredients.body')}</Text>
            <Button
              title={t('product.missingIngredients.action')}
              icon="camera-outline"
              onPress={onEdit}
              style={styles.missingButton}
            />
          </Card>
        )}

        <ScoreRow product={product} t={t} />

        {rating.redFlags.length > 0 && (
          <View>
            <SectionTitle>
              {t('product.redFlagsCount', { count: rating.redFlags.length })}
            </SectionTitle>
            <FindingsList findings={rating.redFlags} t={t} language={language} />
          </View>
        )}

        {product.allergensTags?.length || product.traces ? (
          <View>
            <SectionTitle>{t('product.allergens')}</SectionTitle>
            <Card style={styles.allergens}>
              {product.allergensTags && product.allergensTags.length > 0 ? (
                <Text style={styles.bodyText}>
                  <Text style={styles.bold}>{t('product.contains')}: </Text>
                  {allergenList(product.allergensTags, t)}
                </Text>
              ) : null}
              {product.traces ? (
                <Text style={styles.bodyText}>
                  <Text style={styles.bold}>{t('product.traces')}: </Text>
                  {allergenList(product.traces, t)}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        {hasIngredients && <IngredientsSection product={product} t={t} language={language} />}

        {product.nutriments && <NutritionSummary product={product} t={t} language={language} />}

        {insights.length > 0 || insightsLoading ? (
          <View>
            <SectionTitle>{t('product.aiInsights')}</SectionTitle>
            <Text style={styles.hint}>{t('product.aiInsightsHint')}</Text>
            {insightsLoading && insights.length === 0 ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={styles.insights}>
                {insights.map((insight) => (
                  <Card key={insight.id} style={styles.insight}>
                    <Text style={styles.bold}>{insight.value}</Text>
                    <Text style={styles.hint}>{insight.description}</Text>
                  </Card>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {gallery.length > 0 && (
          <View>
            <SectionTitle>{t('product.images')}</SectionTitle>
            <ImageGallery images={gallery} />
          </View>
        )}

        {product.origins || product.manufacturingPlaces || product.stores ? (
          <Accordion
            items={[
              {
                title: t('product.moreInfo'),
                content: (
                  <View style={styles.infoRows}>
                    <InfoRow label={t('product.origin')} value={product.origins} />
                    <InfoRow
                      label={t('product.manufacturingPlace')}
                      value={product.manufacturingPlaces}
                    />
                    <InfoRow label={t('product.stores')} value={product.stores} />
                  </View>
                ),
              },
            ]}
          />
        ) : null}

        <Text style={styles.disclaimer}>{t('product.disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

function ScoreRow({ product, t }: { product: Product; t: TranslateFn }) {
  const grade = product.nutritionGrades?.toLowerCase();
  const nova = product.novaScore;
  const novaText = nova ? t(`nova.${nova}`) : t('nova.unknown');
  return (
    <View style={styles.scoreRow}>
      {grade && colors.nutriScore[grade] ? (
        <View
          style={[styles.scoreTile, { backgroundColor: colors.nutriScore[grade] }]}
          accessible
          accessibilityLabel={`Nutri-Score ${grade.toUpperCase()}`}
        >
          <Text style={[styles.scoreValue, { color: colors.onNutriScore[grade] }]}>
            {grade.toUpperCase()}
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.onNutriScore[grade] }]}>
            Nutri-Score
          </Text>
        </View>
      ) : null}
      <View
        style={[styles.scoreTile, styles.novaTile]}
        accessible
        accessibilityLabel={`NOVA ${nova ?? '?'}: ${novaText}`}
      >
        <View
          style={[styles.novaBadge, { backgroundColor: nova ? colors.nova[nova] : colors.border }]}
        >
          <Text style={styles.novaNumber}>{nova ?? '?'}</Text>
        </View>
        <View style={styles.novaText}>
          <Text style={styles.scoreCaption}>NOVA</Text>
          <Text style={styles.bodyText}>{novaText}</Text>
        </View>
      </View>
    </View>
  );
}

function NutritionSummary({
  product,
  t,
  language,
}: {
  product: Product;
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  const n = product.nutriments!;
  const cells: [string, number | undefined, string][] = [
    [t('product.calories'), n.energyKcal100g, 'kcal'],
    [t('product.fat'), n.fat100g, 'g'],
    [t('product.sugar'), n.sugars100g, 'g'],
    [t('product.salt'), n.salt100g, 'g'],
  ];
  return (
    <View>
      <SectionTitle>{`${t('product.nutrition')} · ${t('product.nutritionPer100g')}`}</SectionTitle>
      <View style={styles.nutritionRow}>
        {cells.map(([label, value, unit]) => {
          const shown = value != null ? formatNumber(value, language) : '–';
          return (
            <View
              key={label}
              style={styles.nutritionCell}
              accessible
              accessibilityLabel={`${label}: ${value != null ? `${shown} ${unit}` : shown}`}
            >
              <Text style={styles.nutritionValue}>
                {shown}
                {value != null ? <Text style={styles.nutritionUnit}> {unit}</Text> : null}
              </Text>
              <Text style={styles.nutritionLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      <Accordion
        items={[
          {
            title: t('product.nutritionTable'),
            content: <NutritionTable nutriments={n} servingSize={product.servingSize} />,
          },
        ]}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function galleryImages(product: Product, t: TranslateFn) {
  return [
    { uri: product.imageUrl, label: t('product.front') },
    { uri: product.imageIngredientsUrl, label: t('product.ingredientsImg') },
    { uri: product.imageNutritionUrl, label: t('product.nutritionImg') },
    { uri: product.imagePackagingUrl, label: t('product.packaging') },
  ].filter((image): image is { uri: string; label: string } => Boolean(image.uri));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  identityText: { flex: 1, gap: 2 },
  name: { ...typography.title, color: colors.text },
  brand: { ...typography.body, color: colors.textSecondary },
  ean: { ...typography.caption, color: colors.textMuted },
  edited: { ...typography.caption, color: colors.info },
  missingCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong },
  missingTitle: { ...typography.subtitle, color: colors.text },
  missingBody: { ...typography.body, color: colors.textSecondary },
  missingButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  scoreRow: { flexDirection: 'row', gap: spacing.md },
  scoreTile: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { ...typography.headline, color: colors.text },
  scoreLabel: { ...typography.caption, color: colors.text, fontWeight: '700' },
  novaTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  novaBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novaNumber: { ...typography.title, color: colors.onNova },
  novaText: { flex: 1 },
  scoreCaption: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  allergens: { gap: spacing.sm },
  bodyText: { ...typography.body, color: colors.textSecondary },
  bold: { ...typography.bodyStrong, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  insights: { gap: spacing.sm },
  insight: { paddingVertical: spacing.md },
  nutritionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  nutritionCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  nutritionValue: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  nutritionUnit: { ...typography.caption, color: colors.textMuted },
  nutritionLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  infoRows: { gap: spacing.sm },
  infoRow: { gap: 2 },
  infoLabel: { ...typography.caption, color: colors.textMuted },
  infoValue: { ...typography.body, color: colors.text },
  disclaimer: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
