import type { Geofence } from "./types";

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeofenceMatch = {
  geofenceId: string | null;
  distanceM: number | null;
  /**
   * Inside when the fix, widened by its reported accuracy, overlaps the fence.
   * A single poor reading is never rejected; it is flagged by the caller.
   */
  inside: boolean;
};

export function matchGeofence(
  lat: number | null,
  lng: number | null,
  accuracyM: number | null,
  geofences: Geofence[],
): GeofenceMatch {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { geofenceId: null, distanceM: null, inside: false };
  }
  let best: GeofenceMatch = { geofenceId: null, distanceM: null, inside: false };
  for (const fence of geofences) {
    if (!fence.active) continue;
    const distance = haversineMeters(lat, lng, fence.lat, fence.lng);
    // Accuracy can widen the fence by at most its own radius.
    const slack = Math.min(Math.max(0, accuracyM ?? 0), fence.radiusM);
    const inside = distance - slack <= fence.radiusM;
    if (
      best.distanceM == null ||
      (inside && !best.inside) ||
      (inside === best.inside && distance < best.distanceM)
    ) {
      best = { geofenceId: fence.id, distanceM: Math.round(distance), inside };
    }
  }
  return best;
}
