import { createServiceClient } from "@/lib/supabase/server";
import { NotificationType } from "@/lib/types";
import { sendPushNotification } from "@/lib/push";

type CreateNotificationParams = {
  user_id: string;
  type: NotificationType;
  actor_id?: string;
  pin_id?: string;
  comment_id?: string;
  group_id?: string;
};

export async function createNotification(params: CreateNotificationParams) {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", params.user_id)
    .maybeSingle();

  const prefs = profile?.notification_prefs as
    | Record<string, { inapp?: boolean; push?: boolean }>
    | undefined;

  if (prefs && prefs[params.type] && prefs[params.type].inapp === false) {
    return;
  }

  await supabase.from("notifications").insert({
    user_id: params.user_id,
    type: params.type,
    actor_id: params.actor_id || null,
    pin_id: params.pin_id || null,
    comment_id: params.comment_id || null,
    group_id: params.group_id || null,
  });

  if (!prefs || prefs[params.type]?.push) {
    await sendPushNotification(params);
  }
}
