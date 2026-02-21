"use client";

import { Pin, PinStatus } from "@/lib/types";
import { PIN_COLOURS } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";
import HostControls from "./HostControls";

interface PinPopupProps {
  pin: Pin;
  isHost?: boolean;
  onClose: () => void;
  onStatusChange?: (pin: Pin, status: PinStatus) => void;
}

export default function PinPopup({ pin, isHost, onClose, onStatusChange }: PinPopupProps) {
  return (
    <div className="absolute right-3 top-16 z-20 w-[min(92vw,380px)] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">{pin.author_name}</p>
          <p className="text-base font-semibold text-slate-50">{pin.description}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-300 hover:text-white">
          x
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
        <span className="rounded-full px-2 py-1" style={{ backgroundColor: PIN_COLOURS[pin.status], color: "#fff" }}>
          {pin.status}
        </span>
        <span>{relativeTime(pin.created_at)}</span>
      </div>

      {isHost && onStatusChange ? <HostControls pin={pin} onStatusChange={onStatusChange} /> : null}
    </div>
  );
}
