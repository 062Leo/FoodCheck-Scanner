import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ProductRecord } from '../../types/Product';
import type { ScanStatus } from '../../types/ScanResult';

const STATUS_COLORS: Record<ScanStatus, string> = {
  OK: '#4CAF50',
  Warning: '#FFC107',
  Critical: '#F44336',
};

interface ProductCardProps {
  product: ProductRecord;
  onPress: () => void;
  onDelete: (ean: string) => Promise<void>;
  onToggleFavorite: (productId: number) => Promise<void>;
  isFavorite: boolean;
}

export function ProductCard({
  product,
  onPress,
  onDelete,
  onToggleFavorite,
  isFavorite,
}: ProductCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteArea, setShowDeleteArea] = useState(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx < -30) {
          setShowDeleteArea(true);
        } else if (gestureState.dx > -10) {
          setShowDeleteArea(false);
        }
      },
      onPanResponderRelease: () => {
        // Keep the delete area visible until user taps elsewhere
      },
    })
  ).current;

  const handleDelete = async () => {
    setIsDeleting(true);
    Alert.alert('Löschen', 'Produkt wirklich löschen?', [
      { text: 'Abbrechen', onPress: () => setIsDeleting(false) },
      {
        text: 'Löschen',
        onPress: async () => {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            await onDelete(product.ean);
            setShowDeleteArea(false);
          } catch (err) {
            console.error('Failed to delete product:', err);
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const handleToggleFavorite = async () => {
    if (!product.id) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onToggleFavorite(product.id);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const formattedDate = product.scanned_at
    ? new Date(product.scanned_at).toLocaleDateString('de-DE')
    : '';

  const statusColor = STATUS_COLORS[product.rating];
  const novaLabel = product.nova_score
    ? `Nova ${product.nova_score}`
    : 'N/A';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        {...panResponder.panHandlers}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.cardWrapper}
      >
        <View style={styles.card}>
          {/* Status dot */}
          <View
            style={[styles.statusDot, { backgroundColor: statusColor }]}
          />

          {/* Product info */}
          <View style={styles.content}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name || 'Unbekanntes Produkt'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta} numberOfLines={1}>
                {product.brands || 'Keine Marke'} · {formattedDate}
              </Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.nova}>{novaLabel}</Text>
            </View>
          </View>

          {/* Favorite star */}
          <TouchableOpacity
            onPress={handleToggleFavorite}
            disabled={isDeleting}
            style={styles.favoriteButton}
          >
            <Text style={styles.favoriteIcon}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Hidden delete area (swipe left) */}
      {showDeleteArea && (
        <View style={styles.deleteArea}>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={isDeleting}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteText}>
              {isDeleting ? '...' : 'Löschen'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tap outside to hide delete area */}
      {showDeleteArea && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setShowDeleteArea(false)}
          activeOpacity={0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  cardWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  metaRow: {
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
  scoreRow: {
    marginTop: 2,
  },
  nova: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: '500',
  },
  favoriteButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  favoriteIcon: {
    fontSize: 20,
    color: '#FFD700',
  },
  deleteArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#F44336',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});
