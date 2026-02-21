"use client";

import { useState } from "react";
import { Comment } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import ReportModal from "@/components/ReportModal";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  isGroupAdmin?: boolean;
  onReply: (parentId: string) => void;
  onDeleted: (commentId: string) => void;
  depth: number;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((entry) => entry[0]?.toUpperCase() || "")
    .join("");
}

export default function CommentItem({ comment, currentUserId, isGroupAdmin, onReply, onDeleted, depth }: CommentItemProps) {
  const [showReport, setShowReport] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = Boolean(currentUserId && (comment.author_id === currentUserId || isGroupAdmin));

  const remove = async () => {
    setDeleting(true);
    const response = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    if (response.ok) {
      onDeleted(comment.id);
    }
    setDeleting(false);
  };

  return (
    <article className={`rounded border border-slate-700 bg-slate-850/30 p-3 ${depth === 1 ? "ml-4 border-l-2" : ""}`}>
      {comment.is_deleted ? (
        <p className="text-sm italic text-slate-400">Comment removed</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: comment.author?.avatar_colour || "#334155" }}
              >
                {initials(comment.author?.display_name)}
              </span>
              <span className="font-medium text-slate-200">{comment.author?.display_name || "Unknown"}</span>
              <span>{relativeTime(comment.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowReport(true)} className="text-xs text-slate-300 hover:text-white">
                Report
              </button>
              {canDelete ? (
                <button type="button" onClick={() => void remove()} className="text-xs text-rose-300 hover:text-rose-200">
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-100">{comment.body}</p>
          {depth === 0 ? (
            <button type="button" onClick={() => onReply(comment.id)} className="mt-2 text-xs text-blue-300 hover:text-blue-200">
              Reply
            </button>
          ) : null}
        </>
      )}
      {showReport ? <ReportModal commentId={comment.id} onClose={() => setShowReport(false)} /> : null}
    </article>
  );
}
