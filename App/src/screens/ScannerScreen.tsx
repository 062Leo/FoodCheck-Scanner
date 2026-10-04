import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/useTranslation';
import { subscribeToConnectivity } from '../infrastructure/network/connectivity';
import { useScanSession, type ScanCard } from '../features/scanner/useScanSession';
import { ScanResultCard, scanCardAnnouncement } from '../features/scanner/ScanResultCard';
import { selectActiveProfile, useAllergenStore } from '../store/allergenStore';
import { ManualEntrySheet } from '../features/scanner/ManualEntrySheet';
import { Button, EmptyState, IconButton } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const;

export default function ScannerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const focused = useRef(false);
  const askedOnce = useRef(false);
  const [active, setActive] = useState(true);
  const [torch, setTorch] = useState(false);
  const [offline, setOffline] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  // Read the profile when the result arrives, not when the lookup started.
  const announce = useCallback(
    (scanCard: ScanCard) =>
      scanCardAnnouncement(scanCard, t, selectActiveProfile(useAllergenStore.getState())),
    [t]
  );
  const { card, onBarcode, submitManual, dismiss, retry } = useScanSession(announce);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setActive(true);
      cameraRef.current?.resumePreview();
      return () => {
        focused.current = false;
        setActive(false);
        setTorch(false);
        cameraRef.current?.pausePreview();
      };
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Camera access may have been granted in the system settings meanwhile.
        void getPermission();
      }
      // The camera is shared app-wide: an unfocused scanner must not take it from another screen.
      if (!focused.current) return;
      if (state === 'active') {
        cameraRef.current?.resumePreview();
      } else {
        cameraRef.current?.pausePreview();
        setTorch(false);
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  useEffect(() => subscribeToConnectivity((online) => setOffline(!online)), []);

  // Ask by itself only once: after a "Don't allow" the button asks again, because a second
  // refusal makes Android stop asking for good.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !askedOnce.current) {
      askedOnce.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const openDetails = useCallback(() => {
    if (card?.phase !== 'ready') return;
    router.push({ pathname: '/result', params: { ean: card.ean, source: 'recent' } });
  }, [card, router]);

  const addProduct = useCallback(() => {
    if (!card) return;
    const ean = card.ean;
    dismiss();
    router.push({ pathname: '/edit/[ean]', params: { ean, then: 'show' } });
  }, [card, dismiss, router]);

  const bottomArea = (
    <View style={[styles.bottom, { paddingBottom: spacing.lg }]}>
      {card ? (
        <ScanResultCard
          card={card}
          t={t}
          onOpen={openDetails}
          onAdd={addProduct}
          onRetry={retry}
          onClose={dismiss}
        />
      ) : null}
      <View style={styles.entryRow}>
        <Button
          title={t('scanner.enterBarcode')}
          icon="keypad-outline"
          variant="secondary"
          onPress={() => setManualEntry(true)}
          style={styles.entryButton}
          testID="manual-entry-button"
        />
        <View style={styles.roundButton}>
          <IconButton
            icon="egg-outline"
            label={t('scanner.checkEggCode')}
            onPress={() => router.push('/egg-code')}
            testID="egg-code-button"
          />
        </View>
      </View>
    </View>
  );

  const manualSheet = (
    <ManualEntrySheet
      visible={manualEntry}
      t={t}
      onSubmit={submitManual}
      onClose={() => setManualEntry(false)}
    />
  );

  if (!permission || !permission.granted) {
    const denied = permission && !permission.canAskAgain;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.flex}>
          <EmptyState
            icon="camera-outline"
            title={t('scanner.permissionTitle')}
            message={denied ? t('scanner.permissionDeniedBody') : t('scanner.permissionBody')}
            action={
              permission ? (
                <Button
                  title={denied ? t('scanner.openSettings') : t('scanner.allow')}
                  icon={denied ? 'settings-outline' : 'camera'}
                  onPress={() => void (denied ? Linking.openSettings() : requestPermission())}
                />
              ) : null
            }
          />
        </View>
        {bottomArea}
        {manualSheet}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={active && !manualEntry ? (result) => onBarcode(result.data) : undefined}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        {offline ? (
          <View style={styles.offlineBadge} accessibilityLiveRegion="polite">
            <Ionicons name="cloud-offline-outline" size={16} color={colors.bg} />
            <Text style={styles.offlineText}>{t('scanner.offline')}</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.roundButton}>
          <IconButton
            icon={torch ? 'flashlight' : 'flashlight-outline'}
            color={torch ? colors.favorite : colors.text}
            label={torch ? t('scanner.torchOff') : t('scanner.torchOn')}
            selected={torch}
            onPress={() => setTorch((value) => !value)}
          />
        </View>
      </View>

      <View style={styles.frameArea} pointerEvents="none">
        <View style={styles.frame} />
        {!card && <Text style={styles.hint}>{t('scanner.hint')}</Text>}
      </View>

      {bottomArea}
      {manualSheet}
    </View>
  );
}

const FRAME_WIDTH = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  roundButton: { backgroundColor: colors.scrim, borderRadius: radius.pill },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  offlineText: { ...typography.label, color: colors.bg },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_WIDTH * 0.6,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: radius.lg,
  },
  hint: {
    ...typography.bodyStrong,
    color: colors.text,
    backgroundColor: colors.scrim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  bottom: { paddingHorizontal: spacing.lg, gap: spacing.md },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  entryButton: { flex: 1 },
});
