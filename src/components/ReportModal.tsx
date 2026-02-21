"use client";

import { useState } from "react";
import { REPORT_CATEGORIES } from "@/lib/constants";

interface ReportModalProps {
  pinId?: string;
  commentId?: string;
  onClose: () => void;
}

export default function ReportModal({ pinId, commentId, onClose }: ReportModalProps) {
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]["value"]>("spam");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin_id: pinId,
        comment_id: commentId,
        category,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Could not submit report");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="text-lg font-semibold">Report this content</h3>
        {!done ? (
          <>
            <p className="mt-1 text-sm text-slate-300">Your report is anonymous.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REPORT_CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded border px-3 py-2 text-left text-sm ${
                    category === item.value ? "border-blue-500 bg-blue-950/40" : "border-slate-700 bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={loading}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold"
              >
                {loading ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-emerald-300">Thank you for reporting.</p>
            <button type="button" onClick={onClose} className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm font-semibold">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
