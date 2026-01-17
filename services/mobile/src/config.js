const baseUrl = (process.env.EXPO_PUBLIC_BASE_URL || 'http://82.112.255.155:3006').replace(/\/$/, '');
const apiBase = `${baseUrl}/api`;

export const CONFIG = {
  baseUrl,
  apiBase,
  searchUrl: (process.env.EXPO_PUBLIC_SEARCH_URL || `${apiBase}/search`).replace(/\/$/, ''),
  rideUrl: (process.env.EXPO_PUBLIC_RIDE_URL || `${apiBase}/ride`).replace(/\/$/, ''),
  identityUrl: (process.env.EXPO_PUBLIC_IDENTITY_URL || `${apiBase}/identity`).replace(/\/$/, ''),
  bffUrl: (process.env.EXPO_PUBLIC_BFF_URL || `${apiBase}/bff`).replace(/\/$/, ''),
  messagingUrl: (process.env.EXPO_PUBLIC_MESSAGING_URL || `${apiBase}/messaging`).replace(/\/$/, ''),
  bookingUrl: (process.env.EXPO_PUBLIC_BOOKING_URL || `${apiBase}/booking`).replace(/\/$/, ''),
  paymentUrl: (process.env.EXPO_PUBLIC_PAYMENT_URL || `${apiBase}/payment`).replace(/\/$/, ''),
  walletUrl: (process.env.EXPO_PUBLIC_WALLET_URL || `${apiBase}/wallet`).replace(/\/$/, ''),
  notificationUrl: (process.env.EXPO_PUBLIC_NOTIFICATION_URL || `${apiBase}/notification`).replace(/\/$/, ''),
};
