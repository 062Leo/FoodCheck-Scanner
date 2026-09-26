import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, radius, spacing, typography } from '../ui/theme';

interface GalleryImage {
  uri: string;
  label: string;
}

function GalleryImageItem({ item, width }: { item: GalleryImage; width: number }) {
  const [loading, setLoading] = useState(true);
  return (
    <View style={[styles.item, { width }]}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode="contain"
        onLoadEnd={() => setLoading(false)}
        accessibilityLabel={item.label}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.label}>{item.label}</Text>
    </View>
  );
}

/** Swipeable product photos with page dots. */
export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth - spacing.lg * 2;
  const [activeIndex, setActiveIndex] = useState(0);

  // Hooks run before any early return (rules of hooks).
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setActiveIndex(first);
    },
    []
  );

  if (images.length === 0) return null;

  return (
    <View>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => <GalleryImageItem item={item} width={imageWidth} />}
      />
      {images.length > 1 && (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {images.map((image, index) => (
            <View key={image.uri} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { height: 260, alignItems: 'center', justifyContent: 'center' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    bottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: 220, borderRadius: radius.sm, backgroundColor: colors.surface },
  label: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { backgroundColor: colors.accent, width: 8, height: 8, borderRadius: 4 },
});
