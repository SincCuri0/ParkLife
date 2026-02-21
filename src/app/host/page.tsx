"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HostLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (sessionId.trim()) {
        router.push(`/host/${sessionId.trim()}`);
      } else {
        router.push("/host/create");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h1 className="mb-1 text-xl font-semibold">Host Login</h1>
        <p className="mb-4 text-sm text-slate-300">Authenticate and open an existing session.</p>

        <label className="mb-2 block text-sm">Host password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        <label className="mb-2 block text-sm">Session code (optional)</label>
        <input
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          className="mb-4 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
          placeholder="abc12345"
        />

        {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="rounded bg-blue-600 px-4 py-2 font-semibold">
            {loading ? "Signing in..." : "Continue"}
          </button>
          <Link href="/host/create" className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200">
            Create Session
          </Link>
        </div>
      </form>
    </main>
  );
}
