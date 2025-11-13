import { useCallback, useEffect, useState } from 'react';
import type { PendingAcquisition } from '../utils/pendingAcquisitions';
import { getPendingAcquisitions } from '../utils/pendingAcquisitions';

export function usePendingAcquisitions(ownerId: string) {
  const [items, setItems] = useState<PendingAcquisition[]>([]);

  const refresh = useCallback(() => {
    if (!ownerId) {
      setItems([]);
      return;
    }
    setItems(getPendingAcquisitions(ownerId));
  }, [ownerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId: string }>).detail;
      if (!detail || detail.ownerId !== ownerId) return;
      refresh();
    };
    window.addEventListener('kari:pendingAcquisitions', handler as EventListener);
    return () => window.removeEventListener('kari:pendingAcquisitions', handler as EventListener);
  }, [ownerId, refresh]);

  return { items, refresh };
}
