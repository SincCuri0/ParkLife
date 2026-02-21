export type PinStatus = "pending" | "active" | "completed" | "rejected";

export interface Pin {
  id: string;
  created_at: string;
  author_name: string;
  description: string;
  latitude: number;
  longitude: number;
  status: PinStatus;
  session_id: string;
}

export interface Session {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  host_password_hash: string;
}
