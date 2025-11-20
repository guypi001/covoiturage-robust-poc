import { useEffect } from 'react';
import { getRide } from '../api';
import { useApp } from '../store';

const POLL_INTERVAL_MS = 30000;

export function useRideAvailability(
  rideId?: string,
  initialSeatsAvailable?: number,
  initialSeatsTotal?: number,
) {
  const entry = useApp((state) => (rideId ? state.rideAvailability[rideId] : undefined));
  const setRideAvailability = useApp((state) => state.setRideAvailability);

  useEffect(() => {
    if (!rideId || initialSeatsAvailable === undefined) return;
    setRideAvailability(rideId, initialSeatsAvailable, initialSeatsTotal);
  }, [rideId, initialSeatsAvailable, initialSeatsTotal, setRideAvailability]);

  useEffect(() => {
    if (!rideId) return;
    let cancelled = false;
    let interval: number | undefined;

    const sync = async () => {
      try {
        const ride = await getRide(rideId);
        if (!ride || (ride as any)?.error || cancelled) return;
        setRideAvailability(
          rideId,
          ride.seatsAvailable,
          typeof ride.seatsTotal === 'number' ? ride.seatsTotal : initialSeatsTotal,
        );
      } catch {
        // ignore individual sync errors
      }
    };

    void sync();
    if (typeof window !== 'undefined') {
      interval = window.setInterval(sync, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [rideId, initialSeatsTotal, setRideAvailability]);

  return {
    seatsAvailable: entry?.seatsAvailable ?? initialSeatsAvailable ?? 0,
    seatsTotal: entry?.seatsTotal ?? initialSeatsTotal,
    updatedAt: entry?.updatedAt,
  };
}
