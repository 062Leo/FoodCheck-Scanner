import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import type { Product, ProductRecord } from '../types/Product';
import type { ScanResult } from '../types/ScanResult';
import type { AIInsightFinding } from '../types/Robotoff';
import { OpenFoodFactsClient } from '../infrastructure/api/OpenFoodFactsClient';
import { RobotoffClient } from '../infrastructure/api/RobotoffClient';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { ProductResolutionService } from '../infrastructure/resolution/ProductResolutionService';
import { LocalImageCache } from '../infrastructure/media/LocalImageCache';
import { useCatalogStore } from '../store/catalogStore';
import { useFilterStore } from '../store/filterStore';
import { RedFlagAnalyzer } from '../domain/analysis/RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../domain/analysis/NovaScoreEvaluator';
import { ProductRating } from '../domain/analysis/ProductRating';
import { ProductNormalizer, PRODUCT_DATA_VERSION } from '../domain/analysis/ProductNormalizer';
import { RobotoffInsightAnalyzer } from '../domain/analysis/RobotoffInsightAnalyzer';
import { TranslationRouter } from '../infrastructure/translation/TranslationRouter';
import { defaultRules } from '../domain/rules/defaultRules';
import { SkeletonLoadingScreen } from '../components/SkeletonLoading';
import { Accordion } from '../components/Accordion';
import { NutritionTable } from '../components/NutritionTable';
import { ImageGallery } from '../components/ImageGallery';

type ErrorType = 'offline' | 'not-found' | 'generic';
type DataSource = 'off' | 'local';

const NUTRI_SCORE_COLORS: Record<string, string> = {
  a: '#038141',
  b: '#85BB2F',
  c: '#FECB02',
  d: '#EE8100',
  e: '#E63E11',
};

const NOVA_COLORS: Record<number, string> = {
  1: '#4CAF50',
  2: '#8BC34A',
  3: '#FFC107',
  4: '#F44336',
};

function buildProductFromRecord(record: ProductRecord): Product {
  return ProductNormalizer.denormalize(record.raw_json || '', {
    ean: record.ean,
    name: record.name,
    brand: record.brands,
    ingredientsText: record.ingredients,
    novaScore: record.nova_score ?? undefined,
  });
}

export default function ProductScreen() {
  const params = useLocalSearchParams<{ ean: string; fromCache?: string; cachedData?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: ErrorType; message: string } | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [productId, setProductId] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [showMissingDataModal, setShowMissingDataModal] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('off');
  const [offProduct, setOffProduct] = useState<Product | null>(null);
  const [localProduct, setLocalProduct] = useState<Product | null>(null);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsightFinding[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [translations, setTranslations] = useState<
    Record<string, { loading: boolean; text?: string }>
  >({});

  const catalogStore = useCatalogStore();
  const productRepository = new ProductRepository();
  const resolutionService = new ProductResolutionService();

  useEffect(() => {
    const fetchAndRate = async () => {
      if (!params.ean) {
        setError({ type: 'generic', message: 'Ungültige EAN' });
        setLoading(false);
        return;
      }

      try {
        let cachedOverrides: Partial<Product> | null = null;
        if (params.fromCache === 'true' && params.cachedData) {
          try {
            const cachedJson = JSON.parse(params.cachedData) as unknown;
            const cachedProduct =
              cachedJson &&
              typeof cachedJson === 'object' &&
              'product' in (cachedJson as Record<string, unknown>)
                ? (cachedJson as { product: unknown }).product
                : cachedJson;

            if (cachedProduct && typeof cachedProduct === 'object') {
              cachedOverrides = cachedProduct as Partial<Product>;
              setIsCached(true);
            }
          } catch (parseErr) {
            console.error('Failed to parse cached data:', parseErr);
          }
        }

        let dbProduct: Product | null = null;
        try {
          const record = await productRepository.findByEan(params.ean);
          if (record) {
            dbProduct = buildProductFromRecord(record);
            setLocalProduct(dbProduct);
          }
        } catch {
          // Ignore DB errors
        }

        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          if (dbProduct && dbProduct.ingredientsText) {
            setProduct(dbProduct);
            setDataSource('local');
          } else if (cachedOverrides) {
            const offlinePlaceholder: Product = {
              ean: params.ean,
              name: 'Unbekanntes Produkt',
              ingredientsText: cachedOverrides.ingredientsText,
              brand: cachedOverrides.brand,
            };

            setProduct(offlinePlaceholder);

            const currentRules = useFilterStore.getState().rules;
            const analyzer = new RedFlagAnalyzer(defaultRules);
            const evaluator = new NovaScoreEvaluator();
            const rater = new ProductRating(analyzer, evaluator);
            const scanResult = rater.rate(offlinePlaceholder, currentRules);
            setResult(scanResult);

            setLoading(false);
            return;
          }
          setError({
            type: 'offline',
            message: 'Kein Internet – Produkt kann nicht abgerufen werden',
          });
          setLoading(false);
          return;
        }

        const client = new OpenFoodFactsClient();
        const fetchedProduct = await client.getProductByEan(params.ean);

        if (!fetchedProduct) {
          if (dbProduct) {
            setProduct(dbProduct);
            setDataSource('local');
            const currentRules = useFilterStore.getState().rules;
            const analyzer = new RedFlagAnalyzer(defaultRules);
            const evaluator = new NovaScoreEvaluator();
            const rater = new ProductRating(analyzer, evaluator);
            const scanResult = rater.rate(dbProduct, currentRules);
            setResult(scanResult);
            setLoading(false);
            return;
          }

          setError({
            type: 'not-found',
            message: 'Produkt nicht in der Datenbank',
          });
          setLoading(false);
          return;
        }

        const overrideName = cachedOverrides?.name?.trim();
        const overrideBrand = cachedOverrides?.brand?.trim();

        const mergedProduct: Product = {
          ...fetchedProduct,
          ...(cachedOverrides ?? {}),
          ean: fetchedProduct.ean,
          name: overrideName ? overrideName : fetchedProduct.name,
          brand: overrideBrand ? overrideBrand : fetchedProduct.brand,
          ingredientsText:
            cachedOverrides?.ingredientsText && cachedOverrides.ingredientsText.trim()
              ? cachedOverrides.ingredientsText
              : fetchedProduct.ingredientsText,
        };

        setOffProduct(mergedProduct);
        setProduct(mergedProduct);
        setDataSource('off');

        const currentRules = useFilterStore.getState().rules;
        const analyzer = new RedFlagAnalyzer(defaultRules);
        const evaluator = new NovaScoreEvaluator();
        const rater = new ProductRating(analyzer, evaluator);
        const scanResult = rater.rate(mergedProduct, currentRules);
        setResult(scanResult);

        (async () => {
          try {
            setSavingProduct(true);
            const normalized = ProductNormalizer.normalize(mergedProduct);
            const now = new Date().toISOString();
            const record: ProductRecord = {
              ean: mergedProduct.ean,
              name: normalized.name,
              brands: normalized.brand,
              ingredients: normalized.ingredientsText,
              nova_score: normalized.novaScore as ProductRecord['nova_score'],
              nutriscore: null,
              raw_json: normalized.fullJson,
              scanned_at: now,
              rating: scanResult.status,
              data_version: PRODUCT_DATA_VERSION,
              last_api_fetch: now,
              image_url: normalized.imageUrl,
              image_ingredients_url: normalized.imageIngredientsUrl,
              image_nutrition_url: normalized.imageNutritionUrl,
              image_packaging_url: normalized.imagePackagingUrl,
            };
            await catalogStore.addProduct(record);

            // Download product images for offline use
            LocalImageCache.downloadProductImages(mergedProduct.ean, {
              imageUrl: normalized.imageUrl,
              imageIngredientsUrl: normalized.imageIngredientsUrl,
              imageNutritionUrl: normalized.imageNutritionUrl,
              imagePackagingUrl: normalized.imagePackagingUrl,
            }).catch((imgErr) => {
              console.error('Failed to cache product images:', imgErr);
            });

            // Check if cached data is stale
            const cachedRecord = await productRepository.findByEan(mergedProduct.ean);
            if (cachedRecord && resolutionService.isStale(cachedRecord)) {
              setIsStale(true);
            }
          } catch (_err) {
            console.error('Failed to save product to database:', _err);
          } finally {
            setSavingProduct(false);
          }
        })();

        // Fetch Robotoff AI insights in the background
        (async () => {
          try {
            setAiInsightsLoading(true);
            const robotoffClient = new RobotoffClient();
            const insights = await robotoffClient.getInsights(params.ean);
            if (insights.length > 0) {
              const insightAnalyzer = new RobotoffInsightAnalyzer();
              const findings = insightAnalyzer.analyze(insights);
              setAiInsights(findings);
              setResult((prev) => (prev ? { ...prev, aiInsights: findings } : prev));
            }
          } catch (robotoffErr) {
            console.error('Failed to fetch Robotoff insights:', robotoffErr);
          } finally {
            setAiInsightsLoading(false);
          }
        })();

        setLoading(false);
      } catch {
        setError({
          type: 'generic',
          message: 'Fehler beim Abrufen der Produktdaten',
        });
        setLoading(false);
      }
    };

    fetchAndRate();
  }, [params.ean, params.fromCache, params.cachedData]);

  useEffect(() => {
    if (!product?.ean) {
      return;
    }

    (async () => {
      try {
        const foundProduct = await productRepository.findByEan(product.ean);
        if (foundProduct?.id) {
          setProductId(foundProduct.id);
          const favoriteStatus = catalogStore.favorites.some((fav) => fav.id === foundProduct.id);
          setIsFavorite(favoriteStatus);
          if (resolutionService.isStale(foundProduct)) {
            setIsStale(true);
          }
        }
      } catch (_err) {
        console.error('Failed to load product details:', _err);
      }
    })();
  }, [product?.ean]);

  useEffect(() => {
    if (product && !loading && !error) {
      const ingredientsText = bestIngredientsText;
      const missingIngredients = ingredientsText === 'Keine Zutatenliste verfügbar';
      const missingNova = !product.novaScore;
      const hasNutritionData =
        product.nutriments !== undefined &&
        Object.values(product.nutriments).some((v) => v !== undefined);
      const missingNutrition = missingNova && !hasNutritionData;
      const missingImage = !product.imageUrl;

      const hasLocalData = !!(
        localProduct &&
        (localProduct.ingredientsText || localProduct.nutriments)
      );

      if ((missingIngredients || missingNutrition || missingImage) && !hasLocalData) {
        setShowMissingDataModal(true);
      }
    }
  }, [product, loading, error, localProduct]);

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [product?.ean]);

  const handleToggleFavorite = async () => {
    if (!product?.ean) {
      return;
    }

    try {
      let currentProductId = productId;
      if (!currentProductId && !isCached) {
        setSavingProduct(true);
        const record: ProductRecord = {
          ean: product.ean,
          name: product.name || null,
          brands: product.brand || null,
          ingredients: product.ingredientsText || null,
          nova_score: product.novaScore || null,
          nutriscore: null,
          raw_json: JSON.stringify({ product }),
          scanned_at: new Date().toISOString(),
          rating: result?.status || 'OK',
        };
        await catalogStore.addProduct(record);
        const savedProduct = await productRepository.findByEan(product.ean);
        if (savedProduct?.id) {
          currentProductId = savedProduct.id;
          setProductId(currentProductId);
        }
        setSavingProduct(false);
      }

      if (currentProductId) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await catalogStore.toggleFavorite(currentProductId);
        setIsFavorite(!isFavorite);
      }
    } catch (_err) {
      console.error('Failed to toggle favorite:', _err);
    }
  };

  // Pure helper functions (moved outside component to avoid re-creation)
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'OK':
        return '#4CAF50';
      case 'Warning':
        return '#FFC107';
      case 'Critical':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'OK':
        return 'OK';
      case 'Warning':
        return 'WARNUNG';
      case 'Critical':
        return 'KRITISCH';
      default:
        return 'UNBEKANNT';
    }
  };

  const getBestIngredientsText = (prod: Product): string => {
    if (prod.ingredientsTextDe) return prod.ingredientsTextDe;
    if (prod.ingredientsTextEn) return prod.ingredientsTextEn;
    if (prod.ingredientsTextByLang && Object.keys(prod.ingredientsTextByLang).length > 0) {
      const firstAvailable = Object.values(prod.ingredientsTextByLang)[0];
      if (firstAvailable) return firstAvailable;
    }
    if (prod.ingredientsText) return prod.ingredientsText;
    return 'Keine Zutatenliste verfügbar';
  };

  const getIngredientsByLang = (prod: Product): Record<string, string> => {
    const map: Record<string, string> = {};
    if (prod.ingredientsTextDe) map.de = prod.ingredientsTextDe;
    if (prod.ingredientsTextEn) map.en = prod.ingredientsTextEn;
    if (prod.ingredientsTextByLang) {
      Object.entries(prod.ingredientsTextByLang).forEach(([lang, text]) => {
        if (text && !map[lang]) map[lang] = text;
      });
    }
    if (Object.keys(map).length === 0 && prod.ingredientsText) {
      return { '?': prod.ingredientsText };
    }
    return map;
  };

  const getLangLabel = (code: string): string => {
    const labels: Record<string, string> = {
      de: 'Deutsch',
      en: 'English',
      fr: 'Français',
      it: 'Italiano',
      es: 'Español',
      nl: 'Nederlands',
      pt: 'Português',
      pl: 'Polski',
      ru: 'Русский',
      ja: '日本語',
      zh: '中文',
      ar: 'العربية',
      tr: 'Türkçe',
    };
    return labels[code] || code.toUpperCase();
  };

  const handleContributePress = () => {
    router.push({ pathname: `/edit/${params.ean}` });
  };

  const handleTranslateIngredients = async (lang: string, text: string) => {
    const targetLang = lang === 'de' ? 'en' : 'de';
    const key = `${lang}-${targetLang}`;

    setTranslations((prev) => ({ ...prev, [key]: { loading: true } }));

    try {
      const router = new TranslationRouter();
      const translated = await router.translate(text, targetLang);
      setTranslations((prev) => ({ ...prev, [key]: { loading: false, text: translated } }));
    } catch {
      setTranslations((prev) => ({ ...prev, [key]: { loading: false } }));
    }
  };

  const _handleToggleDataSource = () => {
    if (dataSource === 'off' && localProduct) {
      setProduct(localProduct);
      setDataSource('local');
      const currentRules = useFilterStore.getState().rules;
      const analyzer = new RedFlagAnalyzer(defaultRules);
      const evaluator = new NovaScoreEvaluator();
      const rater = new ProductRating(analyzer, evaluator);
      const scanResult = rater.rate(localProduct, currentRules);
      setResult(scanResult);
    } else if (dataSource === 'local' && offProduct) {
      setProduct(offProduct);
      setDataSource('off');
      const currentRules = useFilterStore.getState().rules;
      const analyzer = new RedFlagAnalyzer(defaultRules);
      const evaluator = new NovaScoreEvaluator();
      const rater = new ProductRating(analyzer, evaluator);
      const scanResult = rater.rate(offProduct, currentRules);
      setResult(scanResult);
    }
  };

  const buildGalleryImages = (prod: Product) => {
    const entries: { uri: string; label: string }[] = [];
    if (prod.imageUrl) entries.push({ uri: prod.imageUrl, label: 'Vorderseite' });
    if (prod.imageIngredientsUrl) entries.push({ uri: prod.imageIngredientsUrl, label: 'Zutaten' });
    if (prod.imageNutritionUrl) entries.push({ uri: prod.imageNutritionUrl, label: 'Nährwerte' });
    if (prod.imagePackagingUrl) entries.push({ uri: prod.imagePackagingUrl, label: 'Verpackung' });
    return entries;
  };

  const parseCategoryChips = (categories?: string): string[] => {
    if (!categories) return [];
    return categories
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 5);
  };

  const formatAllergenLabel = (tag: string): string => {
    const name = tag.startsWith('en:') ? tag.slice(3) : tag;
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
  };

  const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'Unbekannt';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  const bestIngredientsText = useMemo(
    () => (product ? getBestIngredientsText(product) : 'Keine Zutatenliste verfügbar'),
    [product]
  );

  const galleryImages = useMemo(() => (product ? buildGalleryImages(product) : []), [product]);

  const categoryChips = useMemo(
    () => parseCategoryChips(product?.categories),
    [product?.categories]
  );

  // --- Render: Loading state ---
  if (loading) {
    return <SkeletonLoadingScreen />;
  }

  // --- Render: Error state ---
  if (error || !result || !product) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Zurück</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error?.message || 'Fehler'}</Text>
            {error?.type === 'not-found' && (
              <View style={styles.notFoundCard}>
                <Text style={styles.notFoundSubtitle}>
                  Hilf mit, den Katalog zu erweitern und füge das Produkt hinzu!
                </Text>
                <TouchableOpacity
                  style={styles.primaryContributeButton}
                  onPress={handleContributePress}
                >
                  <Text style={styles.primaryContributeButtonText}>Jetzt beitragen</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  const statusColor = getStatusColor(result.status);
  const statusLabel = getStatusLabel(result.status);

  // --- Render: Main content ---
  return (
    <View style={styles.container}>
      {/* Missing data modal */}
      <Modal visible={showMissingDataModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daten fehlen</Text>
            <Text style={styles.modalBody}>
              Dieses Produkt hat zu wenige Daten zur Bewertung. Möchtest du die fehlenden
              Informationen jetzt ergänzen?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => setShowMissingDataModal(false)}
              >
                <Text style={styles.cancelLinkText}>Später</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryContributeButton}
                onPress={() => {
                  setShowMissingDataModal(false);
                  handleContributePress();
                }}
              >
                <Text style={styles.primaryContributeButtonText}>Daten eintragen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <View style={styles.headerRightSection}>
          <TouchableOpacity
            onPress={() =>
              product?.ean && router.push({ pathname: '/edit/[ean]', params: { ean: product.ean } })
            }
            style={styles.iconButton}
          >
            <Ionicons name="pencil" size={20} color="#bbb" />
          </TouchableOpacity>
          {isStale && (
            <View style={styles.staleBadge}>
              <Text style={styles.staleBadgeText}>Veraltet</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleToggleFavorite} disabled={!product || savingProduct}>
            <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteFilled]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product image hero */}
        {product.imageUrl ? (
          <View style={styles.heroImage}>
            {!heroImageLoaded && (
              <View style={styles.heroLoadingOverlay}>
                <ActivityIndicator size="large" color="#4CAF50" />
              </View>
            )}
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onLoadEnd={() => setHeroImageLoaded(true)}
            />
          </View>
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={styles.heroPlaceholderText}>Kein Bild</Text>
          </View>
        )}

        {/* Product name, brand, quantity */}
        <View style={styles.productIdentity}>
          <Text style={styles.productName} numberOfLines={3}>
            {product.name}
          </Text>
          <View style={styles.productSubline}>
            {product.brand && <Text style={styles.productBrand}>{product.brand}</Text>}
            {product.quantity && <Text style={styles.productQuantity}>{product.quantity}</Text>}
          </View>
          <Text style={styles.productEAN}>EAN: {product.ean}</Text>
        </View>

        {/* 2. Main Product Info — Status + Nutri-Score + NOVA + Categories */}
        <View style={styles.section}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>

          <View style={styles.scoreRow}>
            {product.nutritionGrades && (
              <View
                style={[
                  styles.nutriScoreBadge,
                  { backgroundColor: NUTRI_SCORE_COLORS[product.nutritionGrades] || '#757575' },
                ]}
              >
                <Text style={styles.nutriScoreLetter}>{product.nutritionGrades.toUpperCase()}</Text>
                <Text style={styles.nutriScoreLabel}>Nutri-Score</Text>
              </View>
            )}

            <View
              style={[
                styles.novaBadge,
                { backgroundColor: product.novaScore ? NOVA_COLORS[product.novaScore] : '#757575' },
              ]}
            >
              <Text style={styles.novaBadgeNumber}>{product.novaScore || '?'}</Text>
              <Text style={styles.novaBadgeLabel}>NOVA</Text>
            </View>
          </View>

          {categoryChips.length > 0 && (
            <View style={styles.chipRow}>
              {categoryChips.map((cat, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 3. Red Flags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Red Flags</Text>
          {result.redFlags.length > 0 ? (
            result.redFlags.map((flag, index) => (
              <View key={`${flag.ingredient}-${index}`} style={styles.redFlagItem}>
                <View
                  style={[
                    styles.severityDot,
                    { backgroundColor: flag.severity === 'critical' ? '#F44336' : '#FFC107' },
                  ]}
                />
                <View style={styles.flagContent}>
                  <Text style={styles.flagIngredient}>{flag.ingredient}</Text>
                  <Text style={styles.flagCategory}>{flag.category}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>Keine Red Flags gefunden</Text>
          )}
        </View>

        {/* 3.5 AI Insights (Robotoff) */}
        {(aiInsights.length > 0 || aiInsightsLoading) && (
          <View style={styles.section}>
            <View style={styles.aiSectionHeader}>
              <Text style={styles.sectionTitle}>KI-Erkenntnisse</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            </View>
            {aiInsightsLoading && aiInsights.length === 0 ? (
              <ActivityIndicator size="small" color="#7C4DFF" style={styles.aiLoadingSpinner} />
            ) : (
              aiInsights.map((insight) => (
                <View key={insight.id} style={styles.aiInsightItem}>
                  <View
                    style={[
                      styles.aiTypeIndicator,
                      {
                        backgroundColor:
                          insight.type === 'category'
                            ? '#4CAF50'
                            : insight.type === 'label'
                              ? '#2196F3'
                              : '#FF9800',
                      },
                    ]}
                  />
                  <View style={styles.aiInsightContent}>
                    <View style={styles.aiInsightRow}>
                      <Text style={styles.aiInsightValue}>{insight.value}</Text>
                      {insight.confidence !== null && (
                        <Text style={styles.aiConfidence}>
                          {Math.round(insight.confidence * 100)}%
                        </Text>
                      )}
                    </View>
                    <Text style={styles.aiInsightDescription} numberOfLines={2}>
                      {insight.description}
                    </Text>
                    {insight.confidence !== null && (
                      <View style={styles.aiConfidenceBar}>
                        <View
                          style={[
                            styles.aiConfidenceFill,
                            { width: `${Math.round(insight.confidence * 100)}%` },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 4. Nutrition Summary */}
        {product.nutriments && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nährwerte</Text>
            <View style={styles.nutritionSummaryRow}>
              <NutritionSummaryCard
                label="Kalorien"
                value={product.nutriments.energyKcal100g}
                unit="kcal"
              />
              <NutritionSummaryCard label="Fett" value={product.nutriments.fat100g} unit="g" />
              <NutritionSummaryCard label="Zucker" value={product.nutriments.sugars100g} unit="g" />
              <NutritionSummaryCard
                label="Eiweiß"
                value={product.nutriments.proteins100g}
                unit="g"
              />
              <NutritionSummaryCard label="Salz" value={product.nutriments.salt100g} unit="g" />
            </View>
          </View>
        )}

        {/* 5. Ingredients */}
        {(() => {
          const langMap = getIngredientsByLang(product);
          const hasAny = Object.keys(langMap).length > 0;

          if (!hasAny) return null;

          const knownLangs = Object.entries(langMap).filter(([l]) => l !== '?');
          const unknown = langMap['?'];

          const langAccordionItems = [
            ...knownLangs.map(([lang, text]) => {
              const targetLang = lang === 'de' ? 'en' : 'de';
              const translateKey = `${lang}-${targetLang}`;
              const translation = translations[translateKey];

              return {
                title: getLangLabel(lang),
                content: (
                  <View>
                    <View style={styles.translateRow}>
                      <TouchableOpacity
                        style={styles.translateBtn}
                        onPress={() => handleTranslateIngredients(lang, text)}
                        disabled={translation?.loading}
                      >
                        {translation?.loading ? (
                          <ActivityIndicator size="small" color="#4CAF50" />
                        ) : (
                          <>
                            <Ionicons name="language-outline" size={14} color="#4CAF50" />
                            <Text style={styles.translateBtnText}>
                              {lang === 'de' ? 'EN' : 'DE'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.ingredientsText}>{text}</Text>
                    {translation?.text && (
                      <View style={styles.translatedBlock}>
                        <Text style={styles.translatedLabel}>
                          {getLangLabel(targetLang)} (übersetzt)
                        </Text>
                        <Text style={styles.ingredientsText}>{translation.text}</Text>
                      </View>
                    )}
                  </View>
                ),
              };
            }),
          ];

          if (unknown) {
            langAccordionItems.push({
              title: 'Original',
              content: <Text style={styles.ingredientsText}>{unknown}</Text>,
            });
          }

          const accordionContent = <Accordion items={langAccordionItems} />;

          return (
            <View style={[styles.section, { paddingTop: 12 }]}>
              <Accordion items={[{ title: 'Zutatenliste', content: accordionContent }]} />
            </View>
          );
        })()}

        {/* 6. Allergens */}
        {product.allergensTags?.length || product.traces ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allergene</Text>

            {product.allergensTags && product.allergensTags.length > 0 && (
              <View style={styles.allergenGroup}>
                <Text style={styles.allergenGroupLabel}>Enthält</Text>
                <View style={styles.chipRow}>
                  {product.allergensTags.map((tag, i) => (
                    <View key={i} style={styles.allergenChip}>
                      <Text style={styles.allergenChipText}>{formatAllergenLabel(tag)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {product.traces ? (
              <View style={styles.allergenGroup}>
                <Text style={styles.allergenGroupLabel}>Kann Spuren enthalten von</Text>
                <Text style={styles.tracesText}>{product.traces}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 7. Nutrition Table */}
        {product.nutriments && (
          <View style={styles.section}>
            <Accordion
              items={[
                {
                  title: 'Nährwerttabelle (pro 100 g)',
                  content: (
                    <NutritionTable
                      nutriments={product.nutriments}
                      servingSize={product.servingSize}
                    />
                  ),
                },
              ]}
            />
          </View>
        )}

        {/* 8. Image Gallery */}
        {galleryImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produktbilder</Text>
            <ImageGallery images={galleryImages} />
          </View>
        )}

        {/* 9. Additional Information */}
        {product.origins || product.manufacturingPlaces || product.stores ? (
          <View style={styles.section}>
            <Accordion
              items={[
                {
                  title: 'Weitere Informationen',
                  content: (
                    <View>
                      {product.origins ? (
                        <InfoRow label="Herkunft" value={product.origins} />
                      ) : null}
                      {product.manufacturingPlaces ? (
                        <InfoRow label="Herstellungsort" value={product.manufacturingPlaces} />
                      ) : null}
                      {product.stores ? <InfoRow label="Geschäfte" value={product.stores} /> : null}
                      <InfoRow
                        label="Letzte Aktualisierung"
                        value={formatDate(product.lastModified)}
                      />
                    </View>
                  ),
                },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.spacer} />
        <Text style={styles.dataDisclaimer}>
          Product data is provided by Open Food Facts contributors and may be incomplete or
          inaccurate.
        </Text>
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// --- Sub-components ---

function NutritionSummaryCard({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) {
  const display = value != null ? `${formatNutrientValue(value)}` : '–';
  return (
    <View style={summaryStyles.card}>
      <Text style={summaryStyles.value}>
        {display}
        <Text style={summaryStyles.unit}> {unit}</Text>
      </Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function formatNutrientValue(value: number | null | undefined): string {
  if (value == null) return '–';
  if (value < 0.1 && value > 0) return '<0.1';
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },

  // Header
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#1E1E1E',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  cachedBadge: {
    backgroundColor: '#757575',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cachedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  staleBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  staleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteIcon: { color: '#BDBDBD', fontSize: 28 },
  favoriteFilled: { color: '#FFD700' },
  backText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // Content
  content: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Hero image
  heroImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#1A1A1A',
  },
  heroLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 120,
  },
  heroPlaceholderText: { color: '#555', fontSize: 14 },

  // Product identity
  productIdentity: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  productName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  productSubline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  productBrand: { color: '#BDBDBD', fontSize: 14, fontWeight: '500' },
  productQuantity: { color: '#9E9E9E', fontSize: 13 },
  productEAN: { color: '#757575', fontSize: 11, marginTop: 6 },

  // Status badge
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  // Score row
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  nutriScoreBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 72,
  },
  nutriScoreLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  nutriScoreLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600', marginTop: 2 },
  novaBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 60,
  },
  novaBadgeNumber: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  novaBadgeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600', marginTop: 2 },

  // Category chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: { color: '#BDBDBD', fontSize: 12 },

  // Red flags
  redFlagItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 3 },
  flagContent: { flex: 1 },
  flagIngredient: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 1 },
  flagCategory: { color: '#9E9E9E', fontSize: 12 },
  emptyStateText: { color: '#9E9E9E', fontSize: 13 },

  // AI Insights
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiBadge: {
    backgroundColor: '#7C4DFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiLoadingSpinner: { paddingVertical: 16 },
  aiInsightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#7C4DFF',
  },
  aiTypeIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 3 },
  aiInsightContent: { flex: 1 },
  aiInsightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  aiInsightValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 },
  aiConfidence: { color: '#7C4DFF', fontSize: 12, fontWeight: '700' },
  aiInsightDescription: { color: '#9E9E9E', fontSize: 12, marginBottom: 6 },
  aiConfidenceBar: {
    height: 3,
    backgroundColor: '#2A2A3E',
    borderRadius: 2,
    overflow: 'hidden',
  },
  aiConfidenceFill: {
    height: '100%',
    backgroundColor: '#7C4DFF',
    borderRadius: 2,
  },

  // Nutrition summary
  nutritionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Ingredients
  ingredientsText: { color: '#CFCFCF', fontSize: 14, lineHeight: 21 },
  translateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  translateBtnText: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  translatedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  translatedLabel: { color: '#4CAF50', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  // Allergens
  allergenGroup: { marginBottom: 12 },
  allergenGroupLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  allergenChip: {
    backgroundColor: '#4A2A2A',
    borderWidth: 1,
    borderColor: '#F44336',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  allergenChipText: { color: '#FF8A80', fontSize: 12, fontWeight: '600' },
  tracesText: { color: '#FFC107', fontSize: 13, lineHeight: 19 },

  // Data source toggle
  dataSourceToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  toggleTextDisabled: {
    color: '#555',
  },

  // Footer
  spacer: { height: 20 },
  dataDisclaimer: {
    color: '#757575',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  bottomPadding: { height: 40 },

  // Error styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  errorText: { color: '#F44336', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  notFoundCard: { marginTop: 32, alignItems: 'center' },
  notFoundSubtitle: {
    color: '#BDBDBD',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  primaryContributeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  primaryContributeButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalBody: { color: '#BDBDBD', fontSize: 16, marginBottom: 24, lineHeight: 22 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  cancelLink: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelLinkText: { color: '#9E9E9E', fontSize: 16, fontWeight: '600' },
});

// Sub-component styles
const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  label: {
    color: '#9E9E9E',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  label: { color: '#9E9E9E', fontSize: 13, flex: 1 },
  value: { color: '#FFFFFF', fontSize: 13, flex: 2, textAlign: 'right' },
});
