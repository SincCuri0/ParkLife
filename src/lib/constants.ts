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
  resolved: "#64748B",
};

export const GROUP_COLOURS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
  "#10B981",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
] as const;

export const PIN_EXPIRY_DAYS: Record<string, number | null> = {
  event: null,
  help: 7,
  item: 30,
  announcement: 14,
  hangout: 14,
};

export const PIN_CATEGORY_LABELS: Record<string, string> = {
  event: "Event",
  help: "Help request",
  item: "Item for sale",
  announcement: "Announcement",
  hangout: "Hangout",
};

export const PIN_CATEGORY_ICONS: Record<string, string> = {
  event: "📅",
  help: "🙋",
  item: "🏷️",
  announcement: "📢",
  hangout: "👋",
};

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🙌", "🔥"] as const;

export const COMMENT_MAX_LENGTH = 500;

export const LOCATION_FUZZ_METRES: Record<string, number> = {
  neighbourhood: 100,
  suburb: 500,
  city: 2000,
};

export const REPORT_CATEGORIES = [
  { value: "spam", label: "Spam" },
  { value: "offensive", label: "Offensive content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "dangerous", label: "Dangerous" },
] as const;

export const NOTIFICATION_LABELS: Record<string, string> = {
  comment_on_pin: "Comments on your pins",
  reply_to_comment: "Replies to your comments",
  co_comment: "Activity on pins you've commented on",
  new_group_pin: "New pins in your groups",
  group_join: "New members in your groups",
  pin_activated: "Your pin is activated (live sessions)",
};
