import { useCallback, useEffect, useRef, useTransition } from 'react';
import axios from 'axios';
import { searchRides, type Ride, type SearchRequest } from '../api';
import { buildRideSearchKey, getRideSearchCache, setRideSearchCache } from '../utils/rideSearchCache';

type SuccessHandler = (rides: Ride[], info: { fromCache: boolean }) => void;
type ErrorHandler = (message: string) => void;

export function useRideSearch() {
  const abortRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => abortRef.current?.abort(), []);

  const execute = useCallback(
    async (params: SearchRequest, handlers: { onSuccess: SuccessHandler; onError: ErrorHandler }) => {
      const key = buildRideSearchKey(params);
      const cached = getRideSearchCache(key);
      if (cached) {
        startTransition(() => handlers.onSuccess(cached, { fromCache: true }));
        return { fromCache: true, aborted: false };
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await searchRides(params, { signal: controller.signal });
        startTransition(() => {
          setRideSearchCache(key, data);
          handlers.onSuccess(data, { fromCache: false });
        });
        return { fromCache: false, aborted: false };
      } catch (err: any) {
        if (controller.signal.aborted || axios.isCancel(err)) {
          return { fromCache: false, aborted: true };
        }
        const message = err?.response?.data?.message || err?.message || 'Erreur de recherche.';
        handlers.onError(message);
        return { fromCache: false, aborted: false };
      }
    },
    [startTransition],
  );

  return { execute, isPending };
}
