import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import type { LocationMeta } from '../types/location';
import { getLeafletIcon } from '../utils/cityIcons';

type RouteEndpoint = {
  label: string;
  meta?: LocationMeta | null;
};

type RouteMapProps = {
  origin: RouteEndpoint;
  destination: RouteEndpoint;
  departureAt?: string;
  distanceKmHint?: number;
};

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return Math.round(R * c);
};

const formatTime = (value?: string) => {
  if (!value) return undefined;
  try {
    const date = new Date(value);
    return date.toLocaleString('fr-FR', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return undefined;
  }
};

const normalizeNumber = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function FitBounds({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

export function RouteMap({ origin, destination, departureAt, distanceKmHint }: RouteMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({ width: 760, height: 300 });

  useEffect(() => {
    const target = wrapperRef.current;
    if (!target) return;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const width = Math.max(280, Math.min(960, Math.round(rect.width || 760)));
      const height = Math.max(220, Math.min(420, Math.round(width * 0.5)));
      setMapSize({ width, height });
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  const geoOrigin = useMemo(
    () =>
      origin.meta && normalizeNumber(origin.meta.lat) && normalizeNumber(origin.meta.lng)
        ? { lat: origin.meta.lat as number, lng: origin.meta.lng as number }
        : undefined,
    [origin.meta],
  );

  const geoDestination = useMemo(
    () =>
      destination.meta && normalizeNumber(destination.meta.lat) && normalizeNumber(destination.meta.lng)
        ? { lat: destination.meta.lat as number, lng: destination.meta.lng as number }
        : undefined,
    [destination.meta],
  );

  const approxDistanceKm = useMemo(() => {
    if (typeof distanceKmHint === 'number' && Number.isFinite(distanceKmHint) && distanceKmHint > 0) {
      return Math.round(distanceKmHint);
    }
    if (geoOrigin && geoDestination) {
      return haversineKm(geoOrigin, geoDestination);
    }
    return undefined;
  }, [distanceKmHint, geoDestination, geoOrigin]);

  const departureLabel = formatTime(departureAt);

  const hasCoords = Boolean(geoOrigin && geoDestination);
  const linePoints = hasCoords && geoOrigin && geoDestination ? [geoOrigin, geoDestination] : [];
  const initialCenter =
    geoOrigin && geoDestination
      ? { lat: (geoOrigin.lat + geoDestination.lat) / 2, lng: (geoOrigin.lng + geoDestination.lng) / 2 }
      : geoOrigin || geoDestination || { lat: 0, lng: 0 };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="space-y-0.5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Vue du trajet</p>
          <p className="text-sm text-slate-600">Repère visuel rapide du parcours</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {departureLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              Départ {departureLabel}
            </span>
          )}
          {approxDistanceKm && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
              ~{approxDistanceKm} km
            </span>
          )}
        </div>
      </div>

      <div ref={wrapperRef} className="relative mt-3 overflow-hidden px-2 pb-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.10),transparent_45%),radial-gradient(circle_at_80%_65%,rgba(14,165,233,0.08),transparent_40%)]" />
        {hasCoords ? (
          <MapContainer
            center={initialCenter}
            zoom={6}
            scrollWheelZoom={false}
            style={{ height: `${mapSize.height}px`, width: '100%' }}
            className="relative w-full rounded-xl border border-slate-200 bg-white shadow-inner"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={linePoints} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.9 }} />
            <Marker position={geoOrigin!} icon={getLeafletIcon(origin.label)} />
            <Marker position={geoDestination!} icon={getLeafletIcon(destination.label)} />
            <FitBounds points={linePoints} />
          </MapContainer>
        ) : (
          <div
            className="relative w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-600"
            style={{ height: `${mapSize.height}px` }}
          >
            Ajoute des points avec coordonnées (ex: via une recherche géolocalisée) pour afficher le tracé sur la carte.
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t border-slate-200 px-4 py-4 text-sm md:grid-cols-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-sky-100 ring-1 ring-sky-200" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-sky-600">Départ</p>
            <p className="text-base font-semibold text-slate-900">{origin.label}</p>
            {origin.meta?.label && <p className="text-xs text-slate-500">Repère: {origin.meta.label}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-sky-100 ring-1 ring-sky-200" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-sky-600">Arrivée</p>
            <p className="text-base font-semibold text-slate-900">{destination.label}</p>
            {destination.meta?.label && <p className="text-xs text-slate-500">Repère: {destination.meta.label}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
