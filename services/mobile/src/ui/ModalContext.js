import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

const ModalContext = createContext({
  showModal: () => {},
  hideModal: () => {},
});

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const showModal = useCallback((payload) => {
    setModal(payload);
  }, []);

  const hideModal = useCallback(() => {
    setModal(null);
  }, []);

  const value = useMemo(() => ({ showModal, hideModal }), [showModal, hideModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Modal visible={Boolean(modal)} transparent animationType="fade" onRequestClose={hideModal}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{modal?.title || 'Confirmation'}</Text>
            {modal?.message ? <Text style={styles.message}>{modal.message}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.ghostButton} onPress={hideModal}>
                <Text style={styles.ghostText}>{modal?.cancelLabel || 'Annuler'}</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  modal?.onConfirm?.();
                  hideModal();
                }}
              >
                <Text style={styles.primaryText}>{modal?.confirmLabel || 'Confirmer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  message: {
    fontSize: 14,
    color: colors.slate600,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: colors.slate900,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  ghostText: {
    color: colors.slate700,
    fontWeight: '600',
  },
});
