const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GEOHASH_RE = /^[0123456789bcdefghjkmnpqrstuvwxyz]+$/i;
const ROOT_MAP_SCOPE = "r";

export type ScopeKey = string;

export function userScopeKey(userId: string) {
  return `user:${userId}`;
}

export function groupScopeKey(groupId: string) {
  return `group:${groupId}`;
}

export function mapCellScopeKey(geohash: string) {
  return `map:cell:${geohash.toLowerCase()}`;
}

export function isValidScopeKey(scopeKey: string) {
  if (scopeKey.startsWith("user:")) {
    return UUID_RE.test(scopeKey.slice("user:".length));
  }

  if (scopeKey.startsWith("group:")) {
    return UUID_RE.test(scopeKey.slice("group:".length));
  }

  if (scopeKey.startsWith("map:cell:")) {
    const geohash = scopeKey.slice("map:cell:".length);
    if (geohash === ROOT_MAP_SCOPE) {
      return true;
    }
    return geohash.length >= 4 && geohash.length <= 12 && GEOHASH_RE.test(geohash);
  }

  return false;
}

export function normalizeScopeKey(scopeKey: string) {
  const normalized = scopeKey.trim().toLowerCase();
  if (!isValidScopeKey(normalized)) {
    throw new Error(`Invalid scope key: ${scopeKey}`);
  }
  return normalized;
}
