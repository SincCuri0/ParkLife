import { createServiceClient } from "@/lib/supabase/server";
import { Pin } from "@/lib/types";
import VicariousSessionClient from "./VicariousSessionClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VicariousSessionPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;
  const service = createServiceClient();

  const { data: session } = await service
    .from("vicarious_sessions")
    .select("id, created_at, group_id, started_by, is_active, ended_at, session_code")
    .eq("session_code", sessionCode.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
        <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold">No active session found</h1>
          <Link href="/vicarious" className="mt-3 inline-block text-blue-300 underline">
            Back to Vicarious
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: group }, { data: pins }] = await Promise.all([
    service
      .from("groups")
      .select("id, name, invite_code, colour")
      .eq("id", session.group_id)
      .maybeSingle(),
    service
      .from("pins")
      .select("*")
      .eq("vicarious_session_id", session.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false }),
  ]);

  if (!group) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
        <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold">No active session found</h1>
          <Link href="/vicarious" className="mt-3 inline-block text-blue-300 underline">
            Back to Vicarious
          </Link>
        </div>
      </main>
    );
  }

  return (
    <VicariousSessionClient
      session={session}
      group={{ id: group.id, name: group.name, inviteCode: group.invite_code }}
      initialPins={(pins || []) as Pin[]}
    />
  );
}
