/**
 * OcrCameraSheet
 *
 * Full-screen, multi-step camera + OCR component:
 *   Phase 1 – Live camera preview with tap-to-focus (overlay touch, no camera flicker)
 *   Phase 2 – Captured photo shown at same scale; user drags a crop rectangle
 *   Phase 3 – OCR text shown in a review panel (edit / re-crop / confirm)
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { OcrService, OcrScriptSelection } from '../infrastructure/ocr/OcrService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type OcrLanguageOption = {
  id: string;
  label: string;
  selection: OcrScriptSelection;
};

const OCR_LANGUAGE_OPTIONS: OcrLanguageOption[] = [
  { id: 'auto', label: 'Auto (Latein)', selection: 'auto' },
  { id: 'latin', label: 'Latein', selection: TextRecognitionScript.LATIN },
  { id: 'japanese', label: 'Japanisch', selection: TextRecognitionScript.JAPANESE },
  { id: 'korean', label: 'Koreanisch', selection: TextRecognitionScript.KOREAN },
  { id: 'chinese', label: 'Chinesisch', selection: TextRecognitionScript.CHINESE },
  { id: 'devanagari', label: 'Devanagari', selection: TextRecognitionScript.DEVANAGARI },
];

const DEFAULT_LANGUAGE_ID = 'auto';
const DEFAULT_FAVORITE_LANGUAGE_IDS = ['auto', 'latin', 'japanese'];
const OCR_DEFAULT_LANGUAGE_KEY = 'ocr_default_language';
const OCR_FAVORITE_LANGUAGES_KEY = 'ocr_favorite_languages';

const validIds = new Set(OCR_LANGUAGE_OPTIONS.map((opt) => opt.id));

type Phase = 'camera' | 'crop' | 'review';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  visible: boolean;
  mode: 'ingredients' | 'nutriments';
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrCameraSheet({ visible, mode, onConfirm, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const wasVisibleRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('camera');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrQualityScore, setOcrQualityScore] = useState<number | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX 3: Use refs for drag tracking so pan callbacks always see fresh values
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [defaultLanguageId, setDefaultLanguageId] = useState(DEFAULT_LANGUAGE_ID);
  const [selectedLanguageId, setSelectedLanguageId] = useState(DEFAULT_LANGUAGE_ID);
  const [favoriteLanguageIds, setFavoriteLanguageIds] = useState<string[]>(
    DEFAULT_FAVORITE_LANGUAGE_IDS
  );

  const modeLabel = mode === 'ingredients' ? 'Zutatenliste scannen' : 'Nährwerttabelle scannen';
  const selectedLanguage = useMemo(
    () =>
      OCR_LANGUAGE_OPTIONS.find((option) => option.id === selectedLanguageId) ??
      OCR_LANGUAGE_OPTIONS[0],
    [selectedLanguageId]
  );
  const favoriteLanguages = useMemo(() => {
    const favoriteSet = new Set(favoriteLanguageIds);
    return OCR_LANGUAGE_OPTIONS.filter((option) => favoriteSet.has(option.id));
  }, [favoriteLanguageIds]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isActive = true;

    const loadPreferences = async () => {
      try {
        const storedDefault = await SecureStore.getItemAsync('ocr_default_language');
        const resolvedDefault =
          storedDefault && validIds.has(storedDefault) ? storedDefault : DEFAULT_LANGUAGE_ID;

        const storedFavorites = await SecureStore.getItemAsync('ocr_favorite_languages');
        let resolvedFavorites = DEFAULT_FAVORITE_LANGUAGE_IDS;
        if (storedFavorites) {
          const parsed = JSON.parse(storedFavorites) as unknown;
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (entry): entry is string => typeof entry === 'string' && validIds.has(entry)
            );
            if (filtered.length > 0) {
              resolvedFavorites = Array.from(new Set(filtered));
            }
          }
        }

        if (isActive) {
          setDefaultLanguageId(resolvedDefault);
          setSelectedLanguageId(resolvedDefault);
          setFavoriteLanguageIds(resolvedFavorites);
        }
      } catch (err) {
        console.error('Failed to load OCR preferences:', err);
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, [visible]);

  /* ── Remount camera when modal becomes visible ─────────────── */
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setCameraSessionKey((prev) => prev + 1);
      wasVisibleRef.current = true;
    }
    if (!visible) {
      wasVisibleRef.current = false;
    }
  }, [visible]);

  /* Ensure camera is paused and ref cleared when modal closes */
  useEffect(() => {
    if (!visible) {
      try {
        const cameraView = cameraRef.current as { pausePreview?: () => void } | null;
        if (cameraView && typeof cameraView.pausePreview === 'function') {
          cameraView.pausePreview();
        }
      } catch (err) {
        // Non-fatal: best-effort cleanup
        console.warn('Failed to pause OCR camera during cleanup', err);
      } finally {
        // clear ref so native camera resources can be reclaimed
        // (best-effort; component unmount should also free resources)
        if (cameraRef.current) {
          cameraRef.current = null;
        }
        // Bump session key to force a fresh camera when reopened
        setCameraSessionKey((prev) => prev + 1);
      }
    }
  }, [visible]);

  /* ── reset ──────────────────────────────────────────────── */
  const reset = useCallback(() => {
    setPhase('camera');
    setPhotoUri(null);
    setFocusPoint(null);
    setCropRect(null);
    setSettingsVisible(false);
    setSelectedLanguageId(defaultLanguageId);
    dragStartRef.current = null;
    setIsBusy(false);
    setExtractedText('');
    setOcrError(null);
  }, [defaultLanguageId]);

  const toggleFavoriteLanguage = useCallback(
    async (id: string) => {
      const nextFavorites = favoriteLanguageIds.includes(id)
        ? favoriteLanguageIds.filter((item) => item !== id)
        : [...favoriteLanguageIds, id];

      const deduped = Array.from(new Set(nextFavorites));
      setFavoriteLanguageIds(deduped);
      await SecureStore.setItemAsync(OCR_FAVORITE_LANGUAGES_KEY, JSON.stringify(deduped));
    },
    [favoriteLanguageIds]
  );

  const updateDefaultLanguage = useCallback(async (id: string) => {
    setDefaultLanguageId(id);
    setSelectedLanguageId(id);
    await SecureStore.setItemAsync(OCR_DEFAULT_LANGUAGE_KEY, id);
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onCancel();
  }, [reset, onCancel]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      reset();
    }

    if (!visible) {
      if (focusTimer.current) {
        clearTimeout(focusTimer.current);
        focusTimer.current = null;
      }
    }

    wasVisibleRef.current = visible;
  }, [visible, reset]);

  /* ── Phase 1: tap-to-focus (overlay touch, camera never re-renders) ── */
  const handleTapToFocus = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = evt.nativeEvent;
      setFocusPoint({ x: locationX, y: locationY });
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => setFocusPoint(null), 1200);
    },
    []
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
    })
  ).current;

  const handleExtract = useCallback(async () => {
    if (isBusy || !photoUri) return;
    setIsBusy(true);

    let uriToOcr = photoUri;
    try {
      const imgInfo = await ImageManipulator.manipulateAsync(photoUri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const imgW = imgInfo.width;
      const imgH = imgInfo.height;

      if (cropRect && imgW > 0 && imgH > 0) {
        const scaleX = imgW / (previewSize?.w || SCREEN_W);
        const scaleY = imgH / (previewSize?.h || SCREEN_H);

        let originX = clamp(Math.round(cropRect.x * scaleX), 0, imgW);
        let originY = clamp(Math.round(cropRect.y * scaleY), 0, imgH);
        const w = clamp(Math.round(cropRect.w * scaleX), 1, imgW - originX);
        const h = clamp(Math.round(cropRect.h * scaleY), 1, imgH - originY);

        if (originX + w > imgW) originX = Math.max(0, imgW - w);
        if (originY + h > imgH) originY = Math.max(0, imgH - h);

        // Use crop guidance for informational display
        if (w > 10 && h > 10) {
          const cropped = await ImageManipulator.manipulateAsync(
            photoUri,
            [{ crop: { originX, originY, width: w, height: h } }],
            { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
          );
          uriToOcr = cropped.uri;
        }
      }
    } catch (err) {
      console.error('Crop failed, using original photo:', err);
    }

    try {
      setOcrConfidence(null);
      setOcrQualityScore(null);
      const result = await OcrService.recognizeWithConfidence(uriToOcr, selectedLanguage.selection);
      setExtractedText(result.text);
      setOcrConfidence(result.confidence);
      setOcrQualityScore(result.qualityScore);
      setOcrError(null);
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : String(e);
      const msg = /NoSuchMethodError|expoimagemanipulator\.manipulate/i.test(rawMsg)
        ? 'Bildverarbeitung fehlgeschlagen: inkompatible Version von expo-image-manipulator. Bitte `npm install` ausfuehren und den Development Build neu installieren.'
        : rawMsg;
      setOcrError(msg);
      setExtractedText('');
      setOcrConfidence(null);
      setOcrQualityScore(null);
    } finally {
      setIsBusy(false);
      setPhase('review');
    }
  }, [photoUri, cropRect, previewSize, isBusy, selectedLanguage.selection]);

  /* ── Phase 3: review ────────────────────────────────────── */
  const handleConfirm = useCallback(() => {
    onConfirm(extractedText);
    reset();
  }, [extractedText, onConfirm, reset]);

  /* ── Permission guard ───────────────────────────────────── */
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
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
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {/* ═══ Phase 1: Live Camera ═══════════════════════════════════════ */}
      {phase === 'camera' && (
        <View style={styles.root}>
          {/* Camera sits alone – nothing stateful inside that would remount it */}
          <CameraView key={cameraSessionKey} ref={cameraRef} style={StyleSheet.absoluteFill} />

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
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.topBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.topBtnLabel}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.phaseLabel}>{modeLabel}</Text>
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.topBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.topBtnLabel}>Lang</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>Zum Fokussieren tippen</Text>
            <Text style={styles.langHint}>OCR: {selectedLanguage.label}</Text>
          </View>

          {/* Capture button */}
          <View style={styles.captureWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <View style={styles.captureBtnInner} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ Phase 2: Crop Selection ════════════════════════════════════ */}
      {phase === 'crop' && photoUri && (
        <View
          style={styles.root}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setPreviewSize({ w: width, h: height });
            }
          }}
        >
          {/* FIX 2: resizeMode="cover" matches camera preview appearance */}
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

          {/* FIX 3: PanResponder on a single absolute-fill View */}
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
            {cropRect && (
              <>
                {/* Dim top */}
                <View
                  style={[styles.dim, { top: 0, left: 0, right: 0, height: cropRect.y }]}
                  pointerEvents="none"
                />
                {/* Dim bottom */}
                <View
                  style={[
                    styles.dim,
                    { top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0 },
                  ]}
                  pointerEvents="none"
                />
                {/* Dim left */}
                <View
                  style={[
                    styles.dim,
                    { top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h },
                  ]}
                  pointerEvents="none"
                />
                {/* Dim right */}
                <View
                  style={[
                    styles.dim,
                    {
                      top: cropRect.y,
                      left: cropRect.x + cropRect.w,
                      right: 0,
                      height: cropRect.h,
                    },
                  ]}
                  pointerEvents="none"
                />
                {/* Selection border */}
                <View
                  style={[
                    styles.selRect,
                    { top: cropRect.y, left: cropRect.x, width: cropRect.w, height: cropRect.h },
                  ]}
                  pointerEvents="none"
                />
                {/* Grid overlay */}
                {cropRect.w > 60 && cropRect.h > 60 && (
                  <>
                    <View
                      style={[
                        styles.gridLineH,
                        {
                          top: cropRect.y + cropRect.h / 3,
                          left: cropRect.x,
                          width: cropRect.w,
                        },
                      ]}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.gridLineH,
                        {
                          top: cropRect.y + (2 * cropRect.h) / 3,
                          left: cropRect.x,
                          width: cropRect.w,
                        },
                      ]}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.gridLineV,
                        {
                          left: cropRect.x + cropRect.w / 3,
                          top: cropRect.y,
                          height: cropRect.h,
                        },
                      ]}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.gridLineV,
                        {
                          left: cropRect.x + (2 * cropRect.w) / 3,
                          top: cropRect.y,
                          height: cropRect.h,
                        },
                      ]}
                      pointerEvents="none"
                    />
                  </>
                )}
                {/* Corner handles */}
                <View
                  style={[
                    styles.corner,
                    styles.cornerTL,
                    { top: cropRect.y - 2, left: cropRect.x - 2 },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerTR,
                    { top: cropRect.y - 2, left: cropRect.x + cropRect.w - 14 },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBL,
                    { top: cropRect.y + cropRect.h - 14, left: cropRect.x - 2 },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBR,
                    { top: cropRect.y + cropRect.h - 14, left: cropRect.x + cropRect.w - 14 },
                  ]}
                  pointerEvents="none"
                />
              </>
            )}
          </View>

          {/* Top bar */}
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => {
                setCropRect(null);
                setPhase('camera');
              }}
              style={styles.topBtn}
            >
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
              {cropRect
                ? 'Rechteck OK – oder neu ziehen'
                : 'Rechteck ziehen oder direkt extrahieren'}
            </Text>
          </View>

          {/* Extract button */}
          <View style={styles.captureWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.btn, isBusy && styles.btnDisabled]}
              onPress={handleExtract}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Extrahieren →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ Phase 3: Review ════════════════════════════════════════════ */}
      {phase === 'review' && (
        <View style={styles.root}>
          <View style={styles.reviewBackdrop} />

          {photoUri && (
            <View style={styles.reviewPreviewWrap}>
              <Image source={{ uri: photoUri }} style={styles.reviewPreview} resizeMode="cover" />
            </View>
          )}

          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>Extrahierter Text</Text>
            <Text style={styles.reviewSubtitle}>
              OCR: {selectedLanguage.label}
              {ocrConfidence !== null && ` • Konfidenz: ${Math.round(ocrConfidence * 100)}%`}
              {ocrQualityScore !== null && ocrQualityScore < 60 && ` • Qualität: niedrig`}
            </Text>

            <ScrollView style={styles.reviewScroll} keyboardShouldPersistTaps="handled">
              {ocrError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>⚠ Texterkennung fehlgeschlagen</Text>
                  <Text style={styles.errorMsg}>{ocrError}</Text>
                  {ocrError.includes('linked') || ocrError.includes('native') ? (
                    <Text style={styles.errorHint}>
                      Hinweis: Die Texterkennung benötigt einen Development Build.{'\n'}
                      Starte die App mit:{'\n'}
                      <Text style={styles.errorCode}>expo run:android</Text>
                      {' oder '}
                      <Text style={styles.errorCode}>expo run:ios</Text>
                    </Text>
                  ) : null}
                  <Text style={styles.errorHint}>
                    Du kannst den Text auch manuell unten eingeben.
                  </Text>
                </View>
              )}
              {!ocrError && !extractedText.trim() && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>Kein Text erkannt</Text>
                  <Text style={styles.emptyStateText}>
                    Probiere einen engeren Zuschnitt, bessere Beleuchtung oder ein anderes
                    OCR-Script.
                  </Text>
                </View>
              )}
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
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setCropRect(null);
                  setPhase('crop');
                }}
              >
                <Text style={styles.secondaryBtnText}>↩ Neu zuschneiden</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setCropRect(null);
                  setPhotoUri(null);
                  setExtractedText('');
                  setPhase('camera');
                }}
              >
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

      {settingsVisible && (
        <View style={styles.settingsBackdrop} pointerEvents="box-none">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          />

          <View style={styles.settingsSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTitle}>OCR Sprache</Text>
                <Text style={styles.settingsSubTitle}>
                  ML Kit lädt die passenden Modelle bei Bedarf. Auto nutzt Latein als sicheren
                  Standard.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.closeChip}>
                <Text style={styles.closeChipText}>Schliessen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.selectedSummary}>
              <Text style={styles.selectedSummaryLabel}>Aktuell</Text>
              <Text style={styles.selectedSummaryValue}>{selectedLanguage.label}</Text>
              <Text style={styles.selectedSummaryHint}>
                Lange druecken = Favorit umschalten. Tippen = Script waehlen.
              </Text>
            </View>

            <Text style={styles.settingsSectionTitle}>Favoriten</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.favoriteScroll}
            >
              {favoriteLanguages.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.favoriteChip,
                    selectedLanguageId === option.id && styles.favoriteChipActive,
                  ]}
                  onPress={() => setSelectedLanguageId(option.id)}
                  onLongPress={() => {
                    void toggleFavoriteLanguage(option.id);
                  }}
                >
                  <Text style={styles.favoriteChipText}>{option.label}</Text>
                  <Text style={styles.favoriteChipSubText}>Tippen</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.settingsSectionTitle}>Alle Sprachen</Text>
            <View style={styles.languageGrid}>
              {OCR_LANGUAGE_OPTIONS.map((option) => {
                const isSelected = selectedLanguageId === option.id;
                const isFavorite = favoriteLanguageIds.includes(option.id);

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.languageChip, isSelected && styles.languageChipActive]}
                    onPress={() => setSelectedLanguageId(option.id)}
                    onLongPress={() => {
                      void toggleFavoriteLanguage(option.id);
                    }}
                  >
                    <Text style={styles.languageChipText}>{option.label}</Text>
                    <Text style={styles.languageChipMeta}>
                      {isFavorite ? '★ Favorit' : 'Lange druecken'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  void updateDefaultLanguage(selectedLanguageId);
                  setSettingsVisible(false);
                }}
              >
                <Text style={styles.secondaryBtnText}>Als Standard speichern</Text>
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
  root: { flex: 1, backgroundColor: '#0E1116' },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(9, 12, 18, 0.78)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  phaseLabel: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  topBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 54,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  topBtnLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Hint
  hintWrap: { position: 'absolute', bottom: 140, left: 0, right: 0, alignItems: 'center' },
  hint: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(15,18,26,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langHint: {
    marginTop: 8,
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(15,18,26,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },

  // Capture / action button row
  captureWrap: { position: 'absolute', bottom: 52, left: 0, right: 0, alignItems: 'center' },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

  // Focus ring
  focusRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFEB3B',
  },

  // Crop phase
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  selRect: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  corner: { position: 'absolute', width: 16, height: 16, borderColor: '#4CAF50' },
  cornerTL: { borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { borderBottomWidth: 3, borderRightWidth: 3 },
  gridLineH: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(76,175,80,0.3)',
  },
  gridLineV: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(76,175,80,0.3)',
  },

  // Review
  reviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E1116',
  },
  reviewPreviewWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 210,
    overflow: 'hidden',
  },
  reviewPreview: {
    width: '100%',
    height: '100%',
    opacity: 0.22,
  },
  reviewPanel: {
    flex: 1,
    marginTop: 170,
    backgroundColor: '#171C24',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  reviewTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  reviewSubtitle: { color: '#AAB2C0', fontSize: 13, marginBottom: 12 },
  reviewScroll: { flex: 1, marginBottom: 12 },
  reviewInput: {
    backgroundColor: '#232A36',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#232A36',
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#D3DAE4', fontSize: 14, fontWeight: '600' },

  // Shared
  btn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelTxt: { paddingVertical: 14, paddingHorizontal: 16 },
  cancelTxtLabel: { color: '#9E9E9E', fontSize: 16 },

  // Permission
  permContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  permText: { color: '#fff', fontSize: 18, textAlign: 'center' },

  // Error panel
  errorBox: {
    backgroundColor: '#2C1A1A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  errorTitle: { color: '#F44336', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  errorMsg: {
    color: '#FFCDD2',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  errorHint: { color: '#BDBDBD', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  errorCode: { color: '#80CBC4', fontWeight: 'bold' },

  // OCR language settings
  settingsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 12, 0.65)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#171C24',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    maxHeight: SCREEN_H * 0.82,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  closeChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#232A36',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeChipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  settingsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  settingsSubTitle: {
    color: '#B5BFCE',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  selectedSummary: {
    backgroundColor: '#232A36',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  selectedSummaryLabel: {
    color: '#9FB0C8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  selectedSummaryValue: { color: '#fff', fontSize: 17, fontWeight: '700' },
  selectedSummaryHint: { color: '#B5BFCE', fontSize: 12, marginTop: 4, lineHeight: 16 },
  settingsSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  favoriteScroll: {
    marginBottom: 10,
  },
  favoriteChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#232A36',
    marginRight: 8,
  },
  favoriteChipActive: {
    backgroundColor: '#4CAF50',
  },
  favoriteChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  favoriteChipSubText: {
    color: '#C7D1DF',
    fontSize: 11,
    marginTop: 2,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  languageChip: {
    width: '48%',
    backgroundColor: '#232A36',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  languageChipActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.16)',
  },
  languageChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  languageChipMeta: {
    color: '#B5BFCE',
    fontSize: 11,
    marginTop: 4,
  },
  sheetActions: {
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#232A36',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateText: {
    color: '#C8D0DB',
    fontSize: 13,
    lineHeight: 18,
  },
});
