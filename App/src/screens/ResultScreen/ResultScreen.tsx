import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import type { Product, ProductRecord } from '../../types/Product';
import type { ScanResult } from '../../types/ScanResult';
import { OpenFoodFactsClient } from '../../infrastructure/api/OpenFoodFactsClient';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { useCatalogStore } from '../../store/catalogStore';
import { useFilterStore } from '../../store/filterStore';
import { RedFlagAnalyzer } from '../../domain/analysis/RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../../domain/analysis/NovaScoreEvaluator';
import { ProductRating } from '../../domain/analysis/ProductRating';
import { defaultRules } from '../../domain/rules/defaultRules';
import { SkeletonLoadingScreen } from '../../components/SkeletonLoading';
import { Toast } from '../../components/Toast';
import { Accordion } from '../../components/Accordion';
import { OffAccountSetup } from '../../components/OffAccountSetup/OffAccountSetup';
import { OpenFoodFactsWriteClient } from '../../infrastructure/api/OpenFoodFactsWriteClient';

type ErrorType = 'offline' | 'not-found' | 'generic';

export default function ResultScreen() {
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
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showMissingDataModal, setShowMissingDataModal] = useState(false);

  const catalogStore = useCatalogStore();
  const productRepository = new ProductRepository();

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
              cachedJson && typeof cachedJson === 'object' && 'product' in (cachedJson as Record<string, unknown>)
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

        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          if (cachedOverrides) {
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
            (cachedOverrides?.ingredientsText && cachedOverrides.ingredientsText.trim())
              ? cachedOverrides.ingredientsText
              : fetchedProduct.ingredientsText,
        };

        setProduct(mergedProduct);

        const currentRules = useFilterStore.getState().rules;
        const analyzer = new RedFlagAnalyzer(defaultRules);
        const evaluator = new NovaScoreEvaluator();
        const rater = new ProductRating(analyzer, evaluator);
        const scanResult = rater.rate(mergedProduct, currentRules);
        setResult(scanResult);

        // Save product to database in the background (fire-and-forget)
        (async () => {
          try {
            setSavingProduct(true);
            const record: ProductRecord = {
              ean: mergedProduct.ean,
              name: mergedProduct.name || null,
              brands: mergedProduct.brand || null,
              ingredients: mergedProduct.ingredientsText || null,
              nova_score: mergedProduct.novaScore || null,
              nutriscore: null,
              raw_json: JSON.stringify({ product: mergedProduct }),
              scanned_at: new Date().toISOString(),
              rating: scanResult.status,
            };
            await catalogStore.addProduct(record);
          } catch (err) {
            console.error('Failed to save product to database:', err);
          } finally {
            setSavingProduct(false);
          }
        })();

        setLoading(false);
      } catch (err) {
        setError({
          type: 'generic',
          message: 'Fehler beim Abrufen der Produktdaten',
        });
        setLoading(false);
      }
    };

    fetchAndRate();
  }, [params.ean, params.fromCache, params.cachedData]);

  // Load productId and check favorite status
  useEffect(() => {
    if (!product?.ean) {
      return;
    }

    (async () => {
      try {
        const foundProduct = await productRepository.findByEan(product.ean);
        if (foundProduct?.id) {
          setProductId(foundProduct.id);
          const favoriteStatus = catalogStore.favorites.some(
            (fav) => fav.id === foundProduct.id
          );
          setIsFavorite(favoriteStatus);
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      }
    })();
  }, [product?.ean]);

  useEffect(() => {
    if (product && !loading && !error) {
      const missingIngredients = getBestIngredientsText(product) === 'Keine Zutatenliste verfügbar';
      const missingNutrition = !product.novaScore;
      if (missingIngredients || missingNutrition) {
        setShowMissingDataModal(true);
      }
    }
  }, [product, loading, error]);

  const handleToggleFavorite = async () => {
    if (!product?.ean) {
      return;
    }

    try {
      // Ensure product is saved first
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
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

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

  const handleContributePress = async () => {
    try {
      const client = new OpenFoodFactsWriteClient();
      const credentials = await client.loadCredentials();
      if (credentials) {
        router.push({ pathname: '/contribute', params: { ean: params.ean } });
      } else {
        setShowSetupModal(true);
      }
    } catch {
      setShowSetupModal(true);
    }
  };

  if (loading) {
    return <SkeletonLoadingScreen />;
  }

  if (error || !result || !product) {
    return (
      <View style={styles.container}>
        <OffAccountSetup
          visible={showSetupModal}
          onSuccess={() => {
            setShowSetupModal(false);
            if (params.ean) {
              router.push({ pathname: '/contribute', params: { ean: params.ean } });
            }
          }}
          onCancel={() => setShowSetupModal(false)}
        />
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
  const novaColor = result.nova.score === 4 ? '#F44336' : statusColor;

  return (
    <View style={styles.container}>
      <Modal visible={showMissingDataModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daten fehlen</Text>
            <Text style={styles.modalBody}>
              This product has no ingredients/nutrition data. Would you like to add them now via photo?
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
                <Text style={styles.primaryContributeButtonText}>Start OCR Contribution</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <OffAccountSetup
        visible={showSetupModal}
        onSuccess={() => {
          setShowSetupModal(false);
          if (params.ean) {
            router.push({ pathname: '/contribute', params: { ean: params.ean } });
          }
        }}
        onCancel={() => setShowSetupModal(false)}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <View style={styles.headerRightSection}>
          {isCached && (
            <View style={styles.cachedBadge}>
              <Text style={styles.cachedBadgeText}>Cache</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handleToggleFavorite}
            disabled={!product || savingProduct}
          >
            <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteFilled]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        <View style={styles.redFlagsSection}>
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

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.brand && <Text style={styles.productBrand}>{product.brand}</Text>}
          <Text style={styles.productEAN}>EAN: {product.ean}</Text>
        </View>

        <View style={styles.novaSection}>
          <Text style={styles.sectionTitle}>Verarbeitungsgrad</Text>
          <View style={styles.novaDisplay}>
            <View style={[styles.novaScore, { backgroundColor: novaColor }]}>
              <Text style={styles.novaScoreText}>{result.nova.score}</Text>
            </View>
            <Text style={styles.novaLabel}>{result.nova.label || 'Unbekannt'}</Text>
          </View>
        </View>

        <View style={styles.accordionSection}>
          <Accordion
            items={[
              {
                title: 'Zutatenliste',
                content: (
                  <Text style={styles.ingredientsText}>{getBestIngredientsText(product)}</Text>
                ),
              },
            ]}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#1E1E1E',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  favoriteIcon: {
    color: '#BDBDBD',
    fontSize: 28,
  },
  favoriteFilled: {
    color: '#FFD700',
  },
  content: { flex: 1 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  statusBanner: {
    margin: 16,
    paddingVertical: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  productInfo: { paddingHorizontal: 16, paddingVertical: 16 },
  productName: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  productBrand: { color: '#BDBDBD', fontSize: 14, marginBottom: 8 },
  productEAN: { color: '#9E9E9E', fontSize: 12 },
  novaSection: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  novaDisplay: { flexDirection: 'row', alignItems: 'center' },
  novaScore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  novaScoreText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  novaLabel: { color: '#9E9E9E', fontSize: 16, flex: 1 },
  redFlagsSection: { paddingHorizontal: 16, paddingVertical: 12 },
  accordionSection: { paddingHorizontal: 16, paddingBottom: 24 },
  redFlagItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12, marginTop: 4 },
  flagContent: { flex: 1 },
  flagIngredient: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  flagCategory: { color: '#9E9E9E', fontSize: 12 },
  emptyStateText: { color: '#9E9E9E', fontSize: 14 },
  ingredientsText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  spacer: { height: 24 },
  errorText: { color: '#F44336', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  backButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignSelf: 'center',
  },
  backText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  contributeButton: {
    marginTop: 24,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  contributeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
  notFoundCard: { marginTop: 32, alignItems: 'center' },
  notFoundSubtitle: { color: '#BDBDBD', fontSize: 16, textAlign: 'center', marginBottom: 20, paddingHorizontal: 16, lineHeight: 22 },
  primaryContributeButton: { backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 8 },
  primaryContributeButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
