import { randomUUID } from "crypto";
import { customAlphabet } from "nanoid";
import { GROUP_COLOURS } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { AssistantActionPreview } from "@/lib/assistant/types";

const makeInviteCode = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function getActionSummary(action: AssistantActionPreview) {
  switch (action.type) {
    case "create_pin":
      return `Create a pin at ${formatCoordinates(action.payload.latitude, action.payload.longitude)}.`;
    case "create_event":
      return `Create event "${action.payload.title}" at ${formatCoordinates(action.payload.latitude, action.payload.longitude)}.`;
    case "join_group":
      return `Join group ${action.payload.group_id}.`;
    case "create_group":
      return `Create group "${action.payload.name}" in ${action.payload.location_label}.`;
    case "send_message":
      return `Send a message in conversation ${action.payload.conversation_id}.`;
    default:
      return "Execute assistant action.";
  }
}

export function getAffectedEntities(action: AssistantActionPreview) {
  switch (action.type) {
    case "create_pin":
    case "create_event":
      return ["pins"];
    case "join_group":
      return ["group_members"];
    case "create_group":
      return ["groups", "group_members"];
    case "send_message":
      return ["messages"];
    default:
      return [];
  }
}

async function assertGroupMembership(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  groupId: string,
) {
  const { data: membership } = await service
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    throw new Error("You must be a group member to post in that group");
  }
}

export async function executeAssistantAction(userId: string, action: AssistantActionPreview) {
  const service = createServiceClient();

  switch (action.type) {
    case "create_pin": {
      const payload = action.payload;
      if (payload.group_id) {
        await assertGroupMembership(service, userId, payload.group_id);
      }

      const { data, error } = await service
        .from("pins")
        .insert({
          title: payload.title || null,
          description: payload.description,
          latitude: payload.latitude,
          longitude: payload.longitude,
          group_id: payload.group_id || null,
          posted_by: userId,
          author_name: "Member",
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !data) throw new Error(error?.message || "Could not create pin");
      return { entityId: data.id, redirectUrl: `/map?pin=${data.id}` };
    }
    case "create_event": {
      const payload = action.payload;
      if (payload.group_id) {
        await assertGroupMembership(service, userId, payload.group_id);
      }

      const { data, error } = await service
        .from("pins")
        .insert({
          title: payload.title,
          description: payload.description || null,
          latitude: payload.latitude,
          longitude: payload.longitude,
          group_id: payload.group_id || null,
          posted_by: userId,
          author_name: "Member",
          category: "event",
          status: "pending",
          expires_at: payload.event_date
            ? new Date(new Date(payload.event_date).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : null,
        })
        .select("id")
        .single();

      if (error || !data) throw new Error(error?.message || "Could not create event");
      return { entityId: data.id, redirectUrl: `/map?pin=${data.id}` };
    }
    case "join_group": {
      const payload = action.payload;
      const { data: group } = await service
        .from("groups")
        .select("id, requires_approval")
        .eq("id", payload.group_id)
        .maybeSingle();
      if (!group) throw new Error("Group not found");

      if (group.requires_approval) {
        const { error } = await service.from("join_requests").upsert(
          { group_id: payload.group_id, user_id: userId, status: "pending" },
          { onConflict: "group_id,user_id" },
        );
        if (error) throw new Error(error.message);
        return { entityId: payload.group_id, redirectUrl: `/groups/${payload.group_id}` };
      }

      const { error } = await service.from("group_members").insert({
        group_id: payload.group_id,
        user_id: userId,
        role: "member",
      });
      if (error && !error.message.includes("duplicate")) {
        throw new Error(error.message);
      }
      return { entityId: payload.group_id, redirectUrl: `/groups/${payload.group_id}` };
    }
    case "create_group": {
      const payload = action.payload;
      const { count } = await service.from("groups").select("*", { count: "exact", head: true });
      const colour = GROUP_COLOURS[(count || 0) % GROUP_COLOURS.length];

      const { data: group, error } = await service
        .from("groups")
        .insert({
          name: payload.name,
          description: payload.description || null,
          location_label: payload.location_label,
          latitude: payload.is_virtual ? null : payload.latitude || null,
          longitude: payload.is_virtual ? null : payload.longitude || null,
          colour,
          invite_code: makeInviteCode(),
          is_public: payload.is_public !== false,
          is_virtual: Boolean(payload.is_virtual),
          requires_approval: Boolean(payload.requires_approval),
          created_by: userId,
        })
        .select("id")
        .single();

      if (error || !group) throw new Error(error?.message || "Could not create group");

      const { error: membershipError } = await service.from("group_members").insert({
        group_id: group.id,
        user_id: userId,
        role: "admin",
      });
      if (membershipError) throw new Error(membershipError.message);

      return { entityId: group.id, redirectUrl: `/groups/${group.id}` };
    }
    case "send_message": {
      const payload = action.payload;
      const { data, error } = await service
        .from("messages")
        .insert({
          id: randomUUID(),
          conversation_id: payload.conversation_id,
          sender_id: userId,
          content: payload.content,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "42P01") {
          throw new Error("Messages table is not available. Run migrations/20260222_messages.sql");
        }
        throw new Error(error.message);
      }

      if (!data?.id) {
        throw new Error("Could not persist message");
      }

      return { entityId: data.id, redirectUrl: "/map" };
    }
    default:
      throw new Error("Unsupported assistant action");
  }
}
