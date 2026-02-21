import { redirect } from "next/navigation";
import { isHostAuthenticated } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import HostMapClient from "./HostMapClient";

export const dynamic = "force-dynamic";

export default async function HostMapPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const authenticated = await isHostAuthenticated();
  if (!authenticated) {
    redirect("/host");
  }

  const { sessionId } = await params;
  const supabase = createServiceClient();

  const [{ data: session }, { data: pins }] = await Promise.all([
    supabase.from("sessions").select("id, name").eq("id", sessionId).single(),
    supabase.from("pins").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
  ]);

  return (
    <HostMapClient
      sessionId={sessionId}
      sessionName={session?.name ?? `Host Session ${sessionId}`}
      initialPins={pins ?? []}
    />
  );
}
