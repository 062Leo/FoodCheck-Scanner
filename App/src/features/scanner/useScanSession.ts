import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
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
  const type =
    result.status !== 'found'
      ? Haptics.NotificationFeedbackType.Error
      : result.rating.status === 'OK'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning;
  void Haptics.notificationAsync(type).catch(() => {});
}

/**
 * Scanning in a row: each accepted barcode is looked up and shown as a card on the
 * scanner; the camera keeps running so the next product can be scanned right away.
 */
export function useScanSession() {
  const [card, setCard] = useState<ScanCard | null>(null);
  const gate = useRef(new ScanGate()).current;

  const lookup = useCallback(
    async (ean: string) => {
      setCard({ ean, phase: 'loading' });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const store = useFilterStore.getState();
      if (!store.isInitialized) await store.loadRules();
      const result = await lookupService
        .lookup(ean, 'scan', useFilterStore.getState().rules)
        .catch((): LookupResult => ({ status: 'error' }));

      setCard(
        result.status === 'found'
          ? { ean, phase: 'ready', data: result }
          : { ean, phase: 'failed', reason: result.status }
      );
      feedback(result);
      gate.release(Date.now());
      void useCatalogStore.getState().loadAll();
    },
    [gate]
  );

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
