import { createServiceClient } from "@/lib/supabase/server";
import { Group, Pin } from "@/lib/types";
import VicariousHostClient from "./VicariousHostClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VicariousHostPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const service = createServiceClient();

  const [{ data: group }, { data: session }] = await Promise.all([
    service
      .from("groups")
      .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
      .eq("id", groupId)
      .maybeSingle(),
    service
      .from("vicarious_sessions")
      .select("id, created_at, group_id, started_by, is_active, ended_at, session_code")
      .eq("group_id", groupId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!group || !session) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-2xl font-semibold">No active host session</h1>
        <Link href="/vicarious" className="mt-3 inline-block text-blue-300 underline">
          Back to Vicarious
        </Link>
      </main>
    );
  }

  const { data: pins } = await service
    .from("pins")
    .select("*")
    .eq("vicarious_session_id", session.id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false });

  return <VicariousHostClient group={group as Group} session={session} initialPins={(pins || []) as Pin[]} />;
}
