import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LocationMeta, LocationMode } from '../types/location';
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

const MODE_LABELS: Record<LocationMode, string> = {
  city: 'Ville',
  current: 'Position actuelle',
  manual: 'Point manuel',
  place: 'Lieu favori',
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

const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return undefined;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
};

const toPoint = (meta?: LocationMeta | null) => {
  const lat = normalizeNumber(meta?.lat);
  const lng = normalizeNumber(meta?.lng);
  if (lat == null || lng == null) return undefined;
  return { lat, lng };
};

function FitBounds({ points, padding }: { points: Array<{ lat: number; lng: number }>; padding: number }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 9 });
  }, [map, padding, points]);
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
    () => toPoint(origin.meta),
    [origin.meta],
  );

  const geoDestination = useMemo(
    () => toPoint(destination.meta),
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

  const routeDuration = useMemo(() => {
    if (!approxDistanceKm) return undefined;
    return Math.max(20, Math.round((approxDistanceKm / 62) * 60));
  }, [approxDistanceKm]);

  const routeDurationLabel = formatDuration(routeDuration);
  const departureLabel = formatTime(departureAt);
  const originMode = origin.meta?.mode ? MODE_LABELS[origin.meta.mode] : undefined;
  const destinationMode = destination.meta?.mode ? MODE_LABELS[destination.meta.mode] : undefined;

  const hasCoords = Boolean(geoOrigin && geoDestination);
  const linePoints = hasCoords && geoOrigin && geoDestination ? [geoOrigin, geoDestination] : [];
  const mapPadding = Math.max(24, Math.min(56, Math.round(mapSize.width * 0.06)));
  const accuracyMeters = [origin.meta?.accuracyMeters, destination.meta?.accuracyMeters].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  const accuracyLabel =
    accuracyMeters.length > 0
      ? (() => {
          const avg = Math.round(accuracyMeters.reduce((total, value) => total + value, 0) / accuracyMeters.length);
          return avg < 1000 ? `Precision ~${avg} m` : `Precision ~${(avg / 1000).toFixed(1)} km`;
        })()
      : undefined;
  const initialCenter =
    geoOrigin && geoDestination
      ? { lat: (geoOrigin.lat + geoDestination.lat) / 2, lng: (geoOrigin.lng + geoDestination.lng) / 2 }
      : geoOrigin || geoDestination || { lat: 0, lng: 0 };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.5)]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-20 h-48 w-48 rounded-full bg-emerald-100/55 blur-3xl" />

      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Carte itineraire</p>
          <p className="text-sm text-slate-600">Parcours lisible avec reperes de route</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {departureLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-sm">
              Départ {departureLabel}
            </span>
          )}
          {approxDistanceKm && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 shadow-sm">
              ~{approxDistanceKm} km
            </span>
          )}
          {routeDurationLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 shadow-sm">
              ~{routeDurationLabel}
            </span>
          )}
        </div>
      </div>

      <div ref={wrapperRef} className="relative mt-3 overflow-hidden px-3 pb-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(14,165,233,0.14),transparent_42%),radial-gradient(circle_at_82%_74%,rgba(16,185,129,0.14),transparent_45%)]" />
        {hasCoords ? (
          <div
            className="relative w-full overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-inner"
            style={{ height: `${mapSize.height}px` }}
          >
            <MapContainer
              center={initialCenter}
              zoom={6}
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
              className="relative h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <Polyline positions={linePoints} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }} />
              <Polyline positions={linePoints} pathOptions={{ color: '#0ea5e9', weight: 6, opacity: 0.95 }} />
              <Polyline
                positions={linePoints}
                pathOptions={{ color: '#34d399', weight: 3, opacity: 0.88, dashArray: '8 10' }}
              />
              <CircleMarker
                center={geoOrigin!}
                radius={16}
                pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.16, weight: 2 }}
              />
              <CircleMarker
                center={geoDestination!}
                radius={16}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.14, weight: 2 }}
              />
              <Marker position={geoOrigin!} icon={getLeafletIcon(origin.label, [42, 42])} />
              <Marker position={geoDestination!} icon={getLeafletIcon(destination.label, [42, 42])} />
              <FitBounds points={linePoints} padding={mapPadding} />
            </MapContainer>

            <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-md backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Itineraire principal
            </div>
            {(routeDurationLabel || accuracyLabel) && (
              <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-1">
                {routeDurationLabel && (
                  <span className="rounded-full border border-white/80 bg-white/92 px-3 py-1 text-[11px] font-semibold text-emerald-700 shadow-md">
                    Duree estimee {routeDurationLabel}
                  </span>
                )}
                {accuracyLabel && (
                  <span className="rounded-full border border-white/80 bg-white/92 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-md">
                    {accuracyLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className="relative w-full overflow-hidden rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-600"
            style={{ height: `${mapSize.height}px` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(14,165,233,0.06),transparent_35%,rgba(16,185,129,0.08))]" />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-semibold text-slate-700">Carte indisponible</p>
              <p className="max-w-md text-xs text-slate-500">
                Ajoute une origine et une destination geolocalisees pour afficher le trace precis du trajet.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                  {origin.label}
                </span>
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                  {destination.label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t border-slate-200 px-4 py-4 text-sm md:grid-cols-2">
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-3">
          <p className="text-[11px] uppercase tracking-[0.15em] text-sky-700">Depart</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{origin.label}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {origin.meta?.label && (
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                Repere: {origin.meta.label}
              </span>
            )}
            {originMode && (
              <span className="rounded-full border border-sky-200 bg-sky-100/70 px-2.5 py-1 text-sky-700">
                {originMode}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3">
          <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-700">Arrivee</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{destination.label}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {destination.meta?.label && (
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                Repere: {destination.meta.label}
              </span>
            )}
            {destinationMode && (
              <span className="rounded-full border border-emerald-200 bg-emerald-100/70 px-2.5 py-1 text-emerald-700">
                {destinationMode}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
