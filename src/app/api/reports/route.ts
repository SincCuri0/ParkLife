import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { REPORT_CATEGORIES } from "@/lib/constants";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = new Set(REPORT_CATEGORIES.map((entry) => entry.value));

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
      const pinId = body?.pin_id ? String(body.pin_id) : null;
      const commentId = body?.comment_id ? String(body.comment_id) : null;
      const category = String(body?.category || "");

      if (!pinId && !commentId) {
        return NextResponse.json({ error: "pin_id or comment_id is required" }, { status: 400 });
      }
      if (!VALID_CATEGORIES.has(category as (typeof REPORT_CATEGORIES)[number]["value"])) {
        return NextResponse.json({ error: "Invalid report category" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await service.from("reports").insert({
        reporter_id: user.id,
        pin_id: pinId,
        comment_id: commentId,
        category,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  });
}
