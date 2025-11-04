import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicProfile, type Ride } from '../api';
import { useApp } from '../store';

export function useRideContact() {
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const navigate = useNavigate();
  const [contactingRideId, setContactingRideId] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const contactDriver = useCallback(
    async (ride: Ride) => {
      if (!ride?.rideId) return;
      if (!token) {
        setContactError('Connecte-toi pour envoyer un message au conducteur.');
        return;
      }
      if (!ride.driverId) {
        setContactError('Impossible de contacter ce conducteur (identifiant absent).');
        return;
      }
      if (account?.id === ride.driverId) {
        setContactError('Tu es déjà l’auteur de ce trajet.');
        return;
      }

      setContactError(null);
      setContactingRideId(ride.rideId);
      try {
        let profile: Awaited<ReturnType<typeof getPublicProfile>> | null = null;
        try {
          profile = await getPublicProfile(ride.driverId, token);
        } catch (err: any) {
          const status = err?.response?.status;
          if (status && status !== 404) {
            throw err;
          }
        }

        const contactLabel =
          profile?.fullName ||
          profile?.companyName ||
          profile?.email ||
          ride.driverLabel ||
          'Conducteur KariGo';

        const contact = {
          id: ride.driverId,
          type: profile?.type ?? 'INDIVIDUAL',
          label: contactLabel,
          email: profile?.email,
        } as const;

        navigate('/messages', {
          state: {
            contact,
            rideContext: {
              rideId: ride.rideId,
              originCity: ride.originCity,
              destinationCity: ride.destinationCity,
              departureAt: ride.departureAt,
            },
          },
        });
      } catch (err: any) {
        setContactError(err?.response?.data?.message || err?.message || 'Contact impossible pour ce trajet.');
      } finally {
        setContactingRideId(null);
      }
    },
    [account?.id, token, navigate],
  );

  const clearContactError = useCallback(() => setContactError(null), []);

  return {
    contactDriver,
    contactingRideId,
    contactError,
    clearContactError,
  };
}
