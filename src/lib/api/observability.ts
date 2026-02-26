import { randomUUID } from "crypto";

export const CORRELATION_HEADER = "x-correlation-id";

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  correlationId?: string;
  [key: string]: unknown;
}

export function getCorrelationIdFromHeaders(headers: Headers) {
  return headers.get(CORRELATION_HEADER) || undefined;
}

export function ensureCorrelationId(headers: Headers) {
  const existing = headers.get(CORRELATION_HEADER);
  if (existing && existing.trim()) {
    return existing.trim();
  }
  return randomUUID();
}

export function structuredLog(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}
