import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { useCatalogStore } from '../store/catalogStore';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { OffAccountSetup } from '../components/OffAccountSetup/OffAccountSetup';
import { Toast } from '../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { OcrService } from '../infrastructure/ocr/OcrService';
import { OcrCameraSheet } from '../components/OcrCameraSheet/OcrCameraSheet';
import type { ContributeFormData, NutrimentData } from '../types/ContributeFormData';
import { Accordion } from '../components/Accordion';

const repo = new ProductRepository();
const writeClient = new OpenFoodFactsWriteClient();

export default function EditProductScreen() {
  const router = useRouter();
  const { ean } = useLocalSearchParams<{ ean: string }>();
  const catalogStore = useCatalogStore();

  const [cameraTarget, setCameraTarget] = useState<'ingredients' | 'nutriments' | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [nutriments, setNutriments] = useState<Partial<NutrimentData>>({});

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
      repo.findByEan(ean).then((product) => {
        if (product) {
          setName(product.name || '');
          setBrand(product.brands || '');
          setIngredientsText(product.ingredients || '');

          if (product.raw_json) {
            try {
              const parsed = JSON.parse(product.raw_json);
              setCategory(parsed.categories || '');
              const n = parsed.product?.nutriments || parsed.nutriments;
              if (n) {
                setEnergy(n['energy-kcal_100g']?.toString() || '');
                setFat(n.fat_100g?.toString() || '');
                setSatFat(n['saturated-fat_100g']?.toString() || '');
                setCarbs(n.carbohydrates_100g?.toString() || '');
                setSugars(n.sugars_100g?.toString() || '');
                setFiber(n.fiber_100g?.toString() || '');
                setProteins(n.proteins_100g?.toString() || '');
                setSalt(n.salt_100g?.toString() || '');
              }
            } catch (e) {}
          }
        }
        setIsLoading(false);
      }).catch((e) => {
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
      nutriments: {
        energyKcal100g: energyKcal100g ? Number(energyKcal100g) : undefined,
        fat100g: fat100g ? Number(fat100g) : undefined,
        saturatedFat100g: saturatedFat100g ? Number(saturatedFat100g) : undefined,
        carbohydrates100g: carbohydrates100g ? Number(carbohydrates100g) : undefined,
        sugars100g: sugars100g ? Number(sugars100g) : undefined,
        fiber100g: fiber100g ? Number(fiber100g) : undefined,
        proteins100g: proteins100g ? Number(proteins100g) : undefined,
        salt100g: salt100g ? Number(salt100g) : undefined,
      }
    });
    await catalogStore.loadAll(); // Force immediate UI refresh in catalog
    router.back();
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
        }
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
    <View style={styles.nutritionContainer}>
      <Text style={styles.label}>Energie (kcal/100g)</Text>
      <TextInput style={styles.input} value={energyKcal100g} onChangeText={setEnergy} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Fett (g/100g)</Text>
      <TextInput style={styles.input} value={fat100g} onChangeText={setFat} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Gesättigte Fettsäuren (g/100g)</Text>
      <TextInput style={styles.input} value={saturatedFat100g} onChangeText={setSatFat} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Kohlenhydrate (g/100g)</Text>
      <TextInput style={styles.input} value={carbohydrates100g} onChangeText={setCarbs} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Zucker (g/100g)</Text>
      <TextInput style={styles.input} value={sugars100g} onChangeText={setSugars} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Ballaststoffe (g/100g)</Text>
      <TextInput style={styles.input} value={fiber100g} onChangeText={setFiber} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Protein (g/100g)</Text>
      <TextInput style={styles.input} value={proteins100g} onChangeText={setProteins} keyboardType="numeric" placeholderTextColor="#aaa" />
      <Text style={styles.label}>Salz (g/100g)</Text>
      <TextInput style={styles.input} value={salt100g} onChangeText={setSalt} keyboardType="numeric" placeholderTextColor="#aaa" />
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

      <Text style={styles.title}>Produkt bearbeiten</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Produktname" placeholderTextColor="#aaa" />

        <Text style={styles.label}>Marke</Text>
        <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marke" placeholderTextColor="#aaa" />

        <Text style={styles.label}>Kategorie (Offline)</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Kategorie" placeholderTextColor="#aaa" />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Zutaten</Text>
          <TouchableOpacity onPress={() => setCameraTarget('ingredients')}>
            <Ionicons name="camera" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        <TextInput style={[styles.input, styles.multiline]} value={ingredientsText} onChangeText={setIngredientsText} multiline placeholder="Zutatenliste..." placeholderTextColor="#aaa" />

        <View style={[styles.labelRow, { marginTop: 10, marginBottom: 10 }]}>
          <Text style={styles.label}>Nährwerte per 100g</Text>
          <TouchableOpacity onPress={() => setCameraTarget('nutriments')}>
            <Ionicons name="camera" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        <Accordion items={[{ title: 'Nährwerte bearbeiten', content: nutritionContent }]} />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Speichern</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadBtn, !isUploadEnabled && styles.uploadBtnDisabled]}
          onPress={handleUploadOFF}
          disabled={!isUploadEnabled || isUploading}
        >
          {isUploading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.uploadBtnText}>Upload to Open Food Facts</Text>}
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
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20, marginTop: 40 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  label: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: '#1E1E1E', color: '#fff', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  nutritionContainer: { paddingTop: 8 },
  saveBtn: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  uploadBtn: { backgroundColor: '#00BFA5', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  uploadBtnDisabled: { backgroundColor: '#114D45' },
  uploadBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { backgroundColor: '#333', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  cancelBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  camera: { flex: 1, margin: -20 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  cameraTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
  scrollContent: { paddingBottom: 40 },
  cameraBackButton: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 },
  cameraBackText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cameraInstruction: { color: '#fff', fontSize: 18, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
  cameraPlaceholder: { width: 60 },
  cameraBottomBar: { alignItems: 'center', marginBottom: 40 },
  cameraCaptureBtn: { backgroundColor: '#4CAF50', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30 },
  cameraCaptureText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
