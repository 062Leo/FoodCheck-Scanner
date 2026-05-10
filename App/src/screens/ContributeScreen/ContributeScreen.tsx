import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RedFlagAnalyzer } from '../../domain/analysis/RedFlagAnalyzer';
import { NovaScoreEvaluator } from '../../domain/analysis/NovaScoreEvaluator';
import { ProductRating } from '../../domain/analysis/ProductRating';
import { createIngredientsTextProcessor } from '../../infrastructure/textProcessing/createIngredientsTextProcessor';
import { defaultRules } from '../../domain/rules/defaultRules';
import { useCatalogStore } from '../../store/catalogStore';
import { useFilterStore } from '../../store/filterStore';
import { ContributeForm } from '../../components/ContributeForm/ContributeForm';
import { OcrCameraSheet } from '../../components/OcrCameraSheet/OcrCameraSheet';
import { Toast } from '../../components/Toast';
import { ContributeFormData } from '../../types/ContributeFormData';
import { OpenFoodFactsClient } from '../../infrastructure/api/OpenFoodFactsClient';
import type { Product } from '../../types/Product';

type CameraTarget = 'ingredients' | null;

export default function ContributeScreen() {
  const { ean } = useLocalSearchParams<{ ean: string }>();
  const router = useRouter();

  const catalogStore = useCatalogStore();
  const filterStore = useFilterStore();

  // OFF product data – loaded on mount to pre-fill form
  const [offProduct, setOffProduct] = useState<Product | null>(null);

  // OCR text state – set when the user confirms from OcrCameraSheet
  const [ingredientsText, setIngredientsText] = useState('');

  // Which camera sheet is open (null = none)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);

  // step 1 = ingredients camera, step 2 = form
  const [step, setStep] = useState<1 | 2>(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load OFF product data on mount
  useEffect(() => {
    if (!ean) return;

    const loadOffProduct = async () => {
      try {
        const client = new OpenFoodFactsClient();
        const product = await client.getProductByEan(ean);
        if (product) {
          setOffProduct(product);
        }
      } catch (err) {
        console.error('Failed to load OFF product:', err);
      }
    };

    loadOffProduct();
  }, [ean]);

  /* ── Camera sheet callbacks ── */

  const handleOcrConfirm = async (text: string) => {
    if (cameraTarget === 'ingredients') {
      setIsProcessing(true);
      try {
        const processor = await createIngredientsTextProcessor();
        const processed = processor.process({ rawText: text });
        setIngredientsText(processed.cleanedText);
      } finally {
        setIsProcessing(false);
      }

      setCameraTarget(null);
      setStep(2);
      return;
    }
  };

  const handleOcrCancel = () => {
    setCameraTarget(null);
  };

  /* ── Step navigation ── */

  const handleSkip = () => {
    if (step === 1) setStep(2);
  };

  /* ── Save locally ── */

  const handleSaveLocally = async (formData: ContributeFormData) => {
    setIsProcessing(true);

    try {
      const product = {
        ean: formData.ean,
        name: formData.productName,
        brand: formData.brands || '',
        ingredientsText: formData.ingredientsText || '',
        nutriments: formData.nutriments || {},
      };

      const analyzer = new RedFlagAnalyzer(defaultRules);
      const evaluator = new NovaScoreEvaluator();
      const rater = new ProductRating(analyzer, evaluator);
      const currentRules = useFilterStore.getState().rules;
      const scanResult = rater.rate(product, currentRules);

      await catalogStore.addProduct({
        ean: product.ean,
        name: product.name || null,
        brands: product.brand || null,
        ingredients: product.ingredientsText || null,
        nova_score: null,
        nutriscore: null,
        raw_json: JSON.stringify({ product }),
        scanned_at: new Date().toISOString(),
        rating: scanResult.status,
      });

      setIsProcessing(false);

      const cachedData = JSON.stringify({ product: { ingredientsText: product.ingredientsText } });

      router.replace({
        pathname: '/result',
        params: {
          ean: product.ean,
          fromCache: 'true',
          cachedData,
        },
      });
    } catch (e) {
      setIsProcessing(false);
      setToastMessage(e instanceof Error ? e.message : 'Save failed');
    }
  };

  /* ── Step 2: Review form ── */
  if (step === 2) {
    return (
      <View style={styles.container}>
        {toastMessage && (
          <Toast message={toastMessage} type="error" onDismiss={() => setToastMessage(null)} />
        )}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <ContributeForm
          ean={ean}
          initialIngredients={ingredientsText}
          initialProductName={offProduct?.name || ''}
          initialBrand={offProduct?.brand || ''}
          onSubmit={handleSaveLocally}
          isSubmitting={isProcessing}
        />
      </View>
    );
  }

  /* ── Step 1 & 2: Camera prompt screens ── */
  const isStep1 = step === 1;
  const stepLabel = 'Schritt 1 von 1';
  const stepTitle = 'Zutatenliste fotografieren';
  const stepDesc =
    'Mach ein Foto der Zutatenliste. Du kannst danach den relevanten Bereich auswählen.';
  const doneIndicator = ingredientsText;

  return (
    <View style={styles.container}>
      {/* OcrCameraSheet opens modally over everything */}
      <OcrCameraSheet
        visible={cameraTarget !== null}
        mode={cameraTarget ?? 'ingredients'}
        onConfirm={handleOcrConfirm}
        onCancel={handleOcrCancel}
      />

      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <Text style={styles.stepIndicator}>{stepLabel}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDesc}>{stepDesc}</Text>

        {doneIndicator ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.doneText} numberOfLines={3}>
              {doneIndicator}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => setCameraTarget('ingredients')}>
          <Text style={styles.primaryBtnText}>📷 Foto aufnehmen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>{doneIndicator ? 'Weiter →' : 'Überspringen →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomColor: '#1E1E1E',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  stepIndicator: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  body: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 20 },
  stepTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  stepDesc: { color: '#BDBDBD', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A2E1A',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  doneIcon: { color: '#4CAF50', fontSize: 20, fontWeight: 'bold' },
  doneText: { color: '#A5D6A7', fontSize: 13, lineHeight: 19, flex: 1 },
  primaryBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  skipBtnText: { color: '#BDBDBD', fontSize: 16, fontWeight: '600' },
  permissionText: { color: '#BDBDBD', fontSize: 16 },
  errorText: { color: '#F44336', fontSize: 18, fontWeight: '600', marginBottom: 20 },
  permissionButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
