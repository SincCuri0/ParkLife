import {
  AssistantActionPreview,
  isAssistantActionType,
} from "@/lib/assistant/types";

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PIN_DESCRIPTION_LENGTH = 280;
const MAX_GROUP_DESCRIPTION_LENGTH = 280;
const MAX_GROUP_NAME_LENGTH = 80;
const MAX_LOCATION_LABEL_LENGTH = 120;
const MAX_IDENTIFIER_LENGTH = 120;

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function readRequiredString(
  value: unknown,
  maxLength: number,
  minLength = 1,
) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;
  return trimmed;
}

function readOptionalString(value: unknown, maxLength: number) {
  if (typeof value === "undefined" || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

function readBoolean(value: unknown) {
  if (typeof value !== "boolean") return undefined;
  return value;
}

function readLatitude(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < -90 || value > 90) return null;
  return value;
}

function readLongitude(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < -180 || value > 180) return null;
  return value;
}

function readOptionalIsoDate(value: unknown) {
  if (typeof value === "undefined" || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function parseCreatePinPayload(payload: unknown): AssistantActionPreview | null {
  if (!isObject(payload)) return null;

  const description = readRequiredString(
    firstDefined(payload, ["description", "details"]),
    MAX_PIN_DESCRIPTION_LENGTH,
  );
  const latitude = readLatitude(firstDefined(payload, ["latitude"]));
  const longitude = readLongitude(firstDefined(payload, ["longitude"]));

  if (!description || latitude === null || longitude === null) {
    return null;
  }

  const title = readOptionalString(firstDefined(payload, ["title"]), MAX_TITLE_LENGTH);
  const groupId = readOptionalString(
    firstDefined(payload, ["group_id", "groupId"]),
    MAX_IDENTIFIER_LENGTH,
  );
  if (title === null || groupId === null) {
    return null;
  }

  return {
    type: "create_pin",
    payload: {
      title: title ?? null,
      description,
      latitude,
      longitude,
      group_id: groupId ?? null,
    },
  };
}

function parseCreateEventPayload(payload: unknown): AssistantActionPreview | null {
  if (!isObject(payload)) return null;

  const title = readRequiredString(
    firstDefined(payload, ["title"]),
    MAX_TITLE_LENGTH,
  );
  const latitude = readLatitude(firstDefined(payload, ["latitude"]));
  const longitude = readLongitude(firstDefined(payload, ["longitude"]));
  if (!title || latitude === null || longitude === null) {
    return null;
  }

  const description = readOptionalString(
    firstDefined(payload, ["description"]),
    MAX_PIN_DESCRIPTION_LENGTH,
  );
  const groupId = readOptionalString(
    firstDefined(payload, ["group_id", "groupId"]),
    MAX_IDENTIFIER_LENGTH,
  );
  const eventDate = readOptionalIsoDate(
    firstDefined(payload, ["event_date", "eventDate", "when"]),
  );
  if (description === null || groupId === null || eventDate === null) {
    return null;
  }

  return {
    type: "create_event",
    payload: {
      title,
      description: description ?? null,
      latitude,
      longitude,
      group_id: groupId ?? null,
      event_date: eventDate ?? null,
    },
  };
}

function parseSendMessagePayload(payload: unknown): AssistantActionPreview | null {
  if (!isObject(payload)) return null;

  const conversationId = readRequiredString(
    firstDefined(payload, ["conversation_id", "conversationId"]),
    MAX_IDENTIFIER_LENGTH,
  );
  const content = readRequiredString(
    firstDefined(payload, ["content"]),
    MAX_MESSAGE_LENGTH,
  );
  if (!conversationId || !content) {
    return null;
  }

  return {
    type: "send_message",
    payload: {
      conversation_id: conversationId,
      content,
    },
  };
}

function parseJoinGroupPayload(payload: unknown): AssistantActionPreview | null {
  if (!isObject(payload)) return null;
  const groupId = readRequiredString(
    firstDefined(payload, ["group_id", "groupId"]),
    MAX_IDENTIFIER_LENGTH,
  );
  if (!groupId) return null;

  return {
    type: "join_group",
    payload: {
      group_id: groupId,
    },
  };
}

function parseCreateGroupPayload(payload: unknown): AssistantActionPreview | null {
  if (!isObject(payload)) return null;
  const name = readRequiredString(
    firstDefined(payload, ["name", "groupName"]),
    MAX_GROUP_NAME_LENGTH,
    2,
  );
  const locationLabelValue = readOptionalString(
    firstDefined(payload, ["location_label", "locationLabel", "where"]),
    MAX_LOCATION_LABEL_LENGTH,
  );
  if (!name || locationLabelValue === null) return null;
  const locationLabel = locationLabelValue || "Virtual";

  const description = readOptionalString(
    firstDefined(payload, ["description"]),
    MAX_GROUP_DESCRIPTION_LENGTH,
  );
  const isPublic = readBoolean(firstDefined(payload, ["is_public", "isPublic"]));
  const isVirtual = readBoolean(firstDefined(payload, ["is_virtual", "isVirtual"]));
  const requiresApproval = readBoolean(
    firstDefined(payload, ["requires_approval", "requiresApproval"]),
  );

  const latitudeValue = firstDefined(payload, ["latitude"]);
  const longitudeValue = firstDefined(payload, ["longitude"]);
  const latitude = typeof latitudeValue === "undefined" || latitudeValue === null
    ? undefined
    : readLatitude(latitudeValue);
  const longitude = typeof longitudeValue === "undefined" || longitudeValue === null
    ? undefined
    : readLongitude(longitudeValue);

  if (
    description === null
    || latitude === null
    || longitude === null
  ) {
    return null;
  }

  return {
    type: "create_group",
    payload: {
      name,
      description: description ?? null,
      location_label: locationLabel,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      is_public: isPublic,
      is_virtual: isVirtual,
      requires_approval: requiresApproval,
    },
  };
}

export function parseAssistantActionPreview(input: unknown): AssistantActionPreview | null {
  if (!isObject(input)) return null;

  const type = input.type;
  if (!isAssistantActionType(type)) return null;

  const payload = input.payload;
  switch (type) {
    case "create_pin":
      return parseCreatePinPayload(payload);
    case "create_event":
      return parseCreateEventPayload(payload);
    case "send_message":
      return parseSendMessagePayload(payload);
    case "join_group":
      return parseJoinGroupPayload(payload);
    case "create_group":
      return parseCreateGroupPayload(payload);
    default:
      return null;
  }
}

export function parseAssistantActionPayload(
  actionType: unknown,
  payload: unknown,
): AssistantActionPreview | null {
  if (!isAssistantActionType(actionType)) return null;
  return parseAssistantActionPreview({ type: actionType, payload });
}
