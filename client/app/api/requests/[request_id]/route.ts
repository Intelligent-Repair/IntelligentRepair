import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const supabase = createServerClient();

export async function GET(
  _req: Request,
  { params }: { params: { request_id: string } }
) {
  try {
    const request_id = params.request_id;

    if (!request_id) {
      return NextResponse.json({ success: false, message: "Missing request_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("requests")
      .select(
        `id, description, ai_summary, assigned_garage_id, status, created_at, updated_at, user:users(*), vehicle:vehicles(*)`
      )
      .eq("id", request_id)
      .single();

    if (error) {
      if ((error as any).code === "PGRST116") {
        // record not found (PostgREST specific code may vary)
        return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
      }
      return NextResponse.json({ success: false, message: "Failed to fetch request", error: (error as any).message }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ success: false, message: "Server error", error: (err as Error).message }, { status: 500 });
  }
}
