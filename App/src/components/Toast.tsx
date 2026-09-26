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
  /** Optional action such as "Undo". */
  action?: { label: string; onPress: () => void };
}

const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
} as const;

const ACCENTS = { success: colors.accent, error: colors.danger, info: colors.info };

/** Screen reader users need time to move focus to an action such as "Undo". */
const SCREEN_READER_ACTION_DURATION = 10000;

/**
 * Callers render a new toast with a new `key`, so every toast gets its own timer even when
 * the text repeats.
 */
export function Toast({ message, type, duration = 3500, onDismiss, action }: ToastProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const hasAction = action !== undefined;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const show = Animated.timing(slide, { toValue: 1, duration: 250, useNativeDriver: true });
    show.start();
    let hide: Animated.CompositeAnimation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const startTimer = (ms: number) => {
      timer = setTimeout(() => {
        hide = Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true });
        // Only a finished slide-out dismisses; a stopped one belongs to a replaced toast.
        hide.start(({ finished }) => {
          if (finished) onDismissRef.current?.();
        });
      }, ms);
    };

    if (hasAction) {
      AccessibilityInfo.isScreenReaderEnabled()
        .catch(() => false)
        .then((enabled) => {
          if (active)
            startTimer(enabled ? Math.max(duration, SCREEN_READER_ACTION_DURATION) : duration);
        });
    } else {
      startTimer(duration);
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      show.stop();
      hide?.stop();
    };
  }, [message, duration, hasAction, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + spacing.sm, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        style={[styles.content, { borderLeftColor: ACCENTS[type] }]}
        onPress={() => onDismissRef.current?.()}
        // With an action, message and button stay separate so screen readers can reach the button.
        accessible={!action}
        accessibilityRole={action ? undefined : 'alert'}
      >
        <Ionicons name={ICONS[type]} size={22} color={ACCENTS[type]} />
        <Text style={styles.message} accessibilityRole={action ? 'alert' : undefined}>
          {message}
        </Text>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              onDismissRef.current?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={8}
            style={styles.action}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ) : null}
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
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { ...typography.bodyStrong, color: colors.accent },
});
