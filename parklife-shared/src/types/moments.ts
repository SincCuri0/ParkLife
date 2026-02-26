export type MomentType =
  | "first_node_lit"
  | "first_help_completed"
  | "first_event_attended"
  | "first_group_joined"
  | "first_lamp_shared"
  | "first_thanks_received"
  | "group_ten_members"
  | "relay_first_night";

export interface Moment {
  id: string;
  momentType: MomentType;
  earnedAt: string;
  metadata?: Record<string, unknown>;
}
