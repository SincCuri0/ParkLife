"use client";

import { Notification } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

function getText(notification: Notification) {
  const actor = notification.actor?.display_name || "Someone";
  switch (notification.type) {
    case "comment_on_pin":
      return `${actor} commented on your pin`;
    case "reply_to_comment":
      return `${actor} replied to your comment`;
    case "co_comment":
      return `${actor} also commented on a pin`;
    case "new_group_pin":
      return `New pin in ${notification.group?.name || "your group"}`;
    case "group_join":
      return `${actor} joined ${notification.group?.name || "your group"}`;
    case "pin_activated":
      return "Your pin is being visited!";
    default:
      return "New notification";
  }
}

export default function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full rounded border px-3 py-2 text-left ${
        notification.is_read ? "border-slate-700 bg-slate-900" : "border-blue-800 bg-blue-950/20"
      }`}
    >
      <p className="text-sm text-slate-100">{getText(notification)}</p>
      <p className="mt-1 text-xs text-slate-400">{relativeTime(notification.created_at)}</p>
    </button>
  );
}
