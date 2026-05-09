import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Product, ProductRecord } from '../types/Product';
import type { ScanResult } from '../types/ScanResult';
import { OpenFoodFactsClient } from '../infrastructure/api/OpenFoodFactsClient';
import { RedFlagAnalyzer } from '../domain/analysis/RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../domain/analysis/NovaScoreEvaluator';
import { ProductRating } from '../domain/analysis/ProductRating';
import { defaultRules } from '../domain/rules/defaultRules';
import { SkeletonLoadingScreen } from '../components/SkeletonLoading';
import { Toast } from '../components/Toast';
import { Accordion } from '../components/Accordion';
import { useCatalogStore } from '../store/catalogStore';
import { useFilterStore } from '../store/filterStore';
import { ProductRepository } from '../infrastructure/db/ProductRepository';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ ean: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const catalogStore = useCatalogStore();
  const productRepository = new ProductRepository();

  useEffect(() => {
    const fetchAndRate = async () => {
      if (!params.ean) {
        setError('Ungültige EAN');
        setToastVisible(true);
        setLoading(false);
        return;
      }

      try {
        const client = new OpenFoodFactsClient();
        const fetchedProduct = await client.getProductByEan(params.ean);

        if (!fetchedProduct) {
          setError('Produkt nicht gefunden');
          setToastVisible(true);
          setLoading(false);
          return;
        }

        setProduct(fetchedProduct);

        const currentRules = useFilterStore.getState().rules;
        const analyzer = new RedFlagAnalyzer(defaultRules);
        const evaluator = new NovaScoreEvaluator();
        const rater = new ProductRating(analyzer, evaluator);
        const scanResult = rater.rate(fetchedProduct, currentRules);

        setResult(scanResult);

        // Save product to database in the background (fire-and-forget)
        (async () => {
          try {
            setSavingProduct(true);
            const record: ProductRecord = {
              ean: fetchedProduct.ean,
              name: fetchedProduct.name || null,
              brands: fetchedProduct.brand || null,
              ingredients: fetchedProduct.ingredientsText || null,
              nova_score: fetchedProduct.novaScore || null,
              nutriscore: null,
              raw_json: JSON.stringify({ product: fetchedProduct }),
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
        setError('Fehler beim Abrufen der Produktdaten');
        setToastVisible(true);
        setLoading(false);
      }
    };

    fetchAndRate();
  }, [params.ean]);

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
  }, [product?.ean, catalogStore.favorites]);

  const handleToggleFavorite = async () => {
    if (!product?.ean) {
      return;
    }

    try {
      // Ensure product is saved first
      let currentProductId = productId;
      if (!currentProductId) {
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

  if (loading) {
    return <SkeletonLoadingScreen />;
  }

  if (error || !result || !product) {
    return (
      <View style={styles.container}>
        {toastVisible && (
          <Toast
            message={error || 'Fehler'}
            type="error"
            duration={4000}
            onDismiss={() => {
              setToastVisible(false);
              setTimeout(() => router.back(), 300);
            }}
          />
        )}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Fehler'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Zurück zum Scanner</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = getStatusColor(result.status);
  const statusLabel = getStatusLabel(result.status);

  const nutritionItems = [
    {
      title: 'Nova-Klassifizierung',
      content: (
        <View>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Klasse:</Text>
            <Text style={styles.nutritionValue}>{product.novaScore}</Text>
          </View>
          <Text style={styles.nutritionDescription}>
            {getNovaBeschreibung(product.novaScore || 1)}
          </Text>
        </View>
      ),
    },
  ];

  return (
    <View style={styles.container}>
      {toastVisible && error && (
        <Toast
          message={error}
          type="error"
          duration={3000}
          onDismiss={() => setToastVisible(false)}
        />
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleFavorite}
          disabled={!product || savingProduct}
        >
          <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteFilled]}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.brand && <Text style={styles.productBrand}>{product.brand}</Text>}
          <Text style={styles.productEAN}>EAN: {product.ean}</Text>
        </View>

        <View style={styles.novaSection}>
          <Text style={styles.sectionTitle}>Verarbeitungsgrad</Text>
          <View style={styles.novaDisplay}>
            <View
              style={[
                styles.novaScore,
                {
                  backgroundColor: statusColor,
                },
              ]}
            >
              <Text style={styles.novaScoreText}>{result.nova.score}</Text>
            </View>
            <Text style={styles.novaLabel}>{result.nova.label || 'Unbekannt'}</Text>
          </View>
        </View>

        {result.redFlags.length > 0 && (
          <View style={styles.redFlagsSection}>
            <Text style={styles.sectionTitle}>Gefundene Red Flags ({result.redFlags.length})</Text>
            {result.redFlags.map((flag, index) => (
              <View key={index} style={styles.redFlagItem}>
                <View
                  style={[
                    styles.severityDot,
                    {
                      backgroundColor: flag.severity === 'critical' ? '#F44336' : '#FFC107',
                    },
                  ]}
                />
                <View style={styles.flagContent}>
                  <Text style={styles.flagIngredient}>{flag.ingredient}</Text>
                  <Text style={styles.flagCategory}>{flag.category}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {result.redFlags.length === 0 && (
          <View style={styles.noFlagsSection}>
            <Text style={styles.noFlagsText}>✓ Keine Red Flags gefunden</Text>
          </View>
        )}

        <View style={styles.accordionSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Accordion items={nutritionItems} />
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

function getNovaBeschreibung(score: number): string {
  switch (score) {
    case 1:
      return 'Minimal verarbeitet, natürliche Zutaten und einfache Verarbeitung.';
    case 2:
      return 'Wenig verarbeitet, einfache Verarbeitung mit wenigen Zusatzstoffen.';
    case 3:
      return 'Mäßig verarbeitet, Zusatzstoffe und chemische Verarbeitung enthalten.';
    case 4:
      return 'Hochverarbeitet, viele Zusatzstoffe, Chemikalien und industrielle Verarbeitung.';
    default:
      return 'Verarbeitungsgrad unbekannt.';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  backText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  favoriteIcon: {
    color: '#BDBDBD',
    fontSize: 28,
  },
  favoriteFilled: {
    color: '#FFD700',
  },
  content: {
    flex: 1,
  },
  statusBanner: {
    margin: 16,
    paddingVertical: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  productInfo: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  productBrand: {
    color: '#BDBDBD',
    fontSize: 14,
    marginBottom: 8,
  },
  productEAN: {
    color: '#757575',
    fontSize: 12,
  },
  novaSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  novaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  novaScore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  novaScoreText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  novaLabel: {
    color: '#BDBDBD',
    fontSize: 16,
    flex: 1,
  },
  redFlagsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
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
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
    marginTop: 4,
  },
  flagContent: {
    flex: 1,
  },
  flagIngredient: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  flagCategory: {
    color: '#BDBDBD',
    fontSize: 12,
  },
  noFlagsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noFlagsText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  accordionSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutritionLabel: {
    color: '#BDBDBD',
    fontSize: 14,
    fontWeight: '500',
  },
  nutritionValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  nutritionDescription: {
    color: '#BDBDBD',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    height: 32,
  },
});
