import { Notification } from "@/lib/types";

export interface NotificationsSnapshot {
  notifications: Notification[];
  unread_count: number;
}

const CACHE_TTL_MS = 15_000;
let cachedSnapshot: NotificationsSnapshot | null = null;
let cachedAtMs = 0;
let inFlightRequest: Promise<NotificationsSnapshot> | null = null;

function normalizeSnapshot(payload: unknown): NotificationsSnapshot {
  const data = payload as Partial<NotificationsSnapshot> | null;
  return {
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
    unread_count: Number(data?.unread_count || 0),
  };
}

export async function fetchNotificationsSnapshot(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const now = Date.now();

  if (!force && cachedSnapshot && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  if (!force && inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = (async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) {
      throw new Error("Could not load notifications");
    }
    const payload = await response.json();
    const snapshot = normalizeSnapshot(payload);
    cachedSnapshot = snapshot;
    cachedAtMs = Date.now();
    return snapshot;
  })();

  try {
    return await inFlightRequest;
  } finally {
    inFlightRequest = null;
  }
}

export function setNotificationsSnapshot(snapshot: NotificationsSnapshot) {
  cachedSnapshot = snapshot;
  cachedAtMs = Date.now();
}

export function clearNotificationsSnapshot() {
  cachedSnapshot = null;
  cachedAtMs = 0;
}
