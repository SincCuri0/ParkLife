import { normalizeScopeKey } from "@/lib/sync/scope-keys";

export function parseSyncPullScopes(url: URL) {
  const values = [
    ...url.searchParams.getAll("scope"),
    ...url.searchParams.getAll("scope_key"),
  ];

  if (values.length === 0) {
    throw new Error("At least one scope or scope_key query parameter is required");
  }

  return Array.from(new Set(values.map((value) => normalizeScopeKey(value))));
}

export function isSyncScopeAuthorized(scopeKey: string, userId: string, memberGroupIds: Set<string>) {
  if (scopeKey.startsWith("user:")) {
    return scopeKey.slice("user:".length) === userId;
  }

  if (scopeKey.startsWith("group:")) {
    const groupId = scopeKey.slice("group:".length);
    return memberGroupIds.has(groupId);
  }

  // Map cell scopes are anonymous/public slices by design.
  return scopeKey.startsWith("map:cell:");
}

