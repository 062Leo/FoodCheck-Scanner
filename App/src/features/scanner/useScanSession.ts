import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hasAllergenMatch, matchAllergens } from '../../domain/allergens/allergenProfile';
import { useAllergenStore } from '../../store/allergenStore';
import { normalizeBarcode } from '../../domain/barcode/barcode';
import {
  ProductLookupService,
  type LookupFailure,
  type LookupResult,
} from '../../services/ProductLookupService';
import { useFilterStore } from '../../store/filterStore';
import { useCatalogStore } from '../../store/catalogStore';
import { ScanGate } from './ScanGate';

export type FoundResult = Extract<LookupResult, { status: 'found' }>;

export type ScanCard =
  | { ean: string; phase: 'loading' }
  | { ean: string; phase: 'ready'; data: FoundResult }
  | { ean: string; phase: 'failed'; reason: LookupFailure };

const lookupService = new ProductLookupService();

function feedback(result: LookupResult): void {
  // A product with an allergen from the profile never gets the "all good" vibration.
  const allergen =
    result.status === 'found' &&
    hasAllergenMatch(matchAllergens(result.product, useAllergenStore.getState().profile));
  const type =
    result.status !== 'found'
      ? Haptics.NotificationFeedbackType.Error
      : result.rating.status === 'OK' && !allergen
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning;
  void Haptics.notificationAsync(type).catch(() => {});
}

/**
 * Scanning in a row: each accepted barcode is looked up and shown as a card on the
 * scanner; the camera keeps running so the next product can be scanned right away.
 */
export function useScanSession(announce?: (card: ScanCard) => string) {
  const [card, setCard] = useState<ScanCard | null>(null);
  const gate = useRef(new ScanGate()).current;
  /** A barcode typed in while another lookup was still running. */
  const pendingManual = useRef<string | null>(null);

  const lookup = useCallback(
    async (ean: string) => {
      setCard({ ean, phase: 'loading' });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const store = useFilterStore.getState();
      if (!store.isInitialized) await store.loadRules();
      const result = await lookupService
        .lookup(ean, 'scan', useFilterStore.getState().rules)
        .catch((): LookupResult => ({ status: 'error' }));

      const next: ScanCard =
        result.status === 'found'
          ? { ean, phase: 'ready', data: result }
          : { ean, phase: 'failed', reason: result.status };
      setCard(next);
      feedback(result);
      if (announce) AccessibilityInfo.announceForAccessibility(announce(next));
      gate.release(Date.now());
      void useCatalogStore.getState().loadAll();

      const queued = pendingManual.current;
      pendingManual.current = null;
      if (queued && gate.tryAcquire(queued, Date.now(), true)) void lookupRef.current(queued);
    },
    [gate, announce]
  );
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  /** Called for every camera detection; ignores invalid codes and repeats. */
  const onBarcode = useCallback(
    (raw: string) => {
      const ean = normalizeBarcode(raw);
      if (!ean || !gate.tryAcquire(ean, Date.now())) return;
      void lookup(ean);
    },
    [gate, lookup]
  );

  /** Manual entry: returns false if the code is invalid. */
  const submitManual = useCallback(
    (raw: string): boolean => {
      const ean = normalizeBarcode(raw);
      if (!ean) return false;
      if (gate.tryAcquire(ean, Date.now(), true)) void lookup(ean);
      else pendingManual.current = ean; // runs as soon as the current lookup is done
      return true;
    },
    [gate, lookup]
  );

  const dismiss = useCallback(() => {
    gate.dismiss(Date.now());
    setCard(null);
  }, [gate]);

  const retry = useCallback(() => {
    if (card && gate.tryAcquire(card.ean, Date.now(), true)) {
      void lookup(card.ean);
    }
  }, [card, gate, lookup]);

  return { card, onBarcode, submitManual, dismiss, retry };
}
