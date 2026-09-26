import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../ui/theme';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
} as const;

const ACCENTS = { success: colors.accent, error: colors.danger, info: colors.info };

export function Toast({ message, type, duration = 3500, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(slide, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        onDismissRef.current?.()
      );
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + spacing.sm, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        style={[styles.content, { borderLeftColor: ACCENTS[type] }]}
        onPress={() => onDismissRef.current?.()}
        accessibilityRole="alert"
      >
        <Ionicons name={ICONS[type]} size={22} color={ACCENTS[type]} />
        <Text style={styles.message}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 1000 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  message: { ...typography.body, color: colors.text, flex: 1 },
});
