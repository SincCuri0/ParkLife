"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import { fetchNotificationsSnapshot } from "@/lib/notifications-client";
import { createClient } from "@/lib/supabase/client";

export default function BottomNavShell() {
  const pathname = usePathname();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const hidden = useMemo(() => {
    if (pathname === "/") return true;
    if (pathname.startsWith("/map")) return true;
    if (pathname.startsWith("/profile/setup")) return true;
    if (pathname === "/vicarious") return true;
    if (pathname.startsWith("/vicarious/")) return true;
    return false;
  }, [pathname]);

  useEffect(() => {
    if (hidden) return;

    const run = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setUnreadCount(0);
        return;
      }

      setCurrentUserId(user.id);
      try {
        const snapshot = await fetchNotificationsSnapshot();
        setUnreadCount(snapshot.unread_count || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    void run();
  }, [hidden, pathname]);

  if (hidden || !currentUserId) {
    return null;
  }

  return <BottomNav currentUserId={currentUserId} unreadCount={unreadCount} />;
}
