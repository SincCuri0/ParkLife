import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    try {
      const authClient = await createServerClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const body = await request.json();
      const subscription = body?.subscription;

      if (!subscription) {
        return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await service.from("push_subscriptions").insert({
        user_id: user.id,
        subscription,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  });
}
