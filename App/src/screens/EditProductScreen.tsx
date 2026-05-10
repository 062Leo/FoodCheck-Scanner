import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { useCatalogStore } from '../store/catalogStore';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { OffAccountSetup } from '../components/OffAccountSetup/OffAccountSetup';
import { Toast } from '../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { OcrService } from '../infrastructure/ocr/OcrService';
import { OcrCameraSheet } from '../components/OcrCameraSheet/OcrCameraSheet';
import type { ContributeFormData } from '../types/ContributeFormData';
import { Accordion } from '../components/Accordion';
import type { NovaScore, ProductRecord } from '../types/Product';

const repo = new ProductRepository();
const writeClient = new OpenFoodFactsWriteClient();

export default function EditProductScreen() {
  const router = useRouter();
  const { ean } = useLocalSearchParams<{ ean: string }>();
  const catalogStore = useCatalogStore();

  const [cameraTarget, setCameraTarget] = useState<'ingredients' | 'nutriments' | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [novaScore, setNovaScore] = useState('');
  const [allergensTags, setAllergensTags] = useState('');
  const [traces, setTraces] = useState('');
  const [origins, setOrigins] = useState('');
  const [manufacturingPlaces, setManufacturingPlaces] = useState('');
  const [stores, setStores] = useState('');
  const [servingSize, setServingSize] = useState('');

  const [energyKcal100g, setEnergy] = useState('');
  const [fat100g, setFat] = useState('');
  const [saturatedFat100g, setSatFat] = useState('');
  const [carbohydrates100g, setCarbs] = useState('');
  const [sugars100g, setSugars] = useState('');
  const [fiber100g, setFiber] = useState('');
  const [proteins100g, setProteins] = useState('');
  const [salt100g, setSalt] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showOffSetup, setShowOffSetup] = useState(false);

  useEffect(() => {
    if (ean) {
      repo
        .findByEan(ean)
        .then(async (product) => {
          if (product) {
            setName(product.name || '');
            setBrand(product.brands || '');
            setIngredientsText(product.ingredients || '');
            setNovaScore(product.nova_score ? String(product.nova_score) : '');

            if (product.raw_json) {
              try {
                const parsed = JSON.parse(product.raw_json);
                const p = parsed.product || parsed;
                setCategory(p.categories || '');
                setQuantity(p.quantity || '');
                setServingSize(p.servingSize || p.serving_size || '');
                setOrigins(p.origins || '');
                setManufacturingPlaces(p.manufacturingPlaces || p.manufacturing_places || '');
                setStores(p.stores || '');
                setTraces(p.traces || '');

                const allergens = p.allergensTags ?? p.allergens_tags;
                setAllergensTags(
                  Array.isArray(allergens)
                    ? allergens.join(', ')
                    : typeof allergens === 'string'
                      ? allergens
                      : ''
                );

                const n = p.nutriments;
                if (n) {
                  setEnergy(readN(n, 'energyKcal100g', 'energy-kcal_100g'));
                  setFat(readN(n, 'fat100g', 'fat_100g'));
                  setSatFat(readN(n, 'saturatedFat100g', 'saturated-fat_100g'));
                  setCarbs(readN(n, 'carbohydrates100g', 'carbohydrates_100g'));
                  setSugars(readN(n, 'sugars100g', 'sugars_100g'));
                  setFiber(readN(n, 'fiber100g', 'fiber_100g'));
                  setProteins(readN(n, 'proteins100g', 'proteins_100g'));
                  setSalt(readN(n, 'salt100g', 'salt_100g'));
                }
              } catch {
                // Ignore parse errors
              }
            }
          } else {
            const record: ProductRecord = {
              ean,
              name: '',
              brands: '',
              ingredients: '',
              nova_score: null,
              nutriscore: null,
              raw_json: JSON.stringify({ product: {} }),
              scanned_at: new Date().toISOString(),
              rating: 'OK',
            };
            await repo.insert(record);
          }
          setIsLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setIsLoading(false);
        });
    }
  }, [ean]);

  const handleOcrConfirm = (text: string) => {
    if (cameraTarget === 'ingredients') {
      setIngredientsText(text);
    } else if (cameraTarget === 'nutriments') {
      const parsed = OcrService.parseNutriments(text);
      if (parsed.energyKcal100g !== undefined) setEnergy(parsed.energyKcal100g.toString());
      if (parsed.fat100g !== undefined) setFat(parsed.fat100g.toString());
      if (parsed.saturatedFat100g !== undefined) setSatFat(parsed.saturatedFat100g.toString());
      if (parsed.carbohydrates100g !== undefined) setCarbs(parsed.carbohydrates100g.toString());
      if (parsed.sugars100g !== undefined) setSugars(parsed.sugars100g.toString());
      if (parsed.fiber100g !== undefined) setFiber(parsed.fiber100g.toString());
      if (parsed.proteins100g !== undefined) setProteins(parsed.proteins100g.toString());
      if (parsed.salt100g !== undefined) setSalt(parsed.salt100g.toString());
    }
    setCameraTarget(null);
  };

  const handleSave = async () => {
    if (!ean) return;
    setIsLoading(true);
    await repo.updateProduct({
      ean,
      name,
      brands: brand,
      category,
      ingredients: ingredientsText,
      quantity,
      allergensTags,
      traces,
      origins,
      manufacturingPlaces,
      stores,
      servingSize,
      novaScore: novaScore
        ? (Math.min(4, Math.max(1, Number(novaScore) || 1)) as NovaScore)
        : undefined,
      nutriments: {
        energyKcal100g: energyKcal100g ? Number(energyKcal100g) : undefined,
        fat100g: fat100g ? Number(fat100g) : undefined,
        saturatedFat100g: saturatedFat100g ? Number(saturatedFat100g) : undefined,
        carbohydrates100g: carbohydrates100g ? Number(carbohydrates100g) : undefined,
        sugars100g: sugars100g ? Number(sugars100g) : undefined,
        fiber100g: fiber100g ? Number(fiber100g) : undefined,
        proteins100g: proteins100g ? Number(proteins100g) : undefined,
        salt100g: salt100g ? Number(salt100g) : undefined,
      },
    });
    await catalogStore.loadAll();
    const updated = await repo.findByEan(ean);
    router.replace({
      pathname: '/result',
      params: { ean, fromCache: 'true', cachedData: updated?.raw_json || '' },
    });
  };

  const handleUploadOFF = async () => {
    if (!ean) return;

    try {
      const credentials = await writeClient.loadCredentials();
      if (!credentials) {
        setShowOffSetup(true);
        return;
      }

      setIsUploading(true);
      const formData: ContributeFormData = {
        ean,
        productName: name,
        brands: brand,
        categories: category,
        ingredientsText: ingredientsText,
        nutriments: {
          energyKcal100g: energyKcal100g ? Number(energyKcal100g) : undefined,
          fat100g: fat100g ? Number(fat100g) : undefined,
          saturatedFat100g: saturatedFat100g ? Number(saturatedFat100g) : undefined,
          carbohydrates100g: carbohydrates100g ? Number(carbohydrates100g) : undefined,
          sugars100g: sugars100g ? Number(sugars100g) : undefined,
          fiber100g: fiber100g ? Number(fiber100g) : undefined,
          proteins100g: proteins100g ? Number(proteins100g) : undefined,
          salt100g: salt100g ? Number(salt100g) : undefined,
        },
      };

      await writeClient.uploadProduct(formData);
      setToastMessage('Upload erfolgreich!');
      setToastType('success');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setToastMessage(`Upload fehlgeschlagen:\n${errorMessage}`);
      setToastType('error');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const isUploadEnabled = name.trim().length > 0 && brand.trim().length > 0;

  const nutritionContent = (
    <View>
      <FieldRow label="Energie (kcal)" value={energyKcal100g} onChange={setEnergy} numeric />
      <FieldRow label="Fett (g)" value={fat100g} onChange={setFat} numeric />
      <FieldRow
        label="Gesättigte Fettsäuren (g)"
        value={saturatedFat100g}
        onChange={setSatFat}
        numeric
      />
      <FieldRow label="Kohlenhydrate (g)" value={carbohydrates100g} onChange={setCarbs} numeric />
      <FieldRow label="Zucker (g)" value={sugars100g} onChange={setSugars} numeric />
      <FieldRow label="Ballaststoffe (g)" value={fiber100g} onChange={setFiber} numeric />
      <FieldRow label="Protein (g)" value={proteins100g} onChange={setProteins} numeric />
      <FieldRow label="Salz (g)" value={salt100g} onChange={setSalt} numeric />
    </View>
  );

  return (
    <View style={styles.container}>
      <OcrCameraSheet
        visible={cameraTarget !== null}
        mode={cameraTarget ?? 'ingredients'}
        onConfirm={handleOcrConfirm}
        onCancel={() => setCameraTarget(null)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Produkt bearbeiten</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produktinformationen</Text>
          <FieldRow label="Name" value={name} onChange={setName} />
          <FieldRow label="Marke" value={brand} onChange={setBrand} />
          <FieldRow label="Menge" value={quantity} onChange={setQuantity} />
        </View>

        {/* Category & NOVA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bewertung</Text>
          <FieldRow label="Kategorie" value={category} onChange={setCategory} />
          <FieldRow label="NOVA (1–4)" value={novaScore} onChange={setNovaScore} numeric />
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionTitle}>Zutaten</Text>
            <TouchableOpacity onPress={() => setCameraTarget('ingredients')}>
              <Ionicons name="camera" size={22} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            multiline
            placeholder="Zutatenliste..."
            placeholderTextColor="#555"
          />
        </View>

        {/* Nutrition */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionTitle}>Nährwerte pro 100 g</Text>
            <TouchableOpacity onPress={() => setCameraTarget('nutriments')}>
              <Ionicons name="camera" size={22} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          <Accordion items={[{ title: 'Nährwerte bearbeiten', content: nutritionContent }]} />
        </View>

        {/* Allergens */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergene</Text>
          <FieldRow
            label="Enthält (durch Komma getrennt)"
            value={allergensTags}
            onChange={setAllergensTags}
          />
          <FieldRow label="Kann Spuren enthalten von" value={traces} onChange={setTraces} />
        </View>

        {/* Additional info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weitere Informationen</Text>
          <FieldRow label="Herkunft" value={origins} onChange={setOrigins} />
          <FieldRow
            label="Herstellungsort"
            value={manufacturingPlaces}
            onChange={setManufacturingPlaces}
          />
          <FieldRow label="Geschäfte" value={stores} onChange={setStores} />
          <FieldRow label="Portionsgröße" value={servingSize} onChange={setServingSize} />
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Speichern</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadBtn, !isUploadEnabled && styles.uploadBtnDisabled]}
          onPress={handleUploadOFF}
          disabled={!isUploadEnabled || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.uploadBtnText}>Upload to Open Food Facts</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Abbrechen</Text>
        </TouchableOpacity>
      </ScrollView>

      <OffAccountSetup
        visible={showOffSetup}
        onCancel={() => setShowOffSetup(false)}
        onSuccess={() => {
          setShowOffSetup(false);
          void handleUploadOFF();
        }}
      />

      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onDismiss={() => setToastMessage(null)} />
      )}
    </View>
  );
}

function readN(obj: Record<string, unknown>, camelKey: string, snakeKey: string): string {
  const value = obj[camelKey] ?? obj[snakeKey];
  return value !== undefined && value !== null ? String(value) : '';
}

function FieldRow({
  label,
  value,
  onChange,
  numeric,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholderTextColor="#555"
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: { justifyContent: 'center', alignItems: 'center' },

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
  backText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 60 },

  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  section: { paddingTop: 20 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#1E1E1E',
    color: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },

  saveBtn: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  uploadBtn: {
    backgroundColor: '#00BFA5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  uploadBtnDisabled: { backgroundColor: '#114D45' },
  uploadBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

const fieldStyles = StyleSheet.create({
  row: { marginBottom: 14 },
  label: { color: '#9E9E9E', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
});
