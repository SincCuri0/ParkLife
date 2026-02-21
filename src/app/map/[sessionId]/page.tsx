import { createAnonServerClient } from "@/lib/supabase/server";
import AudienceMapClient from "./AudienceMapClient";

export const dynamic = "force-dynamic";

export default async function AudienceMapPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = createAnonServerClient();

  const [{ data: session }, { data: pins }] = await Promise.all([
    supabase.from("sessions").select("id, name").eq("id", sessionId).single(),
    supabase
      .from("pins")
      .select("*")
      .eq("session_id", sessionId)
      .neq("status", "rejected")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AudienceMapClient
      sessionId={sessionId}
      sessionName={session?.name ?? `Session ${sessionId}`}
      initialPins={pins ?? []}
    />
  );
}
