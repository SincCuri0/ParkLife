"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import GroupCard from "@/components/GroupCard";
import { Group } from "@/lib/types";

interface DiscoverPageClientProps {
  initialGroups: Group[];
  isAuthenticated: boolean;
  myGroupIds: string[];
  fallbackCoords: { lat: number; lng: number };
}

function toTokens(value: string | null) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const sb = Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  const c = 2 * Math.atan2(Math.sqrt(sa + sb), Math.sqrt(1 - (sa + sb)));
  return r * c;
}

export default function DiscoverPageClient({
  initialGroups,
  isAuthenticated,
  myGroupIds,
  fallbackCoords,
}: DiscoverPageClientProps) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [query, setQuery] = useState("");
  const [joinedIds, setJoinedIds] = useState<string[]>(myGroupIds);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [askedGeo, setAskedGeo] = useState(false);
  const [authPromptGroupId, setAuthPromptGroupId] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) => {
      const name = group.name.toLowerCase();
      const description = String(group.description || "").toLowerCase();
      return name.includes(needle) || description.includes(needle);
    });
  }, [groups, query]);

  const nearYou = useMemo(() => {
    const centre = coords || fallbackCoords;
    return groups
      .filter((group) => group.latitude !== null && group.longitude !== null)
      .filter((group) => distanceKm(centre.lat, centre.lng, group.latitude as number, group.longitude as number) <= 10)
      .slice(0, 12);
  }, [coords, fallbackCoords, groups]);

  const suggested = (() => {
    const joined = groups.filter((group) => joinedIds.includes(group.id));
    if (!joined.length) {
      return groups.filter((group) => !joinedIds.includes(group.id)).slice(0, 12);
    }

    const joinedTokens = new Set<string>();
    for (const group of joined) {
      for (const token of toTokens(group.name)) joinedTokens.add(token);
      for (const token of toTokens(group.description)) joinedTokens.add(token);
      for (const token of toTokens(group.location_label)) joinedTokens.add(token);
    }

    return groups
      .filter((group) => !joinedIds.includes(group.id))
      .map((group) => {
        const scoreTokens = [...toTokens(group.name), ...toTokens(group.description), ...toTokens(group.location_label)];
        const score = scoreTokens.reduce((acc, token) => acc + (joinedTokens.has(token) ? 1 : 0), 0);
        return { group, score };
      })
      .sort((a, b) => b.score - a.score || a.group.name.localeCompare(b.group.name))
      .map((entry) => entry.group)
      .slice(0, 12);
  })();

  const requestGeo = () => {
    if (askedGeo) return;
    setAskedGeo(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setCoords(null);
      },
      { maximumAge: 60_000, timeout: 8_000 },
    );
  };

  const joinGroup = async (groupId: string) => {
    if (!isAuthenticated) {
      setAuthPromptGroupId(groupId);
      return;
    }

    const response = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
    if (!response.ok) return;
    setJoinedIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, member_count: (group.member_count || 0) + 1 } : group)),
    );
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Discover groups</h1>
          {isAuthenticated ? (
            <Link href="/groups/create" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold">
              Create group
            </Link>
          ) : null}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search groups by name or description"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
        />
      </header>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Near you</h2>
          <button type="button" onClick={requestGeo} className="text-sm text-blue-300 hover:text-blue-200">
            Use my location
          </button>
        </div>
        <div className="space-y-3">
          {nearYou.length === 0 ? <p className="text-sm text-slate-400">No public groups within 10km.</p> : null}
          {nearYou.map((group) => (
            <GroupCard
              key={`near-${group.id}`}
              group={group}
              memberCount={group.member_count || 0}
              isMember={joinedIds.includes(group.id)}
              onJoin={joinedIds.includes(group.id) ? undefined : () => void joinGroup(group.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Suggested</h2>
        <div className="space-y-3">
          {suggested.length === 0 ? <p className="text-sm text-slate-400">No suggestions yet.</p> : null}
          {suggested.map((group) => (
            <GroupCard
              key={`suggested-${group.id}`}
              group={group}
              memberCount={group.member_count || 0}
              isMember={joinedIds.includes(group.id)}
              onJoin={joinedIds.includes(group.id) ? undefined : () => void joinGroup(group.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Search results</h2>
        <div className="space-y-3">
          {searchResults.length === 0 ? <p className="text-sm text-slate-400">No matching groups.</p> : null}
          {searchResults.map((group) => (
            <GroupCard
              key={`search-${group.id}`}
              group={group}
              memberCount={group.member_count || 0}
              isMember={joinedIds.includes(group.id)}
              onJoin={joinedIds.includes(group.id) ? undefined : () => void joinGroup(group.id)}
            />
          ))}
        </div>
      </section>

      {authPromptGroupId ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Sign in to join</h3>
              <button type="button" onClick={() => setAuthPromptGroupId(null)} className="text-slate-400 hover:text-slate-200">
                Close
              </button>
            </div>
            <AuthGate message="Join requires a quick magic-link sign in.">
              <></>
            </AuthGate>
            <p className="mt-3 text-xs text-slate-400">
              Prefer browsing only? Continue exploring public groups or open <Link href={`/groups/${authPromptGroupId}`} className="underline">group details</Link>.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
