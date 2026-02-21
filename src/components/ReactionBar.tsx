"use client";

import { useEffect, useMemo, useState } from "react";
import { REACTION_EMOJIS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Reaction } from "@/lib/types";

interface ReactionBarProps {
  pinId: string;
  reactions: Reaction[];
  currentUserId?: string;
}

export default function ReactionBar({ pinId, reactions, currentUserId }: ReactionBarProps) {
  const [items, setItems] = useState<Reaction[]>(reactions);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setItems(reactions);
  }, [reactions]);

  useEffect(() => {
    const supabase = createClient();
    const loadInitial = async () => {
      const { data } = await supabase.from("reactions").select("*").eq("pin_id", pinId);
      setItems((data as Reaction[]) || []);
    };
    void loadInitial();

    const channel = supabase
      .channel(`reactions:${pinId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `pin_id=eq.${pinId}`,
        },
        async () => {
          const { data } = await supabase.from("reactions").select("*").eq("pin_id", pinId);
          setItems((data as Reaction[]) || []);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pinId]);

  const counts = useMemo(() => {
    return REACTION_EMOJIS.map((emoji) => ({
      emoji,
      count: items.filter((reaction) => reaction.emoji === emoji).length,
      active: Boolean(currentUserId && items.some((reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId)),
    }));
  }, [items, currentUserId]);

  const available = showAll ? counts : counts.filter((item) => item.count > 0);

  const toggleReaction = async (emoji: string, active: boolean) => {
    await fetch(`/api/pins/${pinId}/reactions`, {
      method: active ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {available.map((item) => (
        <button
          key={item.emoji}
          type="button"
          onClick={() => void toggleReaction(item.emoji, item.active)}
          className={`rounded-full border px-2 py-1 text-xs ${item.active ? "border-blue-500 bg-blue-600/20" : "border-slate-700 bg-slate-800"}`}
        >
          {item.emoji} {item.count > 0 ? item.count : ""}
        </button>
      ))}
      {!showAll ? (
        <button type="button" onClick={() => setShowAll(true)} className="rounded-full border border-slate-700 px-2 py-1 text-xs">
          +
        </button>
      ) : null}
    </div>
  );
}
