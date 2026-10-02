import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, TOUCH_TARGET } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/** Icon-only button with a 48 dp touch target and a mandatory accessibility label. */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  size = 24,
  disabled,
  selected,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}) {
  const palette = BUTTON_COLORS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_COLORS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  danger: { bg: colors.dangerSubtle, fg: colors.danger, border: colors.danger },
};

/** Top bar with safe-area padding, optional back button and right-hand actions. */
export function ScreenHeader({
  title,
  onBack,
  backLabel,
  right,
}: {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
      {onBack ? (
        <IconButton icon="arrow-back" label={backLabel ?? 'Back'} onPress={onBack} />
      ) : (
        <View style={styles.headerSpacer} />
      )}
      {title ? (
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/** Large page title used at the top of tab screens. */
export function PageTitle({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.pageTitleRow, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.pageTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Selectable filter chip. */
export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [
        styles.chip,
        selected && {
          backgroundColor: color ?? colors.accent,
          borderColor: color ?? colors.accent,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  // Only the text is grouped for screen readers; the action stays separately focusable.
  return (
    <View style={styles.empty}>
      <View
        style={styles.emptyText}
        accessible
        accessibilityLabel={[title, message].filter(Boolean).join('. ')}
      >
        <Ionicons name={icon} size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{title}</Text>
        {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      </View>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/** Row in a settings-style list: icon, title, optional description, chevron or custom end. */
export function ListRow({
  icon,
  title,
  description,
  onPress,
  end,
  testID,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  onPress?: () => void;
  end?: ReactNode;
  testID?: string;
}) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={22} color={colors.textSecondary} /> : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {end ??
        (onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TOUCH_TARGET / 2,
  },
  button: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonText: { ...typography.bodyStrong, textAlign: 'center', flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSpacer: { width: spacing.md },
  headerTitle: { ...typography.subtitle, color: colors.text, flex: 1, marginLeft: spacing.xs },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pageTitle: { ...typography.headline, color: colors.text, flexShrink: 1 },
  sectionTitle: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.label, color: colors.textSecondary },
  chipTextSelected: { color: colors.onAccent },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  emptyMessage: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  emptyAction: { marginTop: spacing.md },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
});
