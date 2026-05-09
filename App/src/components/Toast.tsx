import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({ message, type, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const slideAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [slideAnim, duration, onDismiss]);

  if (!visible) {
    return null;
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  const backgroundColor = type === 'error' ? '#F44336' : type === 'success' ? '#4CAF50' : '#2196F3';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          backgroundColor,
        },
      ]}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          setVisible(false);
          onDismiss?.();
        }}
      >
        <View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 1000,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
