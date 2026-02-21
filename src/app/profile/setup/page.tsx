"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_COLOURS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (profile) {
        router.replace("/map");
        return;
      }

      setLoading(false);
    };

    void run();
  }, [router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setError("Display name must be 2-40 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const avatarColour = GROUP_COLOURS[Math.floor(Math.random() * GROUP_COLOURS.length)];
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      display_name: trimmedName,
      bio: bio.trim() || null,
      avatar_colour: avatarColour,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.replace("/map");
  };

  if (loading) {
    return <main className="mx-auto max-w-lg p-6">Loading...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
      <form onSubmit={onSubmit} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h1 className="mb-1 text-2xl font-bold">Set up your profile</h1>
        <p className="mb-4 text-sm text-slate-300">One-time setup so communities know who you are.</p>

        <label className="mb-2 block text-sm">Display name</label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          minLength={2}
          maxLength={40}
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        <label className="mb-2 block text-sm">Bio ({bio.length}/160)</label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, 160))}
          className="mb-3 h-24 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}

        <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 font-semibold">
          {saving ? "Saving..." : "Continue to map"}
        </button>
      </form>
    </main>
  );
}
