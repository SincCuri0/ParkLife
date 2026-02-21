"use client";

"use client";

import { useMemo, useState } from "react";
import { Pin, PinStatus } from "@/lib/types";
import { PIN_COLOURS } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";
import HostControls from "./HostControls";
import ReactionBar from "./ReactionBar";
import PinExpiryBadge from "./PinExpiryBadge";
import { Reaction } from "@/lib/types";
import CommentThread from "./CommentThread";
import ReportModal from "./ReportModal";
import ResolveModal from "./ResolveModal";

interface PinPopupProps {
  pin: Pin;
  isHost?: boolean;
  onClose: () => void;
  onStatusChange?: (pin: Pin, status: PinStatus) => void;
  reactions?: Reaction[];
  currentUserId?: string;
  onPinUpdated?: (pin: Pin) => void;
}

export default function PinPopup({
  pin,
  isHost,
  onClose,
  onStatusChange,
  reactions = [],
  currentUserId,
  onPinUpdated,
}: PinPopupProps) {
  const heading = pin.title || pin.description || "Pin";
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const isLocked = pin.status === "resolved" || pin.status === "rejected";
  const canResolve = useMemo(
    () => currentUserId && pin.posted_by === currentUserId && (pin.category === "help" || pin.category === "item") && pin.status !== "resolved",
    [currentUserId, pin.category, pin.posted_by, pin.status],
  );

  return (
    <div className="absolute right-3 top-16 z-20 w-[min(92vw,420px)] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          {pin.group_name ? (
            <p
              className="mb-1 inline-flex rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: `${pin.group_colour || "#334155"}66`, color: "#E2E8F0" }}
            >
              {pin.group_name}
            </p>
          ) : null}
          <p className="text-sm text-slate-300">{pin.profile_display_name || pin.author_name}</p>
          <p className="text-base font-semibold text-slate-50">{heading}</p>
          {pin.description && pin.title ? <p className="mt-1 text-sm text-slate-300">{pin.description}</p> : null}
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
        <PinExpiryBadge expiresAt={pin.expires_at} isResolved={pin.is_resolved} />
      </div>

      <div className="mb-3">
        <ReactionBar pinId={pin.id} reactions={reactions} currentUserId={currentUserId} />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <button type="button" onClick={() => setCommentsOpen((prev) => !prev)} className="text-blue-300 hover:text-blue-200">
          {commentsOpen ? "Hide comments" : "View comments"}
        </button>
        <button type="button" onClick={() => setShowReport(true)} className="text-slate-300 hover:text-white">
          Report
        </button>
      </div>

      {canResolve ? (
        <button
          type="button"
          onClick={() => setShowResolve(true)}
          className="mb-3 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
        >
          Mark as resolved
        </button>
      ) : null}

      {commentsOpen ? <CommentThread pinId={pin.id} currentUserId={currentUserId} isLocked={isLocked} /> : null}

      {isHost && onStatusChange ? <HostControls pin={pin} onStatusChange={onStatusChange} /> : null}
      {showReport ? <ReportModal pinId={pin.id} onClose={() => setShowReport(false)} /> : null}
      {showResolve ? (
        <ResolveModal
          pin={pin}
          onClose={() => setShowResolve(false)}
          onSuccess={(updated) => onPinUpdated?.(updated)}
        />
      ) : null}
    </div>
  );
}
