"use client";

import { useEffect, useMemo, useState } from "react";
import { useVicariousSession } from "../hooks/useVicariousSession";
import { VicariousSession } from "../types";

interface SessionPanelProps {
  groupId: string;
  groupName: string;
  currentUserId: string;
}

export default function SessionPanel({ groupId, groupName, currentUserId }: SessionPanelProps) {
  const { session, loading } = useVicariousSession(groupId);
  const [localSession, setLocalSession] = useState<VicariousSession | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLocalSession(session);
  }, [session]);

  const publicLink = useMemo(() => {
    if (!localSession) return "";
    if (typeof window === "undefined") return `/vicarious/${localSession.session_code}`;
    return `${window.location.origin}/vicarious/${localSession.session_code}`;
  }, [localSession]);

  const startSession = async () => {
    setWorking(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/vicarious/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Could not start session");
    } else {
      if (payload.session) {
        setLocalSession(payload.session as VicariousSession);
      }
      setNotice(payload.already_active ? "Session was already live." : "Session started. Share the public link.");
    }
    setWorking(false);
  };

  const endSession = async () => {
    if (!localSession) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/vicarious/sessions/${localSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Could not end session");
    } else {
      setLocalSession(null);
      setNotice("Session ended.");
    }
    setWorking(false);
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold">Vicarious</h2>
      {loading ? <p className="mt-2 text-sm text-slate-400">Checking session status...</p> : null}
      {!loading && !localSession ? (
        <div className="mt-2 space-y-3">
          <h3 className="font-semibold">Start a Vicarious session</h3>
          <p className="text-sm text-slate-300">
            Members can drop challenge pins. Share the public link for anyone to join as a guest.
          </p>
          <button
            type="button"
            onClick={() => void startSession()}
            disabled={working}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold disabled:opacity-70"
          >
            {working ? "Starting..." : "Start session"}
          </button>
        </div>
      ) : null}

      {localSession ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="flex items-center gap-2 text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Session is live
          </p>
          <div className="rounded border border-slate-700 bg-slate-800 p-2">
            <p className="text-xs text-slate-400">Public link</p>
            <p className="break-all">{publicLink}</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(publicLink)}
              className="mt-2 rounded border border-slate-600 px-2 py-1 text-xs"
            >
              Copy link
            </button>
          </div>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={working}
            className="rounded border border-rose-700 px-3 py-2 text-rose-300 disabled:opacity-70"
          >
            {working ? "Ending..." : "End session"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-emerald-300">{notice}</p> : null}
      <p className="mt-2 text-xs text-slate-500">Group: {groupName} • Admin: {currentUserId.slice(0, 8)}</p>
    </section>
  );
}
