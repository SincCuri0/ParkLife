"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PIN_COLOURS } from "@/lib/constants";
import { Pin, PinStatus } from "@/lib/types";
import { VicariousSession } from "../types";

interface HostControlsProps {
  session: VicariousSession;
  groupId: string;
}

export default function HostControls({ session, groupId }: HostControlsProps) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("pins")
        .select("*")
        .eq("group_id", groupId)
        .eq("vicarious_session_id", session.id)
        .order("created_at", { ascending: true });
      setPins((data as Pin[]) || []);
    };
    void load();

    const channel = supabase
      .channel(`vicarious-pins:${session.id}`)
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
          setPins((prev) => (prev.some((existing) => existing.id === pin.id) ? prev : [...prev, pin]));
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
          setPins((prev) => prev.map((existing) => (existing.id === pin.id ? pin : existing)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, session.id]);

  const visiblePins = useMemo(
    () => pins.filter((pin) => pin.status !== "rejected").sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [pins],
  );

  const updateStatus = async (pinId: string, status: PinStatus) => {
    setUpdatingId(pinId);
    const response = await fetch(`/api/pins/${pinId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      const updated = (await response.json()) as Pin;
      setPins((prev) => prev.map((pin) => (pin.id === pinId ? updated : pin)));
    }
    setUpdatingId(null);
  };

  return (
    <aside className="absolute right-3 top-3 z-20 w-[min(360px,92vw)] rounded-xl border border-slate-700 bg-slate-900/95 p-3">
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <h3 className="font-semibold">Vicarious - Live</h3>
      </header>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {visiblePins.length === 0 ? <p className="text-sm text-slate-400">No session pins yet.</p> : null}
        {visiblePins.map((pin) => {
          const label = pin.guest_name || pin.author_name || "Member";
          return (
            <article key={pin.id} className="rounded border border-slate-700 bg-slate-800 p-2 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-semibold">{label}</p>
                <span className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: PIN_COLOURS[pin.status] }}>
                  {pin.status}
                </span>
              </div>
              <p className="text-slate-200">{pin.description || "No description"}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(pin.created_at).toLocaleTimeString()}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pin.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => void updateStatus(pin.id, "active")}
                    disabled={updatingId === pin.id}
                    className="rounded bg-orange-600 px-2 py-1 text-xs font-semibold"
                  >
                    Go here
                  </button>
                ) : null}
                {pin.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void updateStatus(pin.id, "completed")}
                    disabled={updatingId === pin.id}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold"
                  >
                    Mark complete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void updateStatus(pin.id, "rejected")}
                  disabled={updatingId === pin.id}
                  className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300"
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
