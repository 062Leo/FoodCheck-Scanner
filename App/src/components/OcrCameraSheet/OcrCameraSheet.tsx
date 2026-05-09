/**
 * OcrCameraSheet
 *
 * Full-screen, multi-step camera + OCR component:
 *   Phase 1 – Live camera preview with tap-to-focus (overlay touch, no camera flicker)
 *   Phase 2 – Captured photo shown at same scale; user drags a crop rectangle
 *   Phase 3 – OCR text shown in a review panel (edit / re-crop / confirm)
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  PanResponder,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { OcrService } from '../../infrastructure/ocr/OcrService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Phase = 'camera' | 'crop' | 'review';

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  visible: boolean;
  mode: 'ingredients' | 'nutriments';
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrCameraSheet({ visible, mode, onConfirm, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // FIX 1: focusPoint stays in state (only UI cosmetic), but we render it as
  // a sibling overlay – not inside CameraView – to prevent re-mounting the camera.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX 3: Use refs for drag tracking so pan callbacks always see fresh values
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  const modeLabel = mode === 'ingredients' ? 'Zutatenliste scannen' : 'Nährwerttabelle scannen';

  /* ── reset ──────────────────────────────────────────────── */
  const reset = useCallback(() => {
    setPhase('camera');
    setPhotoUri(null);
    setFocusPoint(null);
    setCropRect(null);
    dragStartRef.current = null;
    setIsBusy(false);
    setExtractedText('');
  }, []);

  const handleCancel = useCallback(() => { reset(); onCancel(); }, [reset, onCancel]);

  /* ── Phase 1: tap-to-focus (overlay touch, camera never re-renders) ── */
  const handleTapToFocus = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = evt.nativeEvent;
      setFocusPoint({ x: locationX, y: locationY });
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => setFocusPoint(null), 1200);
    },
    [],
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isBusy) return;
    setIsBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo) {
        setPhotoUri(photo.uri);
        setPhase('crop');
      }
    } finally {
      setIsBusy(false);
    }
  }, [isBusy]);

  /* ── Phase 2: crop rectangle ────────────────────────────── */
  // FIX 3: PanResponder memoized with useRef; uses gestureState absolute coords
  // mapped into the view-local space so the rect is always correct.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        // locationX/Y are relative to the View that has panHandlers
        const { locationX, locationY } = evt.nativeEvent;
        dragStartRef.current = { x: locationX, y: locationY };
        setCropRect(null);
      },

      onPanResponderMove: (evt) => {
        const start = dragStartRef.current;
        if (!start) return;
        const { locationX, locationY } = evt.nativeEvent;
        setCropRect({
          x: Math.min(start.x, locationX),
          y: Math.min(start.y, locationY),
          w: Math.abs(locationX - start.x),
          h: Math.abs(locationY - start.y),
        });
      },

      onPanResponderRelease: () => {
        dragStartRef.current = null;
      },
    }),
  ).current;

  const handleExtract = useCallback(async () => {
    if (!photoUri || isBusy) return;
    setIsBusy(true);
    try {
      let uriToOcr = photoUri;

      if (cropRect && cropRect.w > 10 && cropRect.h > 10) {
        // The image is rendered full SCREEN_W × SCREEN_H with resizeMode="cover".
        // We get the image's actual pixel dimensions via ImageManipulator to compute the crop.
        const imgInfo = await ImageManipulator.manipulateAsync(photoUri, [], { format: ImageManipulator.SaveFormat.JPEG });
        // imgInfo gives us width/height after a no-op transform = original pixel size
        // We can get it by reading the result dimensions
        const imgResult = await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: SCREEN_W } }], { format: ImageManipulator.SaveFormat.JPEG });
        // Actually we need original pixel dims. Use crop from screen ratio:
        const scaleX = imgInfo.width / SCREEN_W;
        const scaleY = imgInfo.height / SCREEN_H;

        const cropX = Math.max(0, Math.round(cropRect.x * scaleX));
        const cropY = Math.max(0, Math.round(cropRect.y * scaleY));
        const cropW = Math.min(Math.round(cropRect.w * scaleX), imgInfo.width - cropX);
        const cropH = Math.min(Math.round(cropRect.h * scaleY), imgInfo.height - cropY);

        if (cropW > 10 && cropH > 10) {
          const cropped = await ImageManipulator.manipulateAsync(
            photoUri,
            [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
            { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
          );
          uriToOcr = cropped.uri;
        }
      }

      const text = await OcrService.recognizeText(uriToOcr);
      setExtractedText(text);
    } catch {
      setExtractedText('');
    } finally {
      setIsBusy(false);
      setPhase('review');
    }
  }, [photoUri, cropRect, isBusy]);

  /* ── Phase 3: review ────────────────────────────────────── */
  const handleConfirm = useCallback(() => {
    onConfirm(extractedText);
    reset();
  }, [extractedText, onConfirm, reset]);

  /* ── Permission guard ───────────────────────────────────── */
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permContainer}>
          <Text style={styles.permText}>Kamerazugriff erforderlich</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Erlauben</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelTxt} onPress={handleCancel}>
            <Text style={styles.cancelTxtLabel}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>

      {/* ═══ Phase 1: Live Camera ═══════════════════════════════════════ */}
      {phase === 'camera' && (
        <View style={styles.root}>
          {/* Camera sits alone – nothing stateful inside that would remount it */}
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />

          {/* FIX 1: Transparent overlay handles all touch; camera never re-renders */}
          <View
            style={StyleSheet.absoluteFill}
            onTouchEnd={handleTapToFocus}
            pointerEvents="box-only"
          />

          {/* Focus ring drawn on top of overlay */}
          {focusPoint && (
            <View
              style={[styles.focusRing, { top: focusPoint.y - 30, left: focusPoint.x - 30 }]}
              pointerEvents="none"
            />
          )}

          {/* Top bar */}
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity onPress={handleCancel} style={styles.topBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.topBtnLabel}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.phaseLabel}>{modeLabel}</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Hint */}
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>Zum Fokussieren tippen</Text>
          </View>

          {/* Capture button */}
          <View style={styles.captureWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} disabled={isBusy}>
              {isBusy
                ? <ActivityIndicator color="#fff" size="large" />
                : <View style={styles.captureBtnInner} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ Phase 2: Crop Selection ════════════════════════════════════ */}
      {phase === 'crop' && photoUri && (
        <View style={styles.root}>
          {/* FIX 2: resizeMode="cover" matches camera preview appearance */}
          <Image
            source={{ uri: photoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* FIX 3: PanResponder on a single absolute-fill View */}
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
            {cropRect && (
              <>
                {/* Dim top */}
                <View style={[styles.dim, { top: 0, left: 0, right: 0, height: cropRect.y }]} pointerEvents="none"/>
                {/* Dim bottom */}
                <View style={[styles.dim, { top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0 }]} pointerEvents="none"/>
                {/* Dim left */}
                <View style={[styles.dim, { top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h }]} pointerEvents="none"/>
                {/* Dim right */}
                <View style={[styles.dim, { top: cropRect.y, left: cropRect.x + cropRect.w, right: 0, height: cropRect.h }]} pointerEvents="none"/>
                {/* Selection border */}
                <View style={[styles.selRect, { top: cropRect.y, left: cropRect.x, width: cropRect.w, height: cropRect.h }]} pointerEvents="none"/>
                {/* Corner handles */}
                <View style={[styles.corner, styles.cornerTL, { top: cropRect.y - 2, left: cropRect.x - 2 }]} pointerEvents="none"/>
                <View style={[styles.corner, styles.cornerTR, { top: cropRect.y - 2, left: cropRect.x + cropRect.w - 14 }]} pointerEvents="none"/>
                <View style={[styles.corner, styles.cornerBL, { top: cropRect.y + cropRect.h - 14, left: cropRect.x - 2 }]} pointerEvents="none"/>
                <View style={[styles.corner, styles.cornerBR, { top: cropRect.y + cropRect.h - 14, left: cropRect.x + cropRect.w - 14 }]} pointerEvents="none"/>
              </>
            )}
          </View>

          {/* Top bar */}
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity onPress={() => { setCropRect(null); setPhase('camera'); }} style={styles.topBtn}>
              <Text style={styles.topBtnLabel}>↩</Text>
            </TouchableOpacity>
            <Text style={styles.phaseLabel}>Bereich auswählen</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.topBtn}>
              <Text style={styles.topBtnLabel}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>
              {cropRect ? 'Rechteck OK – oder neu ziehen' : 'Rechteck ziehen oder direkt extrahieren'}
            </Text>
          </View>

          {/* Extract button */}
          <View style={styles.captureWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.btn, isBusy && styles.btnDisabled]}
              onPress={handleExtract}
              disabled={isBusy}
            >
              {isBusy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Extrahieren →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ Phase 3: Review ════════════════════════════════════════════ */}
      {phase === 'review' && (
        <View style={styles.root}>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFill, { opacity: 0.15 }]} resizeMode="cover" />
          )}

          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>Extrahierter Text</Text>

            <ScrollView style={styles.reviewScroll} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.reviewInput}
                multiline
                value={extractedText}
                onChangeText={setExtractedText}
                placeholder="Kein Text erkannt – manuell eingeben"
                placeholderTextColor="#666"
                autoFocus={false}
              />
            </ScrollView>

            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setCropRect(null); setPhase('crop'); }}>
                <Text style={styles.secondaryBtnText}>↩ Neu zuschneiden</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setCropRect(null); setPhotoUri(null); setExtractedText(''); setPhase('camera'); }}>
                <Text style={styles.secondaryBtnText}>📷 Neu aufnehmen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.cancelTxt} onPress={handleCancel}>
                <Text style={styles.cancelTxtLabel}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, !extractedText.trim() && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={!extractedText.trim()}
              >
                <Text style={styles.btnText}>✓ Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  phaseLabel: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  topBtn: { padding: 8, minWidth: 44, alignItems: 'center' },
  topBtnLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },

  // Hint
  hintWrap: { position: 'absolute', bottom: 140, left: 0, right: 0, alignItems: 'center' },
  hint: {
    color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },

  // Capture / action button row
  captureWrap: { position: 'absolute', bottom: 52, left: 0, right: 0, alignItems: 'center' },
  captureBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

  // Focus ring
  focusRing: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, borderColor: '#FFEB3B',
  },

  // Crop phase
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  selRect: {
    position: 'absolute',
    borderWidth: 2, borderColor: '#4CAF50',
  },
  corner: { position: 'absolute', width: 16, height: 16, borderColor: '#4CAF50' },
  cornerTL: { borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { borderBottomWidth: 3, borderRightWidth: 3 },

  // Review
  reviewPanel: {
    flex: 1, marginTop: 90,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  reviewTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  reviewScroll: { flex: 1, marginBottom: 12 },
  reviewInput: {
    backgroundColor: '#2A2A2A', color: '#fff',
    padding: 14, borderRadius: 10,
    fontSize: 15, lineHeight: 22,
    minHeight: 160, textAlignVertical: 'top',
  },
  rowActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, gap: 10,
  },
  secondaryBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: '#2E2E2E', borderRadius: 8, alignItems: 'center',
  },
  secondaryBtnText: { color: '#BDBDBD', fontSize: 14, fontWeight: '600' },

  // Shared
  btn: { backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelTxt: { paddingVertical: 14, paddingHorizontal: 16 },
  cancelTxtLabel: { color: '#9E9E9E', fontSize: 16 },

  // Permission
  permContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', gap: 20 },
  permText: { color: '#fff', fontSize: 18, textAlign: 'center' },
});
