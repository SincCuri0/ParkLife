"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LiveMap from "@/components/LiveMap";
import PinPopup from "@/components/PinPopup";
import { createClient } from "@/lib/supabase/client";
import { Group, Pin } from "@/lib/types";
import GuestNameEntry from "@/plugins/vicarious/components/GuestNameEntry";
import SessionEndScreen from "@/plugins/vicarious/components/SessionEndScreen";
import { GUEST_DESCRIPTION_MAX, GUEST_NAME_KEY } from "@/plugins/vicarious/constants";
import { VicariousSession } from "@/plugins/vicarious/types";

interface VicariousSessionClientProps {
  session: VicariousSession;
  group: { id: string; name: string; inviteCode: string };
  initialPins: Pin[];
}

export default function VicariousSessionClient({ session, group, initialPins }: VicariousSessionClientProps) {
  const [guestName, setGuestName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(GUEST_NAME_KEY) || "";
  });
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`vicarious-public:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pins",
          filter: `vicarious_session_id=eq.${session.id}`,
        },
        (payload) => {
          const pin = payload.new as Pin;
          if (pin.status === "rejected") return;
          setPins((prev) => (prev.some((existing) => existing.id === pin.id) ? prev : [pin, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pins",
          filter: `vicarious_session_id=eq.${session.id}`,
        },
        (payload) => {
          const pin = payload.new as Pin;
          if (pin.status === "rejected") {
            setPins((prev) => prev.filter((entry) => entry.id !== pin.id));
            return;
          }
          setPins((prev) => prev.map((existing) => (existing.id === pin.id ? pin : existing)));
          setSelectedPin((prev) => (prev?.id === pin.id ? pin : prev));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vicarious_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const next = payload.new as VicariousSession;
          if (!next.is_active) {
            setIsActive(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  const mapGroups = useMemo<Group[]>(
    () => [
      {
        id: group.id,
        created_at: session.created_at,
        name: group.name,
        description: null,
        location_label: null,
        latitude: null,
        longitude: null,
        radius_km: 1,
        colour: "#3b82f6",
        invite_code: group.inviteCode,
        is_public: true,
        is_virtual: true,
        requires_approval: false,
        created_by: session.started_by || "",
        is_member: true,
      },
    ],
    [group.id, group.inviteCode, group.name, session.created_at, session.started_by],
  );

  const submitPin = async (event: FormEvent) => {
    event.preventDefault();
    if (!placedCoords || !guestName) return;

    setSubmitting(true);
    const response = await fetch("/api/vicarious/guest-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_code: session.session_code,
        guest_name: guestName,
        description,
        latitude: placedCoords.lat,
        longitude: placedCoords.lng,
      }),
    });
    if (response.ok) {
      const pin = (await response.json()) as Pin;
      setPins((prev) => [pin, ...prev]);
      setDescription("");
      setPlacedCoords(null);
    }
    setSubmitting(false);
  };

  if (!guestName) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
        <GuestNameEntry onConfirm={setGuestName} />
      </main>
    );
  }

  if (!isActive) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
        <SessionEndScreen groupName={group.name} groupInviteCode={group.inviteCode} guestName={guestName} />
      </main>
    );
  }

  return (
    <main className="h-screen w-full">
      <header className="flex h-12 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{group.name}</span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live session
          </span>
        </div>
        <Link href={`/join/${group.inviteCode}`} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold">
          Join {group.name}
        </Link>
      </header>
      <div className="relative">
        <LiveMap
          pins={pins}
          groups={mapGroups}
          visibleGroupIds={[group.id]}
          onPinPlace={(lat, lng) => setPlacedCoords({ lat, lng })}
          onPinSelect={(pin) => setSelectedPin(pin)}
        />
        {selectedPin ? <PinPopup pin={selectedPin} onClose={() => setSelectedPin(null)} /> : null}
        {placedCoords ? (
          <div className="absolute inset-x-3 bottom-4 z-20 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <h3 className="mb-2 font-semibold">Drop challenge pin</h3>
            <form onSubmit={submitPin} className="space-y-2">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, GUEST_DESCRIPTION_MAX))}
                maxLength={GUEST_DESCRIPTION_MAX}
                required
                placeholder="What is the challenge?"
                className="h-20 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">{description.length}/{GUEST_DESCRIPTION_MAX}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacedCoords(null)}
                    className="rounded border border-slate-600 px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold disabled:opacity-70"
                  >
                    {submitting ? "Sending..." : "Submit pin"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
