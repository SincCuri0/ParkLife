import { notFound, redirect } from "next/navigation";
import { PIN_CATEGORY_ICONS } from "@/lib/constants";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { Pin } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export default async function ProfilePage({
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
  const { data: profile } = await service
    .from("profiles")
    .select("id, created_at, display_name, avatar_colour, bio, profile_visibility, show_pin_history")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    if (user?.id === id) {
      redirect("/profile/setup");
    }
    notFound();
  }

  const isOwner = user?.id === id;
  if (profile.profile_visibility === "members" && !isOwner) {
    if (!user) {
      notFound();
    }

    const [{ data: theirGroups }, { data: myGroups }] = await Promise.all([
      service.from("group_members").select("group_id").eq("user_id", id),
      service.from("group_members").select("group_id").eq("user_id", user.id),
    ]);

    const myGroupIds = new Set((myGroups || []).map((row) => row.group_id));
    const shared = (theirGroups || []).some((row) => myGroupIds.has(row.group_id));
    if (!shared) {
      notFound();
    }
  }

  const { data: pins } = await service
    .from("pins")
    .select("*")
    .eq("posted_by", id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(20);

  const groupIds = Array.from(new Set(((pins || []) as Pin[]).map((pin) => pin.group_id).filter(Boolean))) as string[];
  let publicGroupIds = new Set<string>();
  if (groupIds.length > 0) {
    const { data: groups } = await service.from("groups").select("id").in("id", groupIds).eq("is_public", true);
    publicGroupIds = new Set((groups || []).map((group) => group.id));
  }

  const publicPins = profile.show_pin_history || isOwner
    ? ((pins || []) as Pin[]).filter((pin) => (pin.group_id ? publicGroupIds.has(pin.group_id) : false))
    : [];

  return (
    <main className="mx-auto max-w-2xl p-4">
      <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: profile.avatar_colour }}
          >
            {initials(profile.display_name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{profile.display_name}</h1>
            <p className="text-xs text-slate-400">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        {profile.bio ? <p className="text-sm text-slate-200">{profile.bio}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-semibold">Public pins</h2>
        <div className="space-y-2">
          {publicPins.length === 0 ? <p className="text-sm text-slate-400">No public pins yet.</p> : null}
          {publicPins.map((pin) => (
            <article key={pin.id} className="rounded border border-slate-700 bg-slate-800 p-3">
              <p className="font-semibold">{pin.title || pin.description || "Untitled pin"}</p>
              <p className="text-sm text-slate-300">
                {pin.category ? `${PIN_CATEGORY_ICONS[pin.category]} ` : ""}
                {pin.category || "general"} • {relativeTime(pin.created_at)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
