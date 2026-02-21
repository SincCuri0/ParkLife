"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HostCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const authResponse = await fetch("/api/auth/host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: hostPassword }),
      });

      const authData = await authResponse.json();
      if (!authResponse.ok) {
        setError(authData.error || "Host authentication failed");
        return;
      }

      const createResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: hostPassword }),
      });

      const createData = await createResponse.json();
      if (!createResponse.ok) {
        setError(createData.error || "Failed to create session");
        return;
      }

      router.push(`/host/${createData.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h1 className="mb-1 text-xl font-semibold">Create Session</h1>
        <p className="mb-4 text-sm text-slate-300">Start a new live challenge map session.</p>

        <label className="mb-2 block text-sm">Session name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        <label className="mb-2 block text-sm">Host password</label>
        <input
          type="password"
          value={hostPassword}
          onChange={(event) => setHostPassword(event.target.value)}
          required
          className="mb-4 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}

        <button type="submit" disabled={loading} className="rounded bg-blue-600 px-4 py-2 font-semibold">
          {loading ? "Creating..." : "Create"}
        </button>
      </form>
    </main>
  );
}
