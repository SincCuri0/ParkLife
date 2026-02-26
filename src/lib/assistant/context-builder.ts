import { createServiceClient } from "@/lib/supabase/server";

export interface AssistantContext {
  location: { latitude: number; longitude: number } | null;
  groups: Array<{ id: string; name: string }>;
  pinHistory: Array<{ id: string; title: string | null; created_at: string }>;
  activityPatterns: { pins_last_30_days: number; comments_last_30_days: number } | null;
  calendar: Array<{ id: string; title: string; starts_at: string }>;
}

const DEFAULT_AI_DATA_SHARING = {
  location: false,
  group_memberships: false,
  pin_history: false,
  activity_patterns: false,
  calendar: false,
};

type AiDataSharing = typeof DEFAULT_AI_DATA_SHARING;

async function getAiDataSharing(userId: string): Promise<AiDataSharing> {
  const service = createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("ai_data_sharing")
    .eq("id", userId)
    .maybeSingle();

  const incoming = (data?.ai_data_sharing || {}) as Partial<AiDataSharing>;
  return {
    ...DEFAULT_AI_DATA_SHARING,
    ...incoming,
  };
}

export async function buildAssistantContext(userId: string): Promise<AssistantContext> {
  const sharing = await getAiDataSharing(userId);
  const service = createServiceClient();

  const [locationRow, groupsRows, pinRows, pinCountRow, commentCountRow] = await Promise.all([
    sharing.location
      ? service
          .from("lamp_presence")
          .select("latitude, longitude, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sharing.group_memberships
      ? service
          .from("group_members")
          .select("group:groups(id, name)")
          .eq("user_id", userId)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    sharing.pin_history
      ? service
          .from("pins")
          .select("id, title, created_at")
          .eq("posted_by", userId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    sharing.activity_patterns
      ? service
          .from("pins")
          .select("id", { count: "exact", head: true })
          .eq("posted_by", userId)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ count: null, data: null, error: null }),
    sharing.activity_patterns
      ? service
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ count: null, data: null, error: null }),
  ]);

  const groups = (groupsRows.data || [])
    .flatMap((row) => {
      const groupValue = (row as { group?: unknown }).group;
      if (Array.isArray(groupValue)) {
        return groupValue;
      }
      if (groupValue && typeof groupValue === "object") {
        return [groupValue];
      }
      return [];
    })
    .filter((group): group is { id: string; name: string } => (
      Boolean(group)
      && typeof (group as { id?: unknown }).id === "string"
      && typeof (group as { name?: unknown }).name === "string"
    ));

  return {
    location: sharing.location && locationRow.data
      ? {
          latitude: Number(locationRow.data.latitude),
          longitude: Number(locationRow.data.longitude),
        }
      : null,
    groups,
    pinHistory: sharing.pin_history ? ((pinRows.data || []) as AssistantContext["pinHistory"]) : [],
    activityPatterns: sharing.activity_patterns
      ? {
          pins_last_30_days: pinCountRow.count || 0,
          comments_last_30_days: commentCountRow.count || 0,
        }
      : null,
    calendar: sharing.calendar ? [] : [],
  };
}
