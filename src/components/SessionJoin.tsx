"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PublicSession {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function SessionJoin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadActiveSession = async () => {
      try {
        const response = await fetch("/api/sessions?active=true&limit=1", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as PublicSession[];
        if (!mounted || data.length === 0) return;
        setSessionId((prev) => prev || data[0].id);
        setActiveSessionName(data[0].name);
      } catch {
        // Non-blocking: users can still enter session code manually.
      }
    };

    void loadActiveSession();
    return () => {
      mounted = false;
    };
  }, []);

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId.trim()) return;
    window.localStorage.setItem("display_name", name || "Guest");
    router.push(`/map/${sessionId.trim()}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
      <form onSubmit={join} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h1 className="text-2xl font-bold">ParkLife</h1>
        <p className="mb-4 text-sm text-slate-300">Join a live community session and drop map challenges.</p>

        <label className="mb-2 block text-sm">Display name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={30}
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
          placeholder="Alex"
        />

        <label className="mb-2 block text-sm">Session code</label>
        <input
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          required
          className="mb-4 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
          placeholder="abc12345"
        />
        {activeSessionName ? (
          <p className="mb-3 text-xs text-slate-300">
            Active session found: <span className="font-semibold">{activeSessionName}</span> ({sessionId})
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500">
            Join Live Session
          </button>
          <Link href="/host" className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200">
            Host Login
          </Link>
        </div>
      </form>
    </main>
  );
}
