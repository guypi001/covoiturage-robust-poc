export const CONFIG = {
  notificationUrl:
    (process.env.EXPO_PUBLIC_NOTIFICATION_URL || 'https://notification.onrender.com').replace(/\/$/, ''),
};
