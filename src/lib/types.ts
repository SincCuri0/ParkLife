export type PinStatus = "pending" | "active" | "completed" | "rejected" | "resolved";
export type PinCategory = "event" | "help" | "item" | "announcement" | "hangout";
export type NotificationType =
  | "comment_on_pin"
  | "reply_to_comment"
  | "co_comment"
  | "new_group_pin"
  | "group_join"
  | "pin_activated";

export interface Pin {
  id: string;
  created_at: string;
  updated_at?: string;
  author_name: string;
  description: string | null;
  title: string | null;
  latitude: number;
  longitude: number;
  status: PinStatus;
  session_id: string | null;
  group_id: string | null;
  vicarious_session_id?: string | null;
  guest_name?: string | null;
  category: PinCategory | null;
  expires_at: string | null;
  posted_by: string | null;
  is_resolved: boolean;
  group_name?: string | null;
  group_colour?: string | null;
  profile_display_name?: string | null;
}

export interface Session {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  host_password_hash: string;
}

export interface Profile {
  id: string;
  created_at: string;
  display_name: string;
  avatar_colour: string;
  bio: string | null;
  profile_visibility?: "public" | "members";
  show_pin_history?: boolean;
  location_precision?: "neighbourhood" | "suburb" | "city";
  notification_prefs?: NotificationPrefs;
  lamp_visibility_enabled?: boolean;
  ai_data_sharing?: AiDataSharingPrefs;
}

export interface Group {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  colour: string;
  invite_code: string;
  is_public: boolean;
  is_virtual: boolean;
  requires_approval: boolean;
  created_by: string;
  is_member?: boolean;
  member_count?: number;
  pin_count?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface Reaction {
  id: string;
  pin_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Comment {
  id: string;
  created_at: string;
  pin_id: string;
  author_id: string | null;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  author?: Profile | null;
}

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  pin_id: string | null;
  comment_id: string | null;
  group_id: string | null;
  is_read: boolean;
  actor?: Profile | null;
  pin?: Pin | null;
  group?: Group | null;
}

export interface JoinRequest {
  id: string;
  created_at: string;
  group_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  profile?: Profile | null;
}

export interface Report {
  id: string;
  created_at: string;
  reporter_id: string | null;
  pin_id: string | null;
  comment_id: string | null;
  category: "spam" | "offensive" | "misinformation" | "dangerous";
  status: "open" | "resolved" | "dismissed";
}

export interface NotificationPrefs {
  comment_on_pin: { inapp: boolean; push: boolean };
  reply_to_comment: { inapp: boolean; push: boolean };
  co_comment: { inapp: boolean; push: boolean };
  new_group_pin: { inapp: boolean; push: boolean };
  group_join: { inapp: boolean; push: boolean };
  pin_activated: { inapp: boolean; push: boolean };
}

export interface AiDataSharingPrefs {
  location: boolean;
  group_memberships: boolean;
  pin_history: boolean;
  activity_patterns: boolean;
  calendar: boolean;
}
