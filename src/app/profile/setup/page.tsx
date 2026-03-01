import { redirect } from "next/navigation";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import ProfileSetupClient from "./ProfileSetupClient";

export default async function ProfileSetupPage() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id").eq("id", user.id).maybeSingle();

  if (profile) {
    redirect("/map");
  }

  return <ProfileSetupClient userId={user.id} />;
}
