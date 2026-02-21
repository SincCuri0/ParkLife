"use client";

import { useState } from "react";
import Link from "next/link";
import GroupCard from "@/components/GroupCard";
import { Group } from "@/lib/types";

interface GroupsPageClientProps {
  initialGroups: Group[];
  myGroupIds: string[];
}

export default function GroupsPageClient({ initialGroups, myGroupIds }: GroupsPageClientProps) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [query, setQuery] = useState("");
  const [joined, setJoined] = useState<string[]>(myGroupIds);

  const filtered = groups.filter((group) => {
    const needle = query.toLowerCase();
    return group.name.toLowerCase().includes(needle) || (group.location_label || "").toLowerCase().includes(needle);
  });

  const joinGroup = async (groupId: string) => {
    const response = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
    if (response.ok) {
      setJoined((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
      setGroups((prev) =>
        prev.map((group) => (group.id === groupId ? { ...group, member_count: (group.member_count || 0) + 1 } : group)),
      );
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <Link href="/groups/create" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold">
          Create Group
        </Link>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or location"
        className="mb-4 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
      />
      <div className="space-y-3">
        {filtered.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            memberCount={group.member_count || 0}
            isMember={joined.includes(group.id)}
            onJoin={joined.includes(group.id) ? undefined : () => void joinGroup(group.id)}
          />
        ))}
      </div>
    </main>
  );
}
