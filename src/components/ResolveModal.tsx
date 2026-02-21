"use client";

import { useState } from "react";
import { Pin } from "@/lib/types";

interface ResolveModalProps {
  pin: Pin;
  onClose: () => void;
  onSuccess: (pin: Pin) => void;
}

export default function ResolveModal({ pin, onClose, onSuccess }: ResolveModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvePin = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/pins/${pin.id}/resolve`, { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not resolve pin");
      setLoading(false);
      return;
    }

    onSuccess(data as Pin);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-lg font-semibold">Mark as resolved?</h3>
        <p className="mt-2 text-sm text-slate-300">Your pin will be removed from the map and saved to your history.</p>
        {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void resolvePin()}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold"
          >
            {loading ? "Resolving..." : "Mark resolved"}
          </button>
        </div>
      </div>
    </div>
  );
}
