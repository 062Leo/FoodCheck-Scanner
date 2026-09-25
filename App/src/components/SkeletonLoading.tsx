import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors, radius, spacing } from '../ui/theme';

/** Placeholder shaped like the product screen while data loads. One shared pulse. */
export function SkeletonLoadingScreen() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled || reduceMotion) return;
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 0.8, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          ])
        );
        animation.start();
      });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [pulse]);

  const block = (width: DimensionValue, height: number, extra?: object) => (
    <Animated.View style={[styles.block, { width, height, opacity: pulse }, extra]} />
  );

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="…">
      <View style={styles.row}>
        {block(72, 72)}
        <View style={styles.column}>
          {block('80%', 22)}
          {block('50%', 16)}
        </View>
      </View>
      {block('100%', 110, { borderRadius: radius.lg })}
      {block('60%', 18)}
      {block('100%', 52)}
      {block('100%', 52)}
      {block('100%', 52)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  block: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
});
