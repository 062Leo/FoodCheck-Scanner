import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import type { Product } from '../../types/Product';
import type { ScanResult } from '../../types/ScanResult';
import { OpenFoodFactsClient } from '../../infrastructure/api/OpenFoodFactsClient';
import { RedFlagAnalyzer } from '../../domain/analysis/RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../../domain/analysis/NovaScoreEvaluator';
import { ProductRating } from '../../domain/analysis/ProductRating';
import { defaultRules } from '../../domain/rules/defaultRules';
import { SkeletonLoadingScreen } from '../../components/SkeletonLoading';
import { Accordion } from '../../components/Accordion';

type ErrorType = 'offline' | 'not-found' | 'generic';

export default function ResultScreen() {
  const params = useLocalSearchParams<{ ean: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: ErrorType; message: string } | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    const fetchAndRate = async () => {
      if (!params.ean) {
        setError({ type: 'generic', message: 'Ungültige EAN' });
        setLoading(false);
        return;
      }

      try {
        // Check network connectivity before fetching
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
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

        setProduct(fetchedProduct);

        const analyzer = new RedFlagAnalyzer(defaultRules);
        const evaluator = new NovaScoreEvaluator();
        const rater = new ProductRating(analyzer, evaluator);
        const scanResult = rater.rate(fetchedProduct);

        setResult(scanResult);
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
  }, [params.ean]);

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

  if (loading) {
    return <SkeletonLoadingScreen />;
  }

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
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
  },
  backText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
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
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
