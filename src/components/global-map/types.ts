export interface RouteRequestUser {
  id: string;
  userId: string;
  name: string;
  phone: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  preferredTime: string | null;
  preferredDays: number[];
  status: string;
  createdAt: string;
  requestIds: string[];
}

export interface AreaPreset {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
  name: string;
  assignedUsers: string[];
  order: number;
}

export type AreaFilterMode = 'both' | 'pickup' | 'dropoff';

export interface FilterState {
  timeFrom: string;
  timeTo: string;
  days: number[];
  areaPreset: string;
  areaRadius: number;
  areaFilterMode: AreaFilterMode;
  pickupArea: google.maps.Circle | null;
  dropoffArea: google.maps.Circle | null;
}

export const AREA_PRESETS: AreaPreset[] = [
  { name: 'New Cairo', lat: 30.0300, lng: 31.4700, radius: 8000 },
  { name: 'Maadi', lat: 29.9602, lng: 31.2569, radius: 5000 },
  { name: 'Smart Village', lat: 30.0712, lng: 31.0173, radius: 5000 },
  { name: '6th October', lat: 29.9727, lng: 30.9388, radius: 10000 },
  { name: 'Nasr City', lat: 30.0511, lng: 31.3656, radius: 5000 },
  { name: 'Heliopolis', lat: 30.0866, lng: 31.3394, radius: 4000 },
  { name: 'Downtown', lat: 30.0444, lng: 31.2357, radius: 3000 },
  { name: 'Zamalek', lat: 30.0608, lng: 31.2194, radius: 2000 },
  { name: 'Dokki/Mohandessin', lat: 30.0380, lng: 31.2000, radius: 4000 },
  { name: 'Sheikh Zayed', lat: 30.0375, lng: 30.9853, radius: 7000 },
];

export function deduplicateRequests(
  requests: any[],
  profiles: Record<string, any>
): RouteRequestUser[] {
  const grouped: Record<string, RouteRequestUser> = {};

  for (const rr of requests) {
    const key = `${rr.user_id}_${Math.round(rr.origin_lat * 50)}_${Math.round(rr.origin_lng * 50)}_${Math.round(rr.destination_lat * 50)}_${Math.round(rr.destination_lng * 50)}`;
    
    if (grouped[key]) {
      const existing = grouped[key];
      const newDays = rr.preferred_days || [];
      for (const d of newDays) {
        if (!existing.preferredDays.includes(d)) {
          existing.preferredDays.push(d);
        }
      }
      existing.preferredDays.sort((a, b) => a - b);
      existing.requestIds.push(rr.id);
      if (rr.preferred_time && !existing.preferredTime) {
        existing.preferredTime = rr.preferred_time;
      }
    } else {
      const prof = profiles[rr.user_id];
      grouped[key] = {
        id: key,
        userId: rr.user_id,
        name: prof?.full_name || rr.user_id.slice(0, 8),
        phone: prof?.phone || '',
        originName: rr.origin_name,
        originLat: rr.origin_lat,
        originLng: rr.origin_lng,
        destinationName: rr.destination_name,
        destinationLat: rr.destination_lat,
        destinationLng: rr.destination_lng,
        preferredTime: rr.preferred_time,
        preferredDays: [...(rr.preferred_days || [])],
        status: rr.status,
        createdAt: rr.created_at,
        requestIds: [rr.id],
      };
    }
  }

  return Object.values(grouped);
}

export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInRadius(lat: number, lng: number, centerLat: number, centerLng: number, radius: number): boolean {
  return getDistance(lat, lng, centerLat, centerLng) <= radius;
}
