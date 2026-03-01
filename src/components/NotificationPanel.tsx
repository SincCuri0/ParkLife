"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationItem from "@/components/NotificationItem";
import {
  clearNotificationsSnapshot,
  fetchNotificationsSnapshot,
  setNotificationsSnapshot,
} from "@/lib/notifications-client";
import { Notification } from "@/lib/types";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function NotificationPanel({ open, onClose, onUnreadChange }: NotificationPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const data = await fetchNotificationsSnapshot();
        setNotifications(data.notifications || []);
      } catch {
        return;
      }
      onUnreadChange?.(0);
      await fetch("/api/notifications/read", { method: "POST" });
      setNotifications((prev) => {
        const updated = prev.map((entry) => ({ ...entry, is_read: true }));
        setNotificationsSnapshot({
          notifications: updated,
          unread_count: 0,
        });
        return updated;
      });
    };

    void load();
  }, [open, onUnreadChange]);

  const openNotification = async (notification: Notification) => {
    await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
    clearNotificationsSnapshot();

    const path = notification.pin_id
      ? `/map?pin=${notification.pin_id}`
      : notification.group_id
        ? `/groups/${notification.group_id}`
        : "/notifications";

    onClose();
    router.push(path);
  };

  if (!open) return null;

  return (
    <div className="absolute right-2 top-12 z-40 w-[min(92vw,420px)] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void fetch("/api/notifications/read", { method: "POST" });
              setNotifications((prev) => {
                const updated = prev.map((entry) => ({ ...entry, is_read: true }));
                setNotificationsSnapshot({
                  notifications: updated,
                  unread_count: 0,
                });
                return updated;
              });
              onUnreadChange?.(0);
            }}
            className="text-xs text-slate-300"
          >
            Mark all read
          </button>
          <button type="button" onClick={onClose} className="text-xs text-slate-300">
            Close
          </button>
        </div>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {notifications.length === 0 ? <p className="text-sm text-slate-400">Nothing yet.</p> : null}
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onOpen={openNotification} />
        ))}
      </div>
    </div>
  );
}
