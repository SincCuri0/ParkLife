"use client";

import { useEffect, useMemo, useState } from "react";
import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import { createClient } from "@/lib/supabase/client";
import { Comment } from "@/lib/types";

interface CommentThreadProps {
  pinId: string;
  currentUserId?: string;
  isLocked: boolean;
  isGroupAdmin?: boolean;
}

export default function CommentThread({ pinId, currentUserId, isLocked, isGroupAdmin }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*, author:profiles(*)")
        .eq("pin_id", pinId)
        .order("created_at", { ascending: true });
      setComments((data as Comment[]) || []);
    };

    void load();

    const channel = supabase
      .channel(`comments:${pinId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `pin_id=eq.${pinId}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pinId]);

  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_id).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      const list = map.get(comment.parent_id) || [];
      list.push(comment);
      map.set(comment.parent_id, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    }
    return map;
  }, [comments]);

  return (
    <section className="mt-3 rounded border border-slate-700 bg-slate-900/50 p-3">
      <p className="mb-3 text-sm text-slate-300">{comments.length} comment{comments.length === 1 ? "" : "s"}</p>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {rootComments.length === 0 ? <p className="text-sm text-slate-400">No comments yet.</p> : null}
        {rootComments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              isGroupAdmin={isGroupAdmin}
              depth={0}
              onReply={(parentId) => setReplyTo(parentId)}
              onDeleted={() => {
                setComments((prev) => prev.filter((entry) => entry.id !== comment.id));
              }}
            />
            {(repliesByParent.get(comment.id) || []).map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                isGroupAdmin={isGroupAdmin}
                depth={1}
                onReply={() => undefined}
                onDeleted={() => {
                  setComments((prev) => prev.filter((entry) => entry.id !== reply.id));
                }}
              />
            ))}
            {replyTo === comment.id && !isLocked ? (
              <div className="ml-4">
                <CommentInput
                  pinId={pinId}
                  parentId={comment.id}
                  placeholder="Write a reply..."
                  onCancel={() => setReplyTo(null)}
                  onSuccess={(newComment) => {
                    setComments((prev) => [...prev, newComment]);
                    setReplyTo(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {isLocked ? (
        <p className="mt-3 text-sm text-slate-400">Comments are closed.</p>
      ) : (
        <div className="mt-3">
          <CommentInput
            pinId={pinId}
            onSuccess={(newComment) => {
              setComments((prev) => [...prev, newComment]);
            }}
          />
        </div>
      )}
    </section>
  );
}
