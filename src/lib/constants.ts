import { PinStatus } from "./types";

export const MAP_DEFAULT_CENTER = {
  longitude: 144.9631,
  latitude: -37.8136,
  zoom: 12,
};

export const PIN_COLOURS: Record<PinStatus, string> = {
  pending: "#3B82F6",
  active: "#F97316",
  completed: "#22C55E",
  rejected: "transparent",
};
