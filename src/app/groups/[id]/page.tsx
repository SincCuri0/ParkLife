import GroupDetailClient from "./GroupDetailClient";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { Group, Pin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const service = createServiceClient();
  const [{ data: group }, { data: memberRows }, { data: rawPins }] = await Promise.all([
    service
      .from("groups")
      .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
      .eq("id", id)
      .maybeSingle(),
    service.from("group_members").select("user_id, role").eq("group_id", id),
    service
      .from("pins")
      .select("*")
      .eq("group_id", id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!group) {
    return <main className="mx-auto max-w-xl p-6">Group not found.</main>;
  }

  const userIds = Array.from(new Set(((rawPins || []) as Pin[]).map((pin) => pin.posted_by).filter(Boolean))) as string[];
  const profileById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await service.from("profiles").select("id, display_name").in("id", userIds);
    for (const profile of profiles || []) {
      profileById.set(profile.id, profile.display_name);
    }
  }

  const recentPins = ((rawPins || []) as Pin[]).map((pin) => ({
    ...pin,
    profile_display_name: pin.posted_by ? profileById.get(pin.posted_by) || null : null,
  }));

  const myMembership = (memberRows || []).find((row) => row.user_id === user?.id);
  const isMember = Boolean(myMembership);
  const isAdmin = myMembership?.role === "admin";
  return (
    <GroupDetailClient
      group={group as Group}
      memberCount={(memberRows || []).length}
      isMember={isMember}
      isAdmin={Boolean(isAdmin)}
      currentUserId={user?.id || null}
      isAuthenticated={Boolean(user)}
      recentPins={recentPins}
    />
  );
}
