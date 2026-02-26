import { describe, expect, it } from "vitest";
import {
  groupScopeKey,
  isValidScopeKey,
  mapCellScopeKey,
  normalizeScopeKey,
  userScopeKey,
} from "./scope-keys";

const SAMPLE_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SAMPLE_GROUP_ID = "b7d5f2ec-444d-4df6-9ef2-6f911f7d7f8f";

describe("sync scope keys", () => {
  it("builds valid user/group/map scopes", () => {
    expect(isValidScopeKey(userScopeKey(SAMPLE_USER_ID))).toBe(true);
    expect(isValidScopeKey(groupScopeKey(SAMPLE_GROUP_ID))).toBe(true);
    expect(isValidScopeKey(mapCellScopeKey("gcpv"))).toBe(true);
    expect(isValidScopeKey(mapCellScopeKey("r"))).toBe(true);
  });

  it("normalizes casing and whitespace", () => {
    expect(normalizeScopeKey(`  GROUP:${SAMPLE_GROUP_ID.toUpperCase()}  `))
      .toBe(`group:${SAMPLE_GROUP_ID}`);
  });

  it("rejects invalid scope formats", () => {
    expect(isValidScopeKey("group:not-a-uuid")).toBe(false);
    expect(isValidScopeKey("map:cell:abc")).toBe(false);
    expect(() => normalizeScopeKey("map:cell:???")).toThrowError(/Invalid scope key/i);
  });
});

