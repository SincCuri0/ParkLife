export interface VicariousSession {
  id: string;
  created_at: string;
  group_id: string;
  started_by: string | null;
  is_active: boolean;
  ended_at: string | null;
  session_code: string;
}

export interface GuestPin {
  guest_name: string;
  latitude: number;
  longitude: number;
  description: string;
  vicarious_session_id: string;
}
