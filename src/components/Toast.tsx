/**
 * TOAST
 * Eenvoudige toast-notificatie via context. Gebruik:
 *   const { show } = useToast();
 *   show('Opgeslagen!', 'success');
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={styles.container}>
        {toasts.map(t => (
          <ToastBubble key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastBubble({ item }: { item: ToastItem }) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [opacity]);

  const bg =
    item.type === 'error'
      ? colors.danger
      : item.type === 'info'
      ? colors.info
      : colors.secondaryDark;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{item.message}</Text>
    </Animated.View>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    maxWidth: '100%',
    ...shadows.md,
  },
  toastText: {
    color: colors.white,
    fontWeight: '500',
  },
});
