import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { ProductResolutionService } from '../infrastructure/resolution/ProductResolutionService';
import { useTranslation } from '../i18n/useTranslation';

export default function ScannerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanned, setScanned] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const frameAnimation = useRef(new Animated.Value(0)).current;
  const flashAnimation = useRef(new Animated.Value(0)).current;
  const resolutionService = useRef(new ProductResolutionService()).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(frameAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(frameAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [frameAnimation]);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      requestAnimationFrame(() => {
        cameraRef.current?.resumePreview();
      });
      return () => {
        cameraRef.current?.pausePreview();
        flashAnimation.setValue(0);
        setTorchEnabled(false);
      };
    }, [flashAnimation])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        cameraRef.current?.resumePreview();
        flashAnimation.setValue(0);
      } else {
        cameraRef.current?.pausePreview();
      }
    });
    return () => subscription.remove();
  }, [flashAnimation]);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      setIsOffline(!state.isConnected);
    });
  }, []);

  const triggerScanFlash = () => {
    Animated.sequence([
      Animated.timing(flashAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleBarCodeScanned = async (result: { data: string }) => {
    if (scanned) return;

    const ean = result.data.trim();
    const isValidEAN = /^\d{8}$|^\d{13}$/.test(ean);

    if (!isValidEAN) {
      return;
    }

    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerScanFlash();

    try {
      const cachedProduct = await resolutionService.checkCache(ean);
      if (cachedProduct) {
        router.push({
          pathname: '/result',
          params: {
            ean,
            fromCache: 'true',
            cachedData: cachedProduct.raw_json || '',
          },
        });
        return;
      }
    } catch (err) {
      console.error('Error checking local cache:', err);
    }

    router.push({
      pathname: '/result',
      params: { ean },
    });
  };

  const toggleFacing = () => {
    setFacing((prev) => {
      if (prev === 'front') {
        setTorchEnabled(false);
        return 'back';
      }
      return 'front';
    });
  };

  const toggleTorch = () => {
    setTorchEnabled((prev) => !prev);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>{t('scanner.loading')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('scanner.permission')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t('scanner.allow')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const frameScale = frameAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.1],
  });

  const frameOpacity = frameAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });

  const flashOpacity = flashAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        facing={facing}
        enableTorch={torchEnabled}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['ean8', 'ean13'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      <Animated.View style={[styles.scanFlash, { opacity: flashOpacity }]} pointerEvents="none" />

      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.scanFrame,
            {
              transform: [{ scale: frameScale }],
              opacity: frameOpacity,
            },
          ]}
        >
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </Animated.View>

        <Text style={styles.hintText}>{t('scanner.hint')}</Text>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {facing === 'back' && (
            <TouchableOpacity style={styles.controlBtn} onPress={toggleTorch}>
              <Ionicons
                name={torchEnabled ? 'flashlight' : 'flashlight-outline'}
                size={28}
                color={torchEnabled ? '#FFD700' : '#FFFFFF'}
              />
            </TouchableOpacity>
          )}
        </View>

        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>{t('scanner.offline')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 20,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#4CAF50',
    top: -3,
    left: -3,
  },
  cornerTR: {
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    top: -3,
    right: -3,
    left: undefined,
  },
  cornerBL: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    bottom: -3,
    left: -3,
    top: undefined,
  },
  cornerBR: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    bottom: -3,
    right: -3,
    top: undefined,
    left: undefined,
  },
  hintText: {
    position: 'absolute',
    bottom: 60,
    color: '#BDBDBD',
    fontSize: 14,
    fontWeight: '500',
  },
  permissionButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionText: {
    color: '#BDBDBD',
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  scanFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4CAF50',
    zIndex: 10,
  },
  offlineBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  controls: {
    position: 'absolute',
    bottom: 110,
    flexDirection: 'row',
    gap: 24,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
