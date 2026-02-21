"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface InviteGroup {
  id: string;
  name: string;
  description: string | null;
  colour: string;
  member_count: number;
  location_label: string;
  requires_approval: boolean;
}

export default function JoinInvitePage() {
  const router = useRouter();
  const params = useParams<{ inviteCode: string }>();
  const [group, setGroup] = useState<InviteGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const run = async () => {
      const code = params.inviteCode;
      const response = await fetch(`/api/groups/invite/${code}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Invite not found");
        setLoading(false);
        return;
      }
      setGroup(data as InviteGroup);
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      setAuthed(Boolean(userData.user));
      setLoading(false);
    };
    void run();
  }, [params.inviteCode]);

  const join = async () => {
    if (!group) return;
    const response = await fetch(`/api/groups/${group.id}/join`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not join");
      return;
    }
    if (data.pending) {
      setPending(true);
      return;
    }
    router.push("/map");
  };

  if (loading) {
    return <main className="mx-auto max-w-lg p-6">Loading...</main>;
  }
  if (error || !group) {
    return <main className="mx-auto max-w-lg p-6">{error || "Invite not found."}</main>;
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="mb-1 text-sm text-slate-400">Invite</p>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-slate-300">{group.location_label} • {group.member_count} members</p>
        {group.requires_approval ? (
          <p className="mt-2 text-sm text-amber-300">This is a private group. Your request needs admin approval.</p>
        ) : null}
        {group.description ? <p className="mt-3 text-sm text-slate-200">{group.description}</p> : null}
        {pending ? <p className="mt-3 text-sm text-emerald-300">Request sent. An admin will review it soon.</p> : null}
        <div className="mt-4">
          {authed ? (
            <button type="button" onClick={() => void join()} className="rounded bg-blue-600 px-3 py-2 font-semibold">
              {group.requires_approval ? "Request to join" : `Join ${group.name}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("pending_invite_code", params.inviteCode);
                router.push("/?signin=required");
              }}
              className="rounded border border-slate-600 px-3 py-2"
            >
              Sign in to join
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
