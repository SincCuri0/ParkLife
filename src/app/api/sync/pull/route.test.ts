import { describe, expect, it } from "vitest";
import { isSyncScopeAuthorized, parseSyncPullScopes } from "./helpers";

const SAMPLE_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SAMPLE_GROUP_ID = "b7d5f2ec-444d-4df6-9ef2-6f911f7d7f8f";

describe("sync pull scope parsing", () => {
  it("parses, normalizes, and deduplicates scope query values", () => {
    const url = new URL(
      `https://parklife.local/api/sync/pull?scope=USER:${SAMPLE_USER_ID}&scope_key=group:${SAMPLE_GROUP_ID}&scope=user:${SAMPLE_USER_ID}`,
    );

    const parsed = parseSyncPullScopes(url);
    expect(parsed).toEqual([
      `user:${SAMPLE_USER_ID}`,
      `group:${SAMPLE_GROUP_ID}`,
    ]);
  });

  it("throws when no scope query parameters are supplied", () => {
    const url = new URL("https://parklife.local/api/sync/pull");
    expect(() => parseSyncPullScopes(url))
      .toThrowError(/At least one scope/i);
  });
});

describe("sync scope authorization", () => {
  it("allows personal, joined-group, and map cell scopes", () => {
    const groups = new Set([SAMPLE_GROUP_ID]);

    expect(isSyncScopeAuthorized(`user:${SAMPLE_USER_ID}`, SAMPLE_USER_ID, groups)).toBe(true);
    expect(isSyncScopeAuthorized(`group:${SAMPLE_GROUP_ID}`, SAMPLE_USER_ID, groups)).toBe(true);
    expect(isSyncScopeAuthorized("map:cell:r", SAMPLE_USER_ID, groups)).toBe(true);
  });

  it("rejects unrelated user and unjoined group scopes", () => {
    const groups = new Set<string>();

    expect(isSyncScopeAuthorized("user:8f3c4f7c-6703-4c29-95ce-c2f7b4dc4cdf", SAMPLE_USER_ID, groups)).toBe(false);
    expect(isSyncScopeAuthorized(`group:${SAMPLE_GROUP_ID}`, SAMPLE_USER_ID, groups)).toBe(false);
  });
});
