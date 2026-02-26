export interface CreatePinPayload {
  title?: string | null;
  description: string;
  latitude: number;
  longitude: number;
  group_id?: string | null;
}

export interface CreateEventPayload {
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  group_id?: string | null;
  event_date?: string | null;
}

export interface SendMessagePayload {
  conversation_id: string;
  content: string;
}

export interface JoinGroupPayload {
  group_id: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string | null;
  location_label: string;
  latitude?: number | null;
  longitude?: number | null;
  is_public?: boolean;
  is_virtual?: boolean;
  requires_approval?: boolean;
}

export type AssistantActionPreview =
  | { type: "create_pin"; payload: CreatePinPayload }
  | { type: "create_event"; payload: CreateEventPayload }
  | { type: "send_message"; payload: SendMessagePayload }
  | { type: "join_group"; payload: JoinGroupPayload }
  | { type: "create_group"; payload: CreateGroupPayload };

export interface AssistantActionCommit {
  confirmation_token: string;
  action_type: AssistantActionPreview["type"];
}
