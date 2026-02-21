"use client";

import { useEffect, useState } from "react";
import NotificationPanel from "@/components/NotificationPanel";
import { createClient } from "@/lib/supabase/client";

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const refresh = async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = await response.json();
      setUnread(data.unread_count || 0);
    };

    void refresh();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnread((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded border border-slate-600 px-2 py-1 text-sm"
        aria-label="Notifications"
      >
        Bell
        {unread > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} onUnreadChange={setUnread} />
    </div>
  );
}
