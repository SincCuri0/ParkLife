import GroupsPageClient from "./GroupsPageClient";
import { createAnonServerClient, createServerClient, createServiceClient } from "@/lib/supabase/server";
import { Group } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const authClient = await createServerClient();
  const anon = createAnonServerClient();
  const groupCounts = new Map<string, number>();
  const service = createServiceClient();
  const [{ data: groups }, { data: members }, {
    data: { user },
  }] = await Promise.all([
    anon
      .from("groups")
      .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(80),
    service.from("group_members").select("group_id"),
    authClient.auth.getUser(),
  ]);

  for (const member of members || []) {
    groupCounts.set(member.group_id, (groupCounts.get(member.group_id) || 0) + 1);
  }

  let myGroupIds: string[] = [];
  if (user) {
    const { data: memberships } = await service.from("group_members").select("group_id").eq("user_id", user.id);
    myGroupIds = (memberships || []).map((item) => item.group_id);
  }

  const resolvedGroups = ((groups || []) as Group[]).map((group) => ({
    ...group,
    member_count: groupCounts.get(group.id) || group.member_count || 0,
  }));

  return <GroupsPageClient initialGroups={resolvedGroups} myGroupIds={myGroupIds} />;
}
