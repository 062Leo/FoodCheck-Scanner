import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ProductLookupService,
  type LookupFailure,
  type LookupIntent,
  type LookupResult,
} from '../../services/ProductLookupService';
import { useFilterStore } from '../../store/filterStore';
import { useCatalogStore } from '../../store/catalogStore';

export type FoundProduct = Extract<LookupResult, { status: 'found' }>;

export type ProductDetailsState =
  | { phase: 'loading' }
  | { phase: 'failed'; reason: LookupFailure }
  | { phase: 'ready'; data: FoundProduct };

const lookupService = new ProductLookupService();

async function currentRules() {
  const store = useFilterStore.getState();
  if (!store.isInitialized) {
    await store.loadRules();
  }
  return useFilterStore.getState().rules;
}

/**
 * How the screen was opened: after a scan (counts as a visit), from a list (view), or
 * from the scanner's result card ('recent': the product was just fetched and stored,
 * so it is read from the device first).
 */
export type OpenIntent = LookupIntent | 'recent';

/**
 * Loads and rates a product for the product screen.
 * `intent` applies to the first load only; retries and refreshes never count as a scan.
 */
export function useProductDetails(ean: string | undefined, intent: OpenIntent) {
  const [state, setState] = useState<ProductDetailsState>({ phase: 'loading' });
  const intentRef = useRef<OpenIntent>(intent);
  const requestRef = useRef(0);
  const phaseRef = useRef<ProductDetailsState['phase']>('loading');
  phaseRef.current = state.phase;

  const load = useCallback(async () => {
    if (!ean) {
      setState({ phase: 'failed', reason: 'error' });
      return;
    }
    const request = ++requestRef.current;
    setState({ phase: 'loading' });

    const rules = await currentRules();
    const local =
      intentRef.current === 'recent'
        ? await lookupService.lookupLocal(ean, rules).catch(() => null)
        : null;
    const result =
      local?.status === 'found'
        ? local
        : await lookupService
            .lookup(ean, intentRef.current === 'scan' ? 'scan' : 'view', rules)
            .catch((): LookupResult => ({ status: 'error' }));
    intentRef.current = 'view';
    if (request !== requestRef.current) return;

    setState(
      result.status === 'found'
        ? { phase: 'ready', data: result }
        : { phase: 'failed', reason: result.status }
    );
    void useCatalogStore.getState().loadAll();
  }, [ean]);

  /** Re-reads the stored product without network and without a loading state. */
  const refreshLocal = useCallback(async () => {
    if (!ean || phaseRef.current === 'loading') return;
    const request = ++requestRef.current;
    const result = await lookupService.lookupLocal(ean, await currentRules()).catch(() => null);
    if (request !== requestRef.current || result?.status !== 'found') return;
    setState((previous) => ({
      phase: 'ready',
      data:
        previous.phase === 'ready'
          ? { ...result, source: previous.data.source, networkFailed: previous.data.networkFailed }
          : result,
    }));
  }, [ean]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load, refreshLocal };
}
