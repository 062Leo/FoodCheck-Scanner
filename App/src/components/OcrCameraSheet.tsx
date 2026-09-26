/**
 * Photo → text for ingredient lists and nutrition tables.
 *
 * 1. Camera: take a photo (torch available).
 * 2. Crop: optionally drag a rectangle around the text.
 * 3. Recognition on the device (ML Kit) – nothing leaves the phone.
 * 4. Review: edit the text, retake, or – only after explicit consent – let
 *    Open Food Facts recognise it (uploads the photo publicly under the user's account).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n/useTranslation';
import { OcrService } from '../infrastructure/ocr/OcrService';
import { OcrPreprocessor } from '../infrastructure/ocr/OcrPreprocessor';
import { OffOcrClient, OffOcrError } from '../infrastructure/api/OffOcrClient';
import { WRITE_HOST } from '../infrastructure/api/config';
import {
  mapSelectionToImage,
  normalizeIngredientsOcrText,
  type Rect,
  type Size,
} from '../domain/ocr/ocrGeometry';
import type { TranslationKey } from '../i18n/translations';
import { Button, IconButton } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

interface Props {
  visible: boolean;
  mode: 'ingredients' | 'nutriments';
  barcode: string;
  /** Language of the ingredient list being scanned. */
  lang?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

type Phase = 'camera' | 'crop' | 'recognizing' | 'review';
type Engine = 'device' | 'cloud';

interface Photo {
  uri: string;
  width: number;
  height: number;
}

const cloudClient = new OffOcrClient();

export function OcrCameraSheet({ visible, mode, barcode, lang, onConfirm, onCancel }: Props) {
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const requestRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('camera');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [viewSize, setViewSize] = useState<Size | null>(null);
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [text, setText] = useState('');
  const [engine, setEngine] = useState<Engine>('device');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    requestRef.current++;
    setPhase('camera');
    setPhoto(null);
    setSelection(null);
    setTorch(false);
    setCapturing(false);
    setText('');
    setEngine('device');
    setErrorKey(null);
  }, []);

  // Every opening starts fresh; a lookup still running from before is ignored.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const close = () => {
    reset();
    onCancel();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragStart.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        setSelection(null);
      },
      onPanResponderMove: (event) => {
        const start = dragStart.current;
        if (!start) return;
        const { locationX, locationY } = event.nativeEvent;
        setSelection({
          x: Math.min(start.x, locationX),
          y: Math.min(start.y, locationY),
          width: Math.abs(locationX - start.x),
          height: Math.abs(locationY - start.y),
        });
      },
      onPanResponderRelease: () => {
        dragStart.current = null;
      },
    })
  ).current;

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (picture) {
        setPhoto({ uri: picture.uri, width: picture.width, height: picture.height });
        setSelection(null);
        setPhase('crop');
      }
    } catch {
      setErrorKey('ocr.error.capture');
    } finally {
      setCapturing(false);
    }
  };

  /** The photo, cropped to the selection if one was drawn. */
  const croppedUri = async (current: Photo, useSelection: boolean): Promise<string> => {
    const region =
      useSelection && selection && viewSize
        ? mapSelectionToImage(selection, viewSize, current)
        : null;
    if (!region) return current.uri;
    const cropped = await ImageManipulator.manipulateAsync(current.uri, [{ crop: region }], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return cropped.uri;
  };

  const finishRecognition = (request: number, raw: string, usedEngine: Engine) => {
    if (request !== requestRef.current) return;
    const cleaned = mode === 'ingredients' ? normalizeIngredientsOcrText(raw) : raw.trim();
    setText(cleaned);
    setEngine(usedEngine);
    setErrorKey(cleaned ? null : 'ocr.error.noText');
    setPhase('review');
  };

  const recognizeOnDevice = async (useSelection: boolean) => {
    if (!photo) return;
    const request = ++requestRef.current;
    setPhase('recognizing');
    try {
      const uri = await croppedUri(photo, useSelection);
      const recognized = await OcrService.recognizeText(uri);
      finishRecognition(request, recognized, 'device');
    } catch {
      if (request !== requestRef.current) return;
      setEngine('device');
      setErrorKey('ocr.error.device');
      setPhase('review');
    }
  };

  const recognizeInCloud = async () => {
    if (!photo) return;
    const request = ++requestRef.current;
    setPhase('recognizing');
    try {
      const uri = (await OcrPreprocessor.preprocess(await croppedUri(photo, true))).uri;
      const recognized = await cloudClient.extractText(
        barcode,
        uri,
        mode === 'ingredients' ? 'ingredients' : 'nutrition',
        lang ?? language
      );
      finishRecognition(request, recognized, 'cloud');
    } catch (error) {
      if (request !== requestRef.current) return;
      setEngine('cloud');
      setErrorKey(
        error instanceof OffOcrError && error.code === 'no-credentials'
          ? 'ocr.error.noCredentials'
          : 'ocr.error.cloud'
      );
      setPhase('review');
    }
  };

  const askCloudConsent = () => {
    Alert.alert(t('ocr.cloud.consentTitle'), t('ocr.cloud.consentBody', { host: WRITE_HOST }), [
      { text: t('edit.cancel'), style: 'cancel' },
      { text: t('ocr.cloud.consentAccept'), onPress: () => void recognizeInCloud() },
    ]);
  };

  const title = mode === 'ingredients' ? t('ocr.mode.ingredients') : t('ocr.mode.nutrition');

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={close}>
        <View style={[styles.permission, { paddingTop: insets.top }]}>
          <Text style={styles.permissionText}>{t('scanner.permissionBody')}</Text>
          <Button
            title={t('scanner.allow')}
            icon="camera"
            onPress={() => void requestPermission()}
          />
          <Button title={t('ocr.cancel')} variant="ghost" onPress={close} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        {phase === 'camera' && (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              autofocus="on"
            />
            <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
              <View style={styles.round}>
                <IconButton icon="close" label={t('ocr.cancel')} onPress={close} />
              </View>
              <Text style={styles.topTitle} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.round}>
                <IconButton
                  icon={torch ? 'flashlight' : 'flashlight-outline'}
                  color={torch ? colors.favorite : colors.text}
                  label={torch ? t('scanner.torchOff') : t('scanner.torchOn')}
                  selected={torch}
                  onPress={() => setTorch((value) => !value)}
                />
              </View>
            </View>
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.xl }]}>
              <Text style={styles.hint}>{t('ocr.hint.capture')}</Text>
              {errorKey === 'ocr.error.capture' && (
                <Text style={styles.errorOnDark}>{t('ocr.error.capture')}</Text>
              )}
              <Pressable
                onPress={() => void capture()}
                disabled={capturing}
                accessibilityRole="button"
                accessibilityLabel={t('ocr.capture')}
                style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
                testID="ocr-capture"
              >
                {capturing ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>
            </View>
          </>
        )}

        {phase === 'crop' && photo && (
          <>
            <View
              style={styles.flex}
              onLayout={(event) =>
                setViewSize({
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                })
              }
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: photo.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
              {selection && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.selection,
                    {
                      left: selection.x,
                      top: selection.y,
                      width: selection.width,
                      height: selection.height,
                    },
                  ]}
                />
              )}
            </View>
            <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
              <View style={styles.round}>
                <IconButton
                  icon="arrow-back"
                  label={t('ocr.review.retake')}
                  onPress={() => setPhase('camera')}
                />
              </View>
              <Text style={styles.topTitle}>{t('ocr.crop.select')}</Text>
              <View style={styles.round}>
                <IconButton icon="close" label={t('ocr.cancel')} onPress={close} />
              </View>
            </View>
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Text style={styles.hint}>
                {selection ? t('ocr.crop.hint.ok') : t('ocr.crop.hint.empty')}
              </Text>
              <View style={styles.row}>
                <Button
                  title={t('ocr.useWhole')}
                  variant="secondary"
                  onPress={() => void recognizeOnDevice(false)}
                  style={styles.flex}
                />
                <Button
                  title={t('ocr.useSelection')}
                  icon="scan-outline"
                  onPress={() => void recognizeOnDevice(true)}
                  disabled={!selection}
                  style={styles.flex}
                />
              </View>
            </View>
          </>
        )}

        {phase === 'recognizing' && (
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.body}>{t('ocr.recognizing')}</Text>
            <Button
              title={t('ocr.cancel')}
              variant="ghost"
              onPress={() => {
                requestRef.current++;
                setPhase('crop');
              }}
            />
          </View>
        )}

        {phase === 'review' && (
          <KeyboardAvoidingView
            style={[styles.review, { paddingTop: insets.top + spacing.md }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle} accessibilityRole="header">
                {t('ocr.review.title')}
              </Text>
              <IconButton icon="close" label={t('ocr.cancel')} onPress={close} />
            </View>
            <Text style={styles.caption}>
              {engine === 'device' ? t('ocr.review.engineDevice') : t('ocr.review.engineCloud')}
            </Text>
            <ScrollView
              contentContainerStyle={styles.reviewContent}
              keyboardShouldPersistTaps="handled"
            >
              {errorKey ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {t(errorKey)}
                </Text>
              ) : null}
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                placeholder={t('ocr.review.placeholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.reviewInput}
                accessibilityLabel={t('ocr.review.title')}
                testID="ocr-text"
              />
              {engine === 'device' && (
                <Button
                  title={t('ocr.cloud.button')}
                  icon="cloud-upload-outline"
                  variant="ghost"
                  onPress={askCloudConsent}
                />
              )}
            </ScrollView>
            <View style={[styles.row, { paddingBottom: insets.bottom + spacing.md }]}>
              <Button
                title={t('ocr.review.retake')}
                icon="camera-outline"
                variant="secondary"
                onPress={() => setPhase('camera')}
                style={styles.flex}
              />
              <Button
                title={t('ocr.review.confirm')}
                icon="checkmark"
                onPress={() => {
                  const confirmed = text.trim();
                  reset();
                  onConfirm(confirmed);
                }}
                disabled={!text.trim()}
                style={styles.flex}
                testID="ocr-confirm"
              />
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  permission: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionText: { ...typography.body, color: colors.text, textAlign: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  round: { backgroundColor: colors.scrim, borderRadius: radius.pill },
  topTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    backgroundColor: colors.scrim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexShrink: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.scrim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
  },
  errorOnDark: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.dangerSubtle,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.accent,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.text },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.selectionFill,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  body: { ...typography.body, color: colors.text },
  review: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewTitle: { ...typography.title, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  reviewContent: { gap: spacing.md, paddingBottom: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  reviewInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    minHeight: 200,
  },
});
