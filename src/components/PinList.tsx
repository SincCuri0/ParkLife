"use client";

import { useMemo } from "react";
import { Pin } from "@/lib/types";
import { relativeTime, sortHostPins } from "@/lib/utils";

interface PinListProps {
  pins: Pin[];
  onPinSelect: (pin: Pin) => void;
}

export default function PinList({ pins, onPinSelect }: PinListProps) {
  const sortedPins = useMemo(() => sortHostPins(pins), [pins]);
  const pending = pins.filter((pin) => pin.status === "pending").length;
  const active = pins.filter((pin) => pin.status === "active").length;
  const completed = pins.filter((pin) => pin.status === "completed").length;

  return (
    <aside className="w-full max-w-sm border-l border-slate-700 bg-slate-900 p-3">
      <div className="mb-3 flex gap-2 text-xs">
        <span className="rounded bg-blue-600 px-2 py-1">{pending} pending</span>
        <span className="rounded bg-orange-500 px-2 py-1">{active} active</span>
        <span className="rounded bg-emerald-600 px-2 py-1">{completed} completed</span>
      </div>

      <div className="max-h-[70vh] space-y-2 overflow-y-auto">
        {sortedPins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={() => onPinSelect(pin)}
            className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-left hover:bg-slate-700"
          >
            <p className="text-sm font-semibold text-slate-100">{pin.author_name}</p>
            <p className="truncate text-sm text-slate-300">{pin.description}</p>
            <p className="text-xs text-slate-400">{pin.status} • {relativeTime(pin.created_at)}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}
