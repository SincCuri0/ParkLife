import { describe, expect, it } from "vitest";
import { runtimeConfig } from "../env";
import {
  PARKLIFE_PROTOCOL_HEADER,
  getProtocolVersionFromRequest,
  isSupportedProtocol,
} from "./protocol";

describe("sync protocol helpers", () => {
  it("reads and trims protocol header", () => {
    const request = new Request("https://parklife.local/api/sync/pull", {
      headers: {
        [PARKLIFE_PROTOCOL_HEADER]: ` ${runtimeConfig.protocolVersion} `,
      },
    });

    expect(getProtocolVersionFromRequest(request)).toBe(runtimeConfig.protocolVersion);
  });

  it("validates supported protocol versions", () => {
    expect(isSupportedProtocol(runtimeConfig.protocolVersion)).toBe(true);
    expect(isSupportedProtocol("2025-01-v1")).toBe(false);
    expect(isSupportedProtocol(null)).toBe(false);
  });
});
