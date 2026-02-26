export type BBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function parseBbox(value: string | null): BBox | null {
  if (!value) return null;

  const parts = value.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) {
    return null;
  }

  const [minLngRaw, minLatRaw, maxLngRaw, maxLatRaw] = parts;
  const minLng = Math.min(minLngRaw, maxLngRaw);
  const maxLng = Math.max(minLngRaw, maxLngRaw);
  const minLat = Math.min(minLatRaw, maxLatRaw);
  const maxLat = Math.max(minLatRaw, maxLatRaw);

  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
    return null;
  }

  return { minLng, minLat, maxLng, maxLat };
}

export function isPointInBbox(latitude: number, longitude: number, bbox: BBox) {
  return latitude >= bbox.minLat
    && latitude <= bbox.maxLat
    && longitude >= bbox.minLng
    && longitude <= bbox.maxLng;
}

export function decodeGeohashCenter(geohash: string) {
  const normalized = geohash.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let evenBit = true;

  for (const char of normalized) {
    const charIndex = GEOHASH_BASE32.indexOf(char);
    if (charIndex < 0) {
      return null;
    }

    for (const mask of [16, 8, 4, 2, 1]) {
      if (evenBit) {
        const midpoint = (minLng + maxLng) / 2;
        if ((charIndex & mask) !== 0) {
          minLng = midpoint;
        } else {
          maxLng = midpoint;
        }
      } else {
        const midpoint = (minLat + maxLat) / 2;
        if ((charIndex & mask) !== 0) {
          minLat = midpoint;
        } else {
          maxLat = midpoint;
        }
      }

      evenBit = !evenBit;
    }
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  };
}

export function isGeohashInBbox(geohash: string, bbox: BBox) {
  const center = decodeGeohashCenter(geohash);
  if (!center) return false;
  return isPointInBbox(center.latitude, center.longitude, bbox);
}

