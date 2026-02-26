import { AssistantActionPreview } from "@/lib/assistant/types";
import { buildAssistantContext } from "@/lib/assistant/context-builder";

type WebAssistantResponse =
  | { type: "conversational"; content: string }
  | { type: "action"; action: AssistantActionPreview };

export async function runWebAssistant(userId: string, input: string): Promise<WebAssistantResponse> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: "conversational", content: "Say what you want to do, and I can prepare an action preview." };
  }

  // Context is opt-in filtered by buildAssistantContext before any model call.
  const context = await buildAssistantContext(userId);

  // Placeholder intent parsing. Production implementation should call a model/tool router.
  if (trimmed.toLowerCase().startsWith("join group ")) {
    const groupId = trimmed.slice("join group ".length).trim();
    return {
      type: "action",
      action: { type: "join_group", payload: { group_id: groupId } },
    };
  }

  return {
    type: "conversational",
    content: context.location
      ? "I can help with that. If this is a write action, I will ask for confirmation before committing."
      : "I can help with that. Share location with AI if you want location-aware results.",
  };
}
