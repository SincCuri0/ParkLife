"use client";

import Link from "next/link";
import { Group } from "@/lib/types";

interface GroupCardProps {
  group: Group;
  memberCount: number;
  isMember?: boolean;
  onJoin?: () => void;
}

export default function GroupCard({ group, memberCount, isMember, onJoin }: GroupCardProps) {
  return (
    <article
      className="rounded-xl border border-slate-700 bg-slate-900 p-4"
      style={{ borderLeftWidth: 5, borderLeftColor: group.colour }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            {!group.is_public ? "🔒 " : ""}
            {group.name}
          </h3>
          <p className="text-xs text-slate-400">
            {group.location_label} • {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
        {isMember ? (
          <span className="rounded-full bg-emerald-900/50 px-2 py-1 text-xs text-emerald-300">member</span>
        ) : null}
      </div>
      {group.description ? <p className="line-clamp-2 text-sm text-slate-300">{group.description}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <Link href={`/groups/${group.id}`} className="rounded border border-slate-600 px-3 py-1.5 text-sm">
          View
        </Link>
        {!isMember && onJoin ? (
          <button type="button" onClick={onJoin} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold">
            Join
          </button>
        ) : null}
      </div>
    </article>
  );
}
