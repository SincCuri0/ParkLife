"use client";

import { FormEvent, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { COMMENT_MAX_LENGTH } from "@/lib/constants";
import { Comment } from "@/lib/types";

interface CommentInputProps {
  pinId: string;
  parentId?: string;
  onSuccess: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
}

export default function CommentInput({ pinId, parentId, onSuccess, onCancel, placeholder }: CommentInputProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > COMMENT_MAX_LENGTH) {
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin_id: pinId,
        parent_id: parentId,
        body: trimmed,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not submit comment");
      setLoading(false);
      return;
    }

    setBody("");
    onSuccess(data as Comment);
    setLoading(false);
  };

  return (
    <AuthGate message="Sign in to comment on this pin.">
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, COMMENT_MAX_LENGTH + 20))}
          maxLength={COMMENT_MAX_LENGTH + 20}
          rows={2}
          placeholder={placeholder || "Write a comment..."}
          className="w-full resize-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs ${body.length > COMMENT_MAX_LENGTH ? "text-rose-400" : "text-slate-400"}`}>
            {body.length}/{COMMENT_MAX_LENGTH}
          </p>
          <div className="flex gap-2">
            {parentId && onCancel ? (
              <button type="button" onClick={onCancel} className="rounded border border-slate-600 px-2 py-1 text-xs">
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={loading || !body.trim() || body.length > COMMENT_MAX_LENGTH}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold disabled:opacity-60"
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </form>
    </AuthGate>
  );
}
