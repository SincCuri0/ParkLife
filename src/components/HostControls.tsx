"use client";

import { Pin, PinStatus } from "@/lib/types";

interface HostControlsProps {
  pin: Pin;
  onStatusChange: (pin: Pin, status: PinStatus) => void;
}

export default function HostControls({ pin, onStatusChange }: HostControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {pin.status === "pending" ? (
        <>
          <button
            type="button"
            onClick={() => onStatusChange(pin, "active")}
            className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold hover:bg-emerald-500"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(pin, "rejected")}
            className="rounded bg-rose-600 px-3 py-1 text-sm font-semibold hover:bg-rose-500"
          >
            Reject
          </button>
        </>
      ) : null}

      {pin.status === "active" ? (
        <button
          type="button"
          onClick={() => onStatusChange(pin, "completed")}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold hover:bg-blue-500"
        >
          Mark Complete
        </button>
      ) : null}
    </div>
  );
}
