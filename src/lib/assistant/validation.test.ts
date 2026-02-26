import { describe, expect, it } from "vitest";
import {
  parseAssistantActionPayload,
  parseAssistantActionPreview,
} from "./validation";

describe("assistant action validation", () => {
  it("parses send_message payloads", () => {
    const parsed = parseAssistantActionPayload("send_message", {
      conversation_id: "hackney-cycling",
      content: "Route map updated for Sunday.",
    });

    expect(parsed).toEqual({
      type: "send_message",
      payload: {
        conversation_id: "hackney-cycling",
        content: "Route map updated for Sunday.",
      },
    });
  });

  it("parses create_event payload and normalizes date", () => {
    const parsed = parseAssistantActionPreview({
      type: "create_event",
      payload: {
        title: "Evening Run",
        latitude: 51.5074,
        longitude: -0.1278,
        when: "2026-03-01 18:30:00Z",
      },
    });

    expect(parsed?.type).toBe("create_event");
    expect(parsed && parsed.type === "create_event" ? parsed.payload.event_date : null)
      .toBe("2026-03-01T18:30:00.000Z");
  });

  it("rejects invalid geo payloads", () => {
    const parsed = parseAssistantActionPreview({
      type: "create_pin",
      payload: {
        description: "Need a hand moving a sofa",
        latitude: 190,
        longitude: -0.12,
      },
    });

    expect(parsed).toBeNull();
  });
});

