const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

export const isGooglePlacesConfigured = Boolean(GOOGLE_PLACES_KEY);

type PlacesAutocompleteResponse = {
  predictions?: Array<{
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
  status?: string;
  error_message?: string;
};

type PlacesDetailsResponse = {
  result?: {
    name?: string;
    formatted_address?: string;
    geometry?: {
      location?: { lat: number; lng: number };
    };
  };
  status?: string;
  error_message?: string;
};

export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
};

const withKey = (params: Record<string, string>) => {
  if (!GOOGLE_PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY missing');
  const search = new URLSearchParams({ key: GOOGLE_PLACES_KEY, language: 'fr', ...params });
  return search.toString();
};

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!GOOGLE_PLACES_KEY) return [];
  const qs = withKey({ input: query });
  const url = `${GOOGLE_PLACES_BASE}/autocomplete/json?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places autocomplete error (${res.status})`);
  const data: PlacesAutocompleteResponse = await res.json();
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places API status ${data.status}`);
  }
  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text,
    secondaryText: p.structured_formatting?.secondary_text,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_PLACES_KEY) return null;
  const fields = ['name', 'formatted_address', 'geometry/location'].join(',');
  const qs = withKey({ place_id: placeId, fields });
  const url = `${GOOGLE_PLACES_BASE}/details/json?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places details error (${res.status})`);
  const data: PlacesDetailsResponse = await res.json();
  if (data.status && data.status !== 'OK') {
    throw new Error(data.error_message || `Places API status ${data.status}`);
  }
  const loc = data.result?.geometry?.location;
  if (!loc) return null;
  return {
    placeId,
    name: data.result?.name ?? '',
    formattedAddress: data.result?.formatted_address ?? '',
    location: { lat: loc.lat, lng: loc.lng },
  };
}
