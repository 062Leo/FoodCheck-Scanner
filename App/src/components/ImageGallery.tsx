import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

interface GalleryImage {
  uri: string;
  label: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
}

function GalleryImageItem({ item, width }: { item: GalleryImage; width: number }) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.imageWrapper, { width }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode="contain"
        onLoadEnd={() => setLoading(false)}
      />
      <Text style={styles.imageLabel}>{item.label}</Text>
    </View>
  );
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth - 32;
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => <GalleryImageItem item={item} width={imageWidth} />}
      />

      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, index) => (
            <View key={index} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  imageWrapper: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  imageLabel: {
    color: '#757575',
    fontSize: 11,
    marginTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
  dotActive: {
    backgroundColor: '#4CAF50',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
