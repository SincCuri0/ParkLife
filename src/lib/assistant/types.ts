import type {
  AssistantActionCommit as SharedAssistantActionCommit,
  AssistantActionPreview as SharedAssistantActionPreview,
  CreateEventPayload as SharedCreateEventPayload,
  CreateGroupPayload as SharedCreateGroupPayload,
  CreatePinPayload as SharedCreatePinPayload,
  JoinGroupPayload as SharedJoinGroupPayload,
  SendMessagePayload as SharedSendMessagePayload,
} from "../../../parklife-shared/src/types/assistant";

export type CreatePinPayload = SharedCreatePinPayload;
export type CreateEventPayload = SharedCreateEventPayload;
export type SendMessagePayload = SharedSendMessagePayload;
export type JoinGroupPayload = SharedJoinGroupPayload;
export type CreateGroupPayload = SharedCreateGroupPayload;
export type AssistantActionPreview = SharedAssistantActionPreview;

export const ASSISTANT_ACTION_TYPES = [
  "create_pin",
  "create_event",
  "send_message",
  "join_group",
  "create_group",
] as const;

export function isAssistantActionType(value: unknown): value is AssistantActionPreview["type"] {
  return typeof value === "string" && ASSISTANT_ACTION_TYPES.includes(value as (typeof ASSISTANT_ACTION_TYPES)[number]);
}

export type AssistantActionCommit = SharedAssistantActionCommit;
