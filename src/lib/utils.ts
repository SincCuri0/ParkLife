import { Pin, PinStatus } from "./types";

const statusPriority: Record<PinStatus, number> = {
  active: 0,
  pending: 1,
  completed: 2,
  resolved: 3,
  rejected: 4,
};

export function sortHostPins(pins: Pin[]) {
  return [...pins]
    .filter((pin) => pin.status !== "rejected")
    .sort((a, b) => {
      const statusCompare = statusPriority[a.status] - statusPriority[b.status];
      if (statusCompare !== 0) {
        return statusCompare;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function relativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
