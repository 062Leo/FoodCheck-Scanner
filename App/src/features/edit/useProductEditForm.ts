import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductNutriments } from '../../types/Product';
import {
  NUTRIENT_FIELDS,
  formSnapshot,
  validateForUpload,
  validateForm,
  type FormErrors,
  type NutrientField,
  type ProductFormValues,
} from '../../domain/product/productForm';
import { ProductEditService, type EditSession } from '../../services/ProductEditService';
import { OpenFoodFactsWriteClient } from '../../infrastructure/api/OpenFoodFactsWriteClient';
import { useFilterStore } from '../../store/filterStore';
import { useCatalogStore } from '../../store/catalogStore';

const editService = new ProductEditService();
const writeClient = new OpenFoodFactsWriteClient();

type TextField = Exclude<keyof ProductFormValues, 'ingredients' | 'nutriments'>;

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; errors: FormErrors }
  | { ok: false; reason: 'needs-account' }
  | { ok: false; reason: 'failed'; error: unknown };

async function currentRules() {
  const store = useFilterStore.getState();
  if (!store.isInitialized) await store.loadRules();
  return useFilterStore.getState().rules;
}

/** Form state and actions of the edit screen. Nothing is stored before `save`. */
export function useProductEditForm(ean: string | undefined) {
  const [session, setSession] = useState<EditSession | null>(null);
  const [values, setValues] = useState<ProductFormValues | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [errorMode, setErrorMode] = useState<'none' | 'save' | 'upload'>('none');
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null);

  useEffect(() => {
    if (!ean) return;
    let cancelled = false;
    editService
      .open(ean)
      .then((opened) => {
        if (cancelled) return;
        setSession(opened);
        setValues(opened.initial);
        setSavedSnapshot(formSnapshot(opened.initial));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ean]);

  const errors = useMemo<FormErrors>(() => {
    if (!values || errorMode === 'none') return {};
    return errorMode === 'upload' ? validateForUpload(values) : validateForm(values);
  }, [values, errorMode]);
  const isDirty = values !== null && formSnapshot(values) !== savedSnapshot;

  const setField = useCallback((field: TextField, value: string) => {
    setValues((previous) => (previous ? { ...previous, [field]: value } : previous));
  }, []);

  const setNutrient = useCallback((field: NutrientField, value: string) => {
    setValues((previous) =>
      previous ? { ...previous, nutriments: { ...previous.nutriments, [field]: value } } : previous
    );
  }, []);

  const setIngredients = useCallback((lang: string, text: string | null) => {
    setValues((previous) => {
      if (!previous) return previous;
      const ingredients = { ...previous.ingredients };
      if (text === null) delete ingredients[lang];
      else ingredients[lang] = text;
      return { ...previous, ingredients };
    });
  }, []);

  /** Fills recognised nutrition values; returns how many were taken over. */
  const applyNutrition = useCallback((parsed: Partial<ProductNutriments>): number => {
    const entries = NUTRIENT_FIELDS.filter((f) => parsed[f.key] !== undefined);
    setValues((previous) => {
      if (!previous) return previous;
      const nutriments = { ...previous.nutriments };
      for (const field of entries) nutriments[field.key] = String(parsed[field.key]);
      return { ...previous, nutriments };
    });
    return entries.length;
  }, []);

  const persist = useCallback(async (): Promise<SubmitResult> => {
    if (!session || !values) return { ok: false, reason: 'failed', error: 'not loaded' };
    try {
      await editService.save(session, values, await currentRules());
      const saved = await editService.open(session.ean);
      setSession(saved);
      setSavedSnapshot(formSnapshot(values));
      void useCatalogStore.getState().loadAll();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'failed', error };
    }
  }, [session, values]);

  const save = useCallback(async (): Promise<SubmitResult> => {
    if (!values) return { ok: false, reason: 'failed', error: 'not loaded' };
    const validation = validateForm(values);
    if (Object.keys(validation).length > 0) {
      setErrorMode('save');
      return { ok: false, reason: 'invalid', errors: validation };
    }
    setBusy('save');
    try {
      return await persist();
    } finally {
      setBusy(null);
    }
  }, [values, persist]);

  /** Checks everything needed before the confirmation dialog is shown. */
  const prepareUpload = useCallback(async (): Promise<SubmitResult> => {
    if (!values) return { ok: false, reason: 'failed', error: 'not loaded' };
    const validation = validateForUpload(values);
    if (Object.keys(validation).length > 0) {
      setErrorMode('upload');
      return { ok: false, reason: 'invalid', errors: validation };
    }
    if (!(await writeClient.loadCredentials())) return { ok: false, reason: 'needs-account' };
    return { ok: true };
  }, [values]);

  /** Saves locally first (so nothing is lost if sending fails), then contributes. */
  const upload = useCallback(async (): Promise<SubmitResult> => {
    if (!session || !values) return { ok: false, reason: 'failed', error: 'not loaded' };
    setBusy('upload');
    try {
      const saved = await persist();
      if (!saved.ok) return saved;
      await editService.contribute(session.ean, values);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'failed', error };
    } finally {
      setBusy(null);
    }
  }, [session, values, persist]);

  return {
    session,
    values,
    errors,
    loadError,
    isDirty,
    busy,
    setField,
    setNutrient,
    setIngredients,
    applyNutrition,
    save,
    prepareUpload,
    upload,
  };
}
