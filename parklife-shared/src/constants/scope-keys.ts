export function userScopeKey(userId: string) {
  return `user:${userId}`;
}

export const userScope = userScopeKey;

export function groupScopeKey(groupId: string) {
  return `group:${groupId}`;
}

export const groupScope = groupScopeKey;

export function mapCellScopeKey(geohash: string) {
  return `map:cell:${geohash.toLowerCase()}`;
}

export const mapCellScope = mapCellScopeKey;
