import { runtimeConfig } from "@/lib/env";

export const PARKLIFE_PROTOCOL_HEADER = "x-parklife-protocol";
export const SUPPORTED_PROTOCOL_VERSIONS = [runtimeConfig.protocolVersion] as const;

export function getProtocolVersionFromRequest(request: Request) {
  const value = request.headers.get(PARKLIFE_PROTOCOL_HEADER);
  return value?.trim() || null;
}

export function isSupportedProtocol(version: string | null) {
  if (!version) return false;
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number]);
}
