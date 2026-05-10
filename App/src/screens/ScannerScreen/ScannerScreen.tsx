import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const frameAnimation = useRef(new Animated.Value(0)).current;
  const productRepository = new ProductRepository();

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

  const activateCamera = useCallback(() => {
    setScanned(false);
    setCameraKey((k) => k + 1);
  }, []);

  useFocusEffect(activateCamera);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setCameraKey((k) => k + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async (result: { data: string }) => {
    if (scanned) return;

    const ean = result.data.trim();
    const isValidEAN = /^\d{8}$|^\d{13}$/.test(ean);

    if (!isValidEAN) {
      return;
    }

    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Cache-first approach: check local DB before API call
    try {
      const cachedProduct = await productRepository.findByEan(ean);
      if (cachedProduct) {
        // Product found in cache → navigate directly with cached data
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
      // Fall through to normal flow if cache check fails
    }

    // Product not in cache → proceed with normal flow (API or offline)
    router.push({
      pathname: '/result',
      params: { ean },
    });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Laden...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Kamerazugriff erforderlich</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Erlauben</Text>
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

  return (
    <View style={styles.container}>
      <CameraView
        key={cameraKey}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['ean8', 'ean13'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

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

        <Text style={styles.hintText}>Halte den Barcode rein</Text>
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
});
