import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../ui/theme';

interface AccordionItem {
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Index of the item that starts expanded. */
  initiallyExpanded?: number;
}

export function Accordion({ items, initiallyExpanded }: AccordionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initiallyExpanded ?? null);

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const expanded = expandedIndex === index;
        return (
          <View key={item.title} style={styles.item}>
            <Pressable
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}
              onPress={() => setExpandedIndex(expanded ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={item.title}
            >
              <Text style={styles.headerText}>{item.title}</Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
            {expanded && <View style={styles.content}>{item.content}</View>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  item: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  headerText: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
});
