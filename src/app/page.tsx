import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import HomePageClient from "./HomePageClient";

export default async function HomePage() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user) {
    redirect("/map");
  }

  return <HomePageClient />;
}
