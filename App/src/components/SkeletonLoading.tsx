import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  marginBottom?: number;
}

export function SkeletonLine({
  width = '100%',
  height = 16,
  borderRadius = 4,
  marginBottom = 8,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          marginBottom,
          opacity,
        },
      ]}
    />
  );
}

export function SkeletonLoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonLine width={60} height={24} />
        <SkeletonLine width={40} height={28} />
      </View>

      <SkeletonLine width="90%" height={80} marginBottom={16} />

      <View style={styles.content}>
        <SkeletonLine width="80%" height={20} marginBottom={12} />
        <SkeletonLine width="100%" height={16} marginBottom={8} />
        <SkeletonLine width="90%" height={16} marginBottom={20} />

        <SkeletonLine width="70%" height={18} marginBottom={12} />
        <SkeletonLine width={60} height={60} marginBottom={20} />

        <SkeletonLine width="75%" height={18} marginBottom={12} />
        <SkeletonLine width="100%" height={16} marginBottom={8} />
        <SkeletonLine width="100%" height={16} marginBottom={8} />
        <SkeletonLine width="95%" height={16} marginBottom={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 0,
  },
  skeleton: {
    backgroundColor: '#2E2E2E',
  },
});
