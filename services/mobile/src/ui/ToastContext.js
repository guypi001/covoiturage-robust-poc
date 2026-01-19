import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

const ToastContext = createContext({
  showToast: () => {},
});

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${idCounter++}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timer = setTimeout(() => removeToast(id), 3000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.toastContainer}>
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} tone={toast.tone} index={index} message={toast.message} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ tone, message, index }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay: index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay: index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        styles[`toast_${tone}`],
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  toast_info: {
    borderColor: colors.slate200,
  },
  toast_success: {
    borderColor: colors.emerald500,
    backgroundColor: colors.emerald100,
  },
  toast_error: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  toastText: {
    color: colors.slate900,
    fontSize: 13,
    fontWeight: '600',
  },
});
