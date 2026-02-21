"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Group, Pin } from "@/lib/types";
import { PIN_CATEGORY_ICONS } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

interface GroupDetailClientProps {
  group: Group;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  currentUserId: string | null;
  isAuthenticated: boolean;
  recentPins: Pin[];
}

export default function GroupDetailClient({
  group,
  memberCount,
  isMember: initialMember,
  isAdmin,
  currentUserId,
  isAuthenticated,
  recentPins,
}: GroupDetailClientProps) {
  const router = useRouter();
  const [isMember, setIsMember] = useState(initialMember);
  const [members, setMembers] = useState(memberCount);
  const [error, setError] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState(false);

  const join = async () => {
    const response = await fetch(`/api/groups/${group.id}/join`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not join");
      return;
    }
    if (data.pending) {
      setPendingJoin(true);
      return;
    }
    setIsMember(true);
    setMembers((count) => count + 1);
  };

  const leave = async () => {
    const response = await fetch(`/api/groups/${group.id}/leave`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not leave");
      return;
    }
    setIsMember(false);
    setMembers((count) => Math.max(0, count - 1));
  };

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.colour }} />
              <h1 className="text-2xl font-semibold">{group.name}</h1>
            </div>
            <p className="text-sm text-slate-300">
              {group.location_label} • {members} members
              {group.is_virtual ? " • Online group" : ""}
            </p>
          </div>
          {isAuthenticated ? (
            isMember ? (
              <button type="button" onClick={() => void leave()} className="rounded border border-slate-600 px-3 py-2 text-sm">
                Leave group
              </button>
            ) : (
              <button type="button" onClick={() => void join()} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold">
                Join Group
              </button>
            )
          ) : (
            <Link href="/?signin=required" className="rounded border border-slate-600 px-3 py-2 text-sm">
              Sign in to join
            </Link>
          )}
        </div>
        {group.description ? <p className="text-sm text-slate-200">{group.description}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
        {pendingJoin ? <p className="mt-2 text-sm text-emerald-300">Join request sent for admin approval.</p> : null}
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-semibold">Recent pins</h2>
        <div className="space-y-2">
          {recentPins.length === 0 ? <p className="text-sm text-slate-400">No pins yet.</p> : null}
          {recentPins.map((pin) => (
            <article key={pin.id} className="rounded border border-slate-700 bg-slate-800 p-3">
              <p className="text-sm text-slate-300">{pin.profile_display_name || pin.author_name}</p>
              <p className="font-semibold">{pin.title || pin.description || "Untitled pin"}</p>
              <p className="text-sm text-slate-300">
                {pin.category ? `${PIN_CATEGORY_ICONS[pin.category]} ` : ""}
                {pin.category || "general"} • {relativeTime(pin.created_at)}
              </p>
            </article>
          ))}
        </div>
      </section>
      {isAdmin && currentUserId ? (
        <section className="mt-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Admin controls</h2>
              <Link href={`/groups/${group.id}/manage`} className="rounded border border-slate-600 px-3 py-1.5 text-sm">
                Open full manage panel
              </Link>
            </div>
            <p className="text-sm text-slate-300">Plugins are managed via the full manager panel.</p>
          </div>
        </section>
      ) : null}
      <div className="mt-4">
        <button type="button" onClick={() => router.push("/map")} className="rounded bg-slate-800 px-3 py-2 text-sm">
          Back to map
        </button>
      </div>
    </main>
  );
}
