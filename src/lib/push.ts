import webpush, { PushSubscription } from "web-push";
import { createServiceClient } from "@/lib/supabase/server";
import { NotificationType } from "@/lib/types";

type PushNotificationParams = {
  user_id: string;
  type: NotificationType;
  actor_id?: string;
  pin_id?: string;
  comment_id?: string;
  group_id?: string;
};

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) {
    return true;
  }

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

function getPushMessage(type: NotificationType) {
  const base = {
    icon: "/icon-192.png",
    url: "/notifications",
  };

  switch (type) {
    case "comment_on_pin":
      return { ...base, title: "New comment", body: "Someone commented on your pin." };
    case "reply_to_comment":
      return { ...base, title: "New reply", body: "Someone replied to your comment." };
    case "co_comment":
      return { ...base, title: "Pin activity", body: "New activity on a pin you commented on." };
    case "new_group_pin":
      return { ...base, title: "Group update", body: "A new pin was posted in your group." };
    case "group_join":
      return { ...base, title: "Group member joined", body: "Someone joined your group." };
    case "pin_activated":
      return { ...base, title: "Pin activated", body: "Your pin is now active." };
    default:
      return { ...base, title: "Notification", body: "You have a new notification." };
  }
}

export async function sendPushNotification(params: PushNotificationParams) {
  if (!ensureVapid()) {
    return;
  }

  const supabase = createServiceClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", params.user_id);

  if (!subscriptions?.length) {
    return;
  }

  const message = getPushMessage(params.type);

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(row.subscription as PushSubscription, JSON.stringify(message));
    } catch (error: unknown) {
      const maybeStatus = error as { statusCode?: number };
      if (maybeStatus.statusCode === 404 || maybeStatus.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id);
      }
    }
  }
}
