"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VicariousEntryPage() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const code = sessionCode.trim().toLowerCase();
    if (!code) return;
    router.push(`/vicarious/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
      <section className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="text-2xl font-semibold">Vicarious</h1>
        <p className="mt-2 text-slate-300">
          Join a live challenge session. Drop pins, watch them happen in real life.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300">
            Enter your session code
            <input
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
              placeholder="e.g. ab12cd34"
              required
            />
          </label>
          <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 font-semibold">
            Join session
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-300">
          Have an account? <Link href="/" className="underline">Sign in to participate as yourself.</Link>
        </p>
      </section>
    </main>
  );
}
