import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface AccordionItem {
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <AccordionItemComponent
          key={index}
          title={item.title}
          content={item.content}
          isExpanded={expandedIndex === index}
          onToggle={() => toggleExpand(index)}
        />
      ))}
    </View>
  );
}

interface AccordionItemComponentProps {
  title: string;
  content: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

function AccordionItemComponent({
  title,
  content,
  isExpanded,
  onToggle,
}: AccordionItemComponentProps) {
  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.headerText}>{title}</Text>
        <Text style={[styles.arrow, isExpanded && styles.arrowExpanded]}>▼</Text>
      </TouchableOpacity>

      {isExpanded && <View style={styles.content}>{content}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  item: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#1E1E1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  arrow: {
    color: '#BDBDBD',
    fontSize: 12,
  },
  arrowExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
});
