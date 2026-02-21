"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VicariousSession } from "../types";

export function useVicariousSession(groupId: string) {
  const [session, setSession] = useState<VicariousSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase
      .from("vicarious_sessions")
      .select("*")
      .eq("group_id", groupId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setSession((data as VicariousSession | null) || null);
        setLoading(false);
      });

    const channel = supabase
      .channel(`vicarious:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vicarious_sessions",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSession(null);
            return;
          }
          const next = payload.new as VicariousSession;
          setSession(next.is_active ? next : null);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return { session, loading };
}
