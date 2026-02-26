function parseBooleanFlag(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const featureFlags = {
  syncV2Enabled: parseBooleanFlag(process.env.SYNC_V2_ENABLED, false),
  heatmapV2Enabled: parseBooleanFlag(process.env.HEATMAP_V2_ENABLED, false),
  assistantActionsEnabled: parseBooleanFlag(process.env.ASSISTANT_ACTIONS_ENABLED, false),
  localFirstEnabled: parseBooleanFlag(process.env.LOCAL_FIRST_ENABLED, false),
  nodeHostingEnabled: parseBooleanFlag(process.env.NODE_HOSTING_ENABLED, false),
  parkPoundEnabled: parseBooleanFlag(process.env.PARK_POUND_ENABLED, false),
} as const;

export const runtimeConfig = {
  protocolVersion: (process.env.PARKLIFE_PROTOCOL_VERSION || "2026-02-v1").trim(),
  heatmapKAnonymityThreshold: parsePositiveInt(process.env.HEATMAP_K_ANONYMITY_THRESHOLD, 3),
  heatmapRefreshToken: (process.env.HEATMAP_REFRESH_TOKEN || process.env.CRON_SECRET || "").trim(),
} as const;
