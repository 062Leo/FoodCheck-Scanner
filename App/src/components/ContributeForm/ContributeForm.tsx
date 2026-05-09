import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ContributeFormData, NutrimentData } from '../../types/ContributeFormData';
import { Accordion } from '../Accordion';

interface ContributeFormProps {
  ean: string;
  initialIngredients: string;
  initialNutriments: Partial<NutrimentData>;
  onSubmit: (data: ContributeFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function ContributeForm({ ean, initialIngredients, initialNutriments, onSubmit, isSubmitting }: ContributeFormProps) {
  const [productName, setProductName] = useState('');
  const [brands, setBrands] = useState('');
  const [categories, setCategories] = useState('');
  const [ingredientsText, setIngredientsText] = useState(initialIngredients || '');
  
  const [energyKcal100g, setEnergy] = useState(initialNutriments?.energyKcal100g?.toString() || '');
  const [fat100g, setFat] = useState(initialNutriments?.fat100g?.toString() || '');
  const [saturatedFat100g, setSatFat] = useState(initialNutriments?.saturatedFat100g?.toString() || '');
  const [carbohydrates100g, setCarbs] = useState(initialNutriments?.carbohydrates100g?.toString() || '');
  const [sugars100g, setSugars] = useState(initialNutriments?.sugars100g?.toString() || '');
  const [fiber100g, setFiber] = useState(initialNutriments?.fiber100g?.toString() || '');
  const [proteins100g, setProteins] = useState(initialNutriments?.proteins100g?.toString() || '');
  const [salt100g, setSalt] = useState(initialNutriments?.salt100g?.toString() || '');

  // Synchronize incoming OCR data if it becomes available later
  useEffect(() => {
    if (initialIngredients) setIngredientsText(initialIngredients);
  }, [initialIngredients]);

  useEffect(() => {
    if (initialNutriments) {
      if (initialNutriments.energyKcal100g !== undefined) setEnergy(initialNutriments.energyKcal100g.toString());
      if (initialNutriments.fat100g !== undefined) setFat(initialNutriments.fat100g.toString());
      if (initialNutriments.saturatedFat100g !== undefined) setSatFat(initialNutriments.saturatedFat100g.toString());
      if (initialNutriments.carbohydrates100g !== undefined) setCarbs(initialNutriments.carbohydrates100g.toString());
      if (initialNutriments.sugars100g !== undefined) setSugars(initialNutriments.sugars100g.toString());
      if (initialNutriments.fiber100g !== undefined) setFiber(initialNutriments.fiber100g.toString());
      if (initialNutriments.proteins100g !== undefined) setProteins(initialNutriments.proteins100g.toString());
      if (initialNutriments.salt100g !== undefined) setSalt(initialNutriments.salt100g.toString());
    }
  }, [initialNutriments]);

  const handleConfirm = () => {
    Alert.alert(
      'Are you sure?',
      'This will be publicly visible on Open Food Facts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm & Upload', 
          onPress: () => {
            const formData: ContributeFormData = {
              ean,
              productName,
              brands,
              categories,
              ingredientsText,
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
            onSubmit(formData);
          }
        }
      ]
    );
  };

  const isSubmitDisabled = !productName.trim() || isSubmitting;

  const nutritionContent = (
    <View style={styles.nutritionContainer}>
      <Text style={styles.label}>Energy (kcal/100g)</Text>
      <TextInput style={styles.input} value={energyKcal100g} onChangeText={setEnergy} keyboardType="numeric" placeholderTextColor="#757575" placeholder="e.g. 250" />
      
      <Text style={styles.label}>Fat (g/100g)</Text>
      <TextInput style={styles.input} value={fat100g} onChangeText={setFat} keyboardType="numeric" placeholderTextColor="#757575" />
      
      <Text style={styles.label}>Saturated Fat (g/100g)</Text>
      <TextInput style={styles.input} value={saturatedFat100g} onChangeText={setSatFat} keyboardType="numeric" placeholderTextColor="#757575" />

      <Text style={styles.label}>Carbohydrates (g/100g)</Text>
      <TextInput style={styles.input} value={carbohydrates100g} onChangeText={setCarbs} keyboardType="numeric" placeholderTextColor="#757575" />

      <Text style={styles.label}>Sugar (g/100g)</Text>
      <TextInput style={styles.input} value={sugars100g} onChangeText={setSugars} keyboardType="numeric" placeholderTextColor="#757575" />

      <Text style={styles.label}>Fiber (g/100g)</Text>
      <TextInput style={styles.input} value={fiber100g} onChangeText={setFiber} keyboardType="numeric" placeholderTextColor="#757575" />

      <Text style={styles.label}>Protein (g/100g)</Text>
      <TextInput style={styles.input} value={proteins100g} onChangeText={setProteins} keyboardType="numeric" placeholderTextColor="#757575" />

      <Text style={styles.label}>Salt (g/100g)</Text>
      <TextInput style={styles.input} value={salt100g} onChangeText={setSalt} keyboardType="numeric" placeholderTextColor="#757575" />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Product Details</Text>

      <Text style={styles.label}>Product Name *</Text>
      <TextInput style={styles.input} value={productName} onChangeText={setProductName} placeholder="e.g. Oat Milk" placeholderTextColor="#757575" />

      <Text style={styles.label}>Brand / Manufacturer</Text>
      <TextInput style={styles.input} value={brands} onChangeText={setBrands} placeholder="e.g. Oatly" placeholderTextColor="#757575" />

      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={categories} onChangeText={setCategories} placeholder="e.g. Beverages" placeholderTextColor="#757575" />

      <Text style={styles.label}>Ingredients</Text>
      <TextInput style={[styles.input, styles.multiline]} value={ingredientsText} onChangeText={setIngredientsText} multiline placeholder="Water, oats..." placeholderTextColor="#757575" />

      <View style={{ marginTop: 24, marginBottom: 8 }}>
        <Accordion items={[{ title: 'Nutrition per 100g', content: nutritionContent }]} />
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>ℹ️ This will be saved publicly on Open Food Facts.</Text>
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
        onPress={handleConfirm}
        disabled={isSubmitDisabled}
      >
        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Confirm & Upload</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', width: '100%' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24 },
  label: { color: '#BDBDBD', fontSize: 14, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1E1E1E', color: '#FFFFFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  nutritionContainer: { paddingTop: 8 },
  infoBanner: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 24, marginBottom: 24 },
  infoBannerText: { color: '#0056B3', fontSize: 14 },
  submitButton: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
