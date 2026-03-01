import MapClient from "./MapClient";
import { featureFlags } from "@/lib/env";
import { createAnonServerClient, createServerClient, createServiceClient } from "@/lib/supabase/server";
import { Group, Pin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const anon = createAnonServerClient();
    const { data: groups } = await anon
      .from("groups")
      .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
      .order("created_at", { ascending: false })
      .limit(50);

    const resolvedGroups = ((groups as Group[]) || []).map((group) => ({ ...group, is_member: false }));
    return <MapClient pins={[]} groups={resolvedGroups} localFirstEnabled={featureFlags.localFirstEnabled} />;
  }

  const service = createServiceClient();
  const membershipsPromise = service
    .from("group_members")
    .select("group_id, role")
    .eq("user_id", user.id);
  const groupsPromise = service
    .from("groups")
    .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
    .order("created_at", { ascending: false })
    .limit(120);
  const publicPinsPromise = service
    .from("pins")
    .select("*")
    .is("group_id", null)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: memberships } = await membershipsPromise;
  const groupIds = (memberships || []).map((membership) => membership.group_id).filter(Boolean);
  const adminGroupIds = (memberships || [])
    .filter((membership) => membership.role === "admin")
    .map((membership) => membership.group_id);
  const enabledVicariousAdminGroupIdsPromise = adminGroupIds.length > 0
    ? service
        .from("group_plugins")
        .select("group_id")
        .in("group_id", adminGroupIds)
        .eq("plugin_key", "vicarious")
        .eq("is_installed", true)
        .eq("is_enabled", true)
    : Promise.resolve({ data: [] as Array<{ group_id: string }> | null });

  const groupPinsPromise = groupIds.length > 0
    ? service
        .from("pins")
        .select("*")
        .in("group_id", groupIds)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] as Pin[] | null });

  const [{ data: groups }, { data: rawGroupPins }, { data: rawPublicPins }, { data: pluginRows }] = await Promise.all([
    groupsPromise,
    groupPinsPromise,
    publicPinsPromise,
    enabledVicariousAdminGroupIdsPromise,
  ]);
  const enabledVicariousAdminGroupIds = (pluginRows || []).map((row) => row.group_id);
  const groupIdSet = new Set(groupIds);

  const groupsWithMembership = ((groups as Group[]) || []).map((group) => ({
    ...group,
    is_member: groupIdSet.has(group.id),
  }));

  const combinedPins = [...((rawGroupPins || []) as Pin[]), ...((rawPublicPins || []) as Pin[])];
  const seen = new Set<string>();
  const pins = combinedPins
    .filter((pin) => {
      if (seen.has(pin.id)) return false;
      seen.add(pin.id);
      return true;
    })
    .map((pin) => {
      const group = (groupsWithMembership || []).find((entry) => entry.id === pin.group_id);
      return {
        ...pin,
        group_name: group?.name || null,
        group_colour: group?.colour || null,
      };
    });

  return (
    <MapClient
      pins={pins}
      groups={groupsWithMembership}
      currentUserId={user.id}
      adminGroupIds={enabledVicariousAdminGroupIds}
      localFirstEnabled={featureFlags.localFirstEnabled}
    />
  );
}
