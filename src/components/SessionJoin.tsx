"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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

    const checkPendingInvite = async () => {
      const code = window.localStorage.getItem("pending_invite_code");
      if (!code) return;
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        window.localStorage.removeItem("pending_invite_code");
        router.replace(`/join/${code}`);
      }
    };
    void checkPendingInvite();

    return () => {
      mounted = false;
    };
  }, [router]);

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId.trim()) return;
    window.localStorage.setItem("display_name", name || "Guest");
    router.push(`/map/${sessionId.trim()}`);
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) {
      setMagicLinkSent(true);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
      <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <form onSubmit={join}>
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
            <Link href="/groups" className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200">
              Groups
            </Link>
          </div>
        </form>

        <div className="mt-5 border-t border-slate-700 pt-4">
          <p className="mb-2 text-sm text-slate-300">Set up your profile with email magic link</p>
          {magicLinkSent ? (
            <p className="text-sm text-emerald-300">Check your email for your sign-in link.</p>
          ) : (
            <form onSubmit={sendMagicLink} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                placeholder="you@example.com"
              />
              <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold">
                Send link
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
