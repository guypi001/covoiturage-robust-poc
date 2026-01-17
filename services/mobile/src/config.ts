const required = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export const API_CONFIG = {
  bffUrl: required(process.env.EXPO_PUBLIC_BFF_URL, 'https://bff.onrender.com/api/bff'),
  rideUrl: required(process.env.EXPO_PUBLIC_RIDE_URL, 'https://ride.onrender.com/api/ride'),
  searchUrl: required(process.env.EXPO_PUBLIC_SEARCH_URL, 'https://search.onrender.com/api/search'),
  identityUrl: required(process.env.EXPO_PUBLIC_IDENTITY_URL, 'https://identity.onrender.com/api/identity'),
  messagingUrl: required(process.env.EXPO_PUBLIC_MESSAGING_URL, 'https://messaging.onrender.com/api/messaging')
};

export type ApiConfig = typeof API_CONFIG;
