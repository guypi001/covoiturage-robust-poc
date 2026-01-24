import { CI_CITIES } from '../data/cities-ci';

const strip = (value) => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const resolveCityCoords = (name) => {
  const target = strip(name);
  if (!target) return null;
  const match = CI_CITIES.find((city) => {
    if (strip(city.name) === target) return true;
    return (city.alt || []).some((alt) => strip(alt) === target);
  });
  if (!match) return null;
  return { latitude: match.lat, longitude: match.lng };
};

export const buildRegionForCoords = (origin, destination) => {
  const fallback = {
    latitude: 5.3599517,
    longitude: -4.0082563,
    latitudeDelta: 2.2,
    longitudeDelta: 2.2,
  };
  if (!origin && !destination) return fallback;
  if (origin && !destination) {
    return { ...origin, latitudeDelta: 0.6, longitudeDelta: 0.6 };
  }
  if (!origin && destination) {
    return { ...destination, latitudeDelta: 0.6, longitudeDelta: 0.6 };
  }

  const minLat = Math.min(origin.latitude, destination.latitude);
  const maxLat = Math.max(origin.latitude, destination.latitude);
  const minLng = Math.min(origin.longitude, destination.longitude);
  const maxLng = Math.max(origin.longitude, destination.longitude);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latDelta = Math.max(0.2, (maxLat - minLat) * 1.8);
  const lngDelta = Math.max(0.2, (maxLng - minLng) * 1.8);

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};
