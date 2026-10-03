import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, type TranslateFn } from '../i18n/useTranslation';
import { INGREDIENT_LANGUAGES, languageLabel } from '../i18n/languageLabel';
import type { TranslationKey } from '../i18n/translations';
import {
  NUTRIENT_FIELDS,
  payloadSummary,
  type FormErrorKey,
  type NutrientField,
} from '../domain/product/productForm';
import { parseNutritionLabel } from '../domain/ocr/nutritionLabel';
import { useProductEditForm } from '../features/edit/useProductEditForm';
import { ALL_LANGUAGES, LanguagePicker } from '../features/edit/LanguagePicker';
import { TranslationRouter } from '../infrastructure/translation/TranslationRouter';
import { UploadError } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { WRITE_ENV, WRITE_HOST } from '../infrastructure/api/config';
import { OcrCameraSheet } from '../components/OcrCameraSheet';
import { OffAccountSetup } from '../components/OffAccountSetup';
import { Toast } from '../components/Toast';
import { Button, Card, Chip, IconButton, ScreenHeader, SectionTitle } from '../ui/components';
import { FormField } from '../ui/FormField';
import { colors, spacing, typography } from '../ui/theme';

const translationRouter = new TranslationRouter();

const NUTRIENT_LABELS: Record<NutrientField, TranslationKey> = {
  energyKcal100g: 'edit.field.energy',
  fat100g: 'edit.field.fat',
  saturatedFat100g: 'edit.field.saturatedFat',
  carbohydrates100g: 'edit.field.carbs',
  sugars100g: 'edit.field.sugar',
  fiber100g: 'edit.field.fiber',
  proteins100g: 'edit.field.protein',
  salt100g: 'edit.field.salt',
};

type OcrTarget = { mode: 'ingredients'; lang: string } | { mode: 'nutriments' };
type Picker = { kind: 'add' } | { kind: 'translate'; from: string } | null;
type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

function errorText(error: FormErrorKey | undefined, t: TranslateFn): string | undefined {
  return error ? t(`edit.error.${error}`) : undefined;
}

function uploadFailureReason(error: unknown, t: TranslateFn): string {
  if (error instanceof UploadError) {
    if (error.code === 'network') return t('upload.reason.network');
    if (error.code === 'invalid-credentials' || error.code === 'no-credentials') {
      return t('upload.reason.credentials');
    }
  }
  return t('upload.reason.rejected');
}

export default function EditProductScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const params = useLocalSearchParams<{ ean: string; then?: string }>();
  const ean = params.ean;
  const form = useProductEditForm(ean);
  const { values, errors, busy } = form;

  const [ocrTarget, setOcrTarget] = useState<OcrTarget | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [translating, setTranslating] = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const leavingRef = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // An upload that finishes after the screen was closed must not navigate anymore.
  useEffect(() => {
    leavingRef.current = false;
    return () => {
      leavingRef.current = true;
      clearTimeout(leaveTimer.current);
    };
  }, []);

  // Ask before leaving with unsaved changes.
  useEffect(() => {
    if (!form.isDirty) return;
    return navigation.addListener('beforeRemove', (event) => {
      if (leavingRef.current) return;
      event.preventDefault();
      Alert.alert(t('edit.unsavedTitle'), t('edit.unsavedMsg'), [
        { text: t('edit.cancel'), style: 'cancel' },
        {
          text: t('edit.discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
  }, [form.isDirty, navigation, t]);

  // Leaves once: a save during the upload's success toast must not navigate a second time.
  const leave = useCallback(() => {
    if (leavingRef.current) return;
    clearTimeout(leaveTimer.current);
    leavingRef.current = true;
    if (params.then === 'show' || !router.canGoBack()) {
      router.replace({ pathname: '/result', params: { ean, source: 'recent' } });
    } else {
      router.back();
    }
  }, [ean, params.then, router]);

  const languages = useMemo(() => Object.keys(values?.ingredients ?? {}), [values?.ingredients]);
  const missingLanguages = INGREDIENT_LANGUAGES.filter((lang) => !languages.includes(lang));

  const onSave = async () => {
    const result = await form.save();
    if (result.ok) {
      leave();
    } else if (result.reason === 'invalid') {
      setToast({ message: t('edit.errors.fix'), type: 'error' });
    } else {
      setToast({ message: t('edit.saveFailed'), type: 'error' });
    }
  };

  const onUpload = async () => {
    if (!values) return;
    if (Object.keys(form.offPayload).length === 0) {
      // Clearing a value is kept on the device; OFF only receives values.
      const message = form.hasChanges ? t('upload.onlyCleared') : t('upload.nothingChanged');
      setToast({ message, type: 'info' });
      return;
    }
    const check = await form.prepareUpload();
    if (!check.ok) {
      if (check.reason === 'needs-account') setShowAccountSetup(true);
      else if (check.reason === 'invalid')
        setToast({ message: t('edit.errors.fix'), type: 'error' });
      return;
    }

    const fields = payloadSummary(form.offPayload).map((part) => {
      if (part.startsWith('ingredients:')) {
        return `• ${t('upload.field.ingredients', { langs: part.split(':')[1] })}`;
      }
      return `• ${t(`upload.field.${part}` as TranslationKey)}`;
    });
    const body = [
      t('upload.confirmBody', { host: WRITE_HOST, fields: fields.join('\n') }),
      WRITE_ENV === 'staging' ? t('upload.confirmStaging') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert(t('upload.confirmTitle'), body, [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('upload.send'),
        onPress: async () => {
          const result = await form.upload();
          if (result.ok) {
            setToast({ message: t('upload.success'), type: 'success' });
            leaveTimer.current = setTimeout(leave, 1200);
          } else {
            const reason = result.reason === 'failed' ? uploadFailureReason(result.error, t) : '';
            setToast({ message: t('upload.failed', { reason }), type: 'error' });
          }
        },
      },
    ]);
  };

  const translate = async (from: string, targets: string[]) => {
    const source = values?.ingredients[from]?.trim();
    setPicker(null);
    if (!source) {
      Alert.alert(t('edit.translate.noText'), t('edit.translate.noTextMsg'));
      return;
    }
    setTranslating(true);
    let failed = 0;
    for (const target of targets) {
      try {
        const translated = await translationRouter.translate(source, target);
        if (translated && translated !== source) form.setIngredients(target, translated);
        else failed++;
      } catch {
        failed++;
      }
    }
    setTranslating(false);
    if (failed > 0) {
      setToast({
        message: t('edit.translate.partialMsg', { n: failed, m: targets.length }),
        type: 'error',
      });
    }
  };

  const onOcrText = (text: string) => {
    const target = ocrTarget;
    setOcrTarget(null);
    if (!target) return;
    if (target.mode === 'ingredients') {
      form.setIngredients(target.lang, text);
      return;
    }
    const count = form.applyNutrition(parseNutritionLabel(text));
    setToast(
      count > 0
        ? {
            message: count === 1 ? t('edit.ocrFilledOne') : t('edit.ocrFilled', { count }),
            type: 'info',
          }
        : { message: t('edit.ocrNothing'), type: 'error' }
    );
  };

  if (form.loadError || !ean) {
    return (
      <View style={styles.container}>
        <ScreenHeader onBack={() => router.back()} backLabel={t('common.back')} />
        <Text style={styles.centerText}>{t('product.error.genericBody')}</Text>
      </View>
    );
  }

  if (!values) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isNew = !form.session?.record;
  // USDA data is not Open Food Facts data and must not be sent there as if it were.
  const fromUsda = form.session?.product.source === 'usda';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isNew ? t('edit.newProduct') : t('edit.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.ean}>{t('product.ean', { ean })}</Text>
          {fromUsda && <Text style={styles.hint}>{t('edit.usdaNoUpload')}</Text>}

          <View style={styles.section}>
            <SectionTitle>{t('edit.section.product')}</SectionTitle>
            <FormField
              label={t('edit.field.name')}
              value={values.name}
              onChangeText={(v) => form.setField('name', v)}
              error={errorText(errors.name, t)}
              required
              testID="edit-name"
            />
            <FormField
              label={t('edit.field.brand')}
              value={values.brand}
              onChangeText={(v) => form.setField('brand', v)}
            />
            <FormField
              label={t('edit.field.quantity')}
              value={values.quantity}
              onChangeText={(v) => form.setField('quantity', v)}
              placeholder="500 g"
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>{t('edit.section.ingredientsList')}</SectionTitle>
            {languages.length === 0 && (
              <Text style={styles.hint}>{t('edit.noIngredientsYet')}</Text>
            )}
            {languages.map((lang) => (
              <Card key={lang} style={styles.languageCard}>
                <View style={styles.languageHeader}>
                  <Text style={styles.languageTitle}>{languageLabel(lang, t)}</Text>
                  <IconButton
                    icon="camera-outline"
                    label={t('edit.a11y.scanLanguage', { lang: languageLabel(lang, t) })}
                    onPress={() => setOcrTarget({ mode: 'ingredients', lang })}
                  />
                  <IconButton
                    icon="language-outline"
                    label={t('edit.a11y.translateLanguage', { lang: languageLabel(lang, t) })}
                    onPress={() => setPicker({ kind: 'translate', from: lang })}
                    disabled={missingLanguages.length === 0}
                  />
                  <IconButton
                    icon="trash-outline"
                    color={colors.danger}
                    label={t('edit.a11y.removeLanguage', { lang: languageLabel(lang, t) })}
                    onPress={() => form.setIngredients(lang, null)}
                  />
                </View>
                <FormField
                  label={t('edit.ingredients.placeholder', { lang: languageLabel(lang, t) })}
                  value={values.ingredients[lang]}
                  onChangeText={(v) => form.setIngredients(lang, v)}
                  multiline
                />
              </Card>
            ))}
            {translating && <ActivityIndicator color={colors.accent} />}
            <View style={styles.row}>
              {!languages.includes(language) && (
                <Button
                  title={t('edit.scanIngredients')}
                  icon="camera-outline"
                  variant="secondary"
                  onPress={() => setOcrTarget({ mode: 'ingredients', lang: language })}
                  style={styles.flex}
                />
              )}
              {missingLanguages.length > 0 && (
                <Button
                  title={t('edit.addLanguage')}
                  icon="add"
                  variant="ghost"
                  onPress={() => setPicker({ kind: 'add' })}
                  style={styles.flex}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle>{t('edit.section.nutrition')}</SectionTitle>
            <Button
              title={t('edit.scanNutrition')}
              icon="camera-outline"
              variant="secondary"
              onPress={() => setOcrTarget({ mode: 'nutriments' })}
            />
            <Text style={styles.hint}>{t('edit.nutritionHint')}</Text>
            <View style={styles.grid}>
              {NUTRIENT_FIELDS.map((field) => (
                <View key={field.key} style={styles.gridCell}>
                  <FormField
                    label={t(NUTRIENT_LABELS[field.key])}
                    value={values.nutriments[field.key]}
                    onChangeText={(v) => form.setNutrient(field.key, v)}
                    keyboardType="decimal-pad"
                    error={errorText(errors[field.key], t)}
                    testID={`edit-${field.key}`}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle>{t('edit.section.allergens')}</SectionTitle>
            <FormField
              label={t('edit.field.contains')}
              value={values.allergens}
              onChangeText={(v) => form.setField('allergens', v)}
            />
            <FormField
              label={t('edit.field.traces')}
              value={values.traces}
              onChangeText={(v) => form.setField('traces', v)}
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>{t('edit.section.more')}</SectionTitle>
            <Text style={styles.label}>{t('edit.field.nova')}</Text>
            <View style={styles.row}>
              {['', '1', '2', '3', '4'].map((nova) => (
                <Chip
                  key={nova || 'none'}
                  label={nova || t('edit.nova.none')}
                  selected={values.nova === nova}
                  onPress={() => form.setField('nova', nova)}
                />
              ))}
            </View>
            <Text style={styles.hint}>{t('edit.nova.hint')}</Text>
            <FormField
              label={t('edit.field.category')}
              value={values.categories}
              onChangeText={(v) => form.setField('categories', v)}
            />
            <FormField
              label={t('edit.field.servingSize')}
              value={values.servingSize}
              onChangeText={(v) => form.setField('servingSize', v)}
            />
            <FormField
              label={t('edit.field.origin')}
              value={values.origins}
              onChangeText={(v) => form.setField('origins', v)}
            />
            <FormField
              label={t('edit.field.manufacturingPlace')}
              value={values.manufacturingPlaces}
              onChangeText={(v) => form.setField('manufacturingPlaces', v)}
            />
            <FormField
              label={t('edit.field.stores')}
              value={values.stores}
              onChangeText={(v) => form.setField('stores', v)}
            />
          </View>
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          {!fromUsda && (
            <Button
              title={t('edit.uploadOff')}
              icon="cloud-upload-outline"
              variant="secondary"
              onPress={() => void onUpload()}
              loading={busy === 'upload'}
              disabled={busy !== null}
              style={styles.flex}
            />
          )}
          <Button
            title={t('edit.saveLocal')}
            icon="checkmark"
            onPress={() => void onSave()}
            loading={busy === 'save'}
            disabled={busy !== null}
            style={styles.flex}
            testID="edit-save"
          />
        </View>
      </KeyboardAvoidingView>

      <OcrCameraSheet
        visible={ocrTarget !== null}
        mode={ocrTarget?.mode ?? 'ingredients'}
        barcode={ean}
        lang={ocrTarget?.mode === 'ingredients' ? ocrTarget.lang : undefined}
        onConfirm={onOcrText}
        onCancel={() => setOcrTarget(null)}
      />

      <LanguagePicker
        visible={picker !== null}
        title={
          picker?.kind === 'translate'
            ? t('edit.langPicker.translateFrom', { lang: languageLabel(picker.from, t) })
            : t('edit.langPicker.choose')
        }
        languages={missingLanguages}
        includeAll={picker?.kind === 'translate'}
        t={t}
        onClose={() => setPicker(null)}
        onSelect={(lang) => {
          if (picker?.kind === 'translate') {
            void translate(picker.from, lang === ALL_LANGUAGES ? [...missingLanguages] : [lang]);
          } else {
            form.setIngredients(lang, '');
            setPicker(null);
          }
        }}
      />

      <OffAccountSetup
        visible={showAccountSetup}
        onSuccess={() => {
          setShowAccountSetup(false);
          void onUpload();
        }}
        onCancel={() => setShowAccountSetup(false)}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  centerText: { ...typography.body, color: colors.textSecondary, padding: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  ean: { ...typography.caption, color: colors.textMuted },
  section: { gap: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.label, color: colors.textSecondary },
  languageCard: { gap: spacing.sm, paddingTop: spacing.sm },
  languageHeader: { flexDirection: 'row', alignItems: 'center' },
  languageTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  gridCell: { width: '50%', paddingHorizontal: spacing.xs, marginBottom: spacing.md },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
