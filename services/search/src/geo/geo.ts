// services/search/src/geo/geo.ts
import { Injectable } from '@nestjs/common';
import { CI_CITIES_GEO, findCityGeo } from './ci-cities-geo';

export type Pt = { lat: number; lng: number };

const toRad = (d: number) => (d * Math.PI) / 180;

// Haversine (m)
export function haversineMeters(a: Pt, b: Pt): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Projection d'un point P sur le segment AB (approx. plane locale)
// Retourne distance au segment (m) et paramètre t (0..1).
export function pointToSegmentMeters(
  p: Pt,
  a: Pt,
  b: Pt,
): { distance: number; t: number } {
  // Equirectangular locale
  const lat0 = toRad((a.lat + b.lat) / 2);
  const mPerDegLat =
    111132.954 - 559.822 * Math.cos(2 * lat0) + 1.175 * Math.cos(4 * lat0);
  const mPerDegLng = 111132.954 * Math.cos(lat0);

  const ax = a.lng * mPerDegLng,
    ay = a.lat * mPerDegLat;
  const bx = b.lng * mPerDegLng,
    by = b.lat * mPerDegLat;
  const px = p.lng * mPerDegLng,
    py = p.lat * mPerDegLat;

  const vx = bx - ax,
    vy = by - ay;
  const wx = px - ax,
    wy = py - ay;
  const vv = vx * vx + vy * vy || 1e-9;
  let t = (wx * vx + wy * vy) / vv;

  const tClamped = Math.max(0, Math.min(1, t));
  const sx = ax + tClamped * vx;
  const sy = ay + tClamped * vy;
  const dx = px - sx,
    dy = py - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return { distance: dist, t };
}

@Injectable()
export class GeoService {
  /** Coordonnées d'une ville (avec alt/variantes). */
  getCity(name: string): (Pt & { name: string }) | undefined {
    const c = findCityGeo(name);
    if (!c) return;
    return { name: c.name, lat: c.lat, lng: c.lng };
  }

  /** Liste des villes à <= radiusKm autour d'une ville. */
  nearbyCities(centerName: string, radiusKm: number): string[] {
    const c = this.getCity(centerName);
    if (!c) return [centerName];
    const R = radiusKm * 1000;
    const res = CI_CITIES_GEO
      .filter((v) => haversineMeters(c, { lat: v.lat, lng: v.lng }) <= R)
      .map((v) => v.name);
    if (!res.includes(c.name)) res.push(c.name);
    return Array.from(new Set(res));
  }

  /** Le point p est-il dans le corridor (bufferKm) du segment AB ? */
  isNearCorridor(
    p: Pt,
    a: Pt,
    b: Pt,
    bufferKm: number,
  ): { ok: boolean; t: number; distanceMeters: number } {
    const { distance, t } = pointToSegmentMeters(p, a, b);
    return { ok: distance <= bufferKm * 1000, t, distanceMeters: distance };
  }
}
