"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pin } from "@/lib/types";

interface PlacePinModalProps {
  latitude: number;
  longitude: number;
  sessionId: string;
  onClose: () => void;
  onSuccess: (pin: Pin) => void;
}

export default function PlacePinModal({ latitude, longitude, sessionId, onClose, onSuccess }: PlacePinModalProps) {
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("display_name");
    if (stored) {
      queueMicrotask(() => setAuthorName(stored));
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: authorName,
          description,
          latitude,
          longitude,
          session_id: sessionId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not submit pin");
        return;
      }

      window.localStorage.setItem("display_name", authorName);
      onSuccess(data as Pin);
      onClose();
    } catch {
      setError("Network error while creating pin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-slate-900 p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Drop a challenge pin</h2>

        <label className="mb-2 block text-sm text-slate-300">Name</label>
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          required
          maxLength={30}
          className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        <label className="mb-2 block text-sm text-slate-300">Challenge ({description.length}/140)</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 140))}
          required
          className="mb-3 h-24 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2"
        />

        {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded bg-blue-600 px-3 py-2 font-semibold">
            {loading ? "Submitting..." : "Submit Pin"}
          </button>
        </div>
      </form>
    </div>
  );
}
