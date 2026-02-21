"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  message?: string;
}

export default function AuthGate({ children, fallback, message }: AuthGateProps) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setAuthed(Boolean(data.user));
      setLoading(false);
    };
    void run();
  }, []);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) {
      setSent(true);
    }
  };

  if (loading) return null;
  if (authed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="mb-3 text-sm text-slate-300">{message || "Sign in to continue."}</p>
      {sent ? (
        <p className="text-sm text-emerald-300">Check your email for the magic link.</p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
          <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold">
            Send link
          </button>
        </form>
      )}
    </div>
  );
}
