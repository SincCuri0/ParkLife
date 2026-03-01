"use client";

import { FormEvent, useState } from "react";

export default function HomePageClient() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);

    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Could not send login link");
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
      <section className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="text-center text-3xl font-semibold">ParkLife</h1>
        <p className="mt-2 text-center text-slate-300">A community map for people, not algorithms.</p>

        {sent ? (
          <p className="mt-6 rounded-lg border border-emerald-700 bg-emerald-950/50 p-3 text-sm text-emerald-200">
            Check your email. Your link expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
                placeholder="you@example.com"
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded bg-blue-600 px-4 py-2 font-semibold disabled:opacity-70"
            >
              {sending ? "Sending..." : "Send me a login link"}
            </button>
            <p className="text-center text-xs text-slate-400">No password. No app store. Just a link.</p>
          </form>
        )}
      </section>
    </main>
  );
}
