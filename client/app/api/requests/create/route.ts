import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

const supabase = createServerClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Accept both `vehicle_id` and `car_id` for compatibility
    const user_id = body.user_id;
    const vehicle_id = body.vehicle_id ?? body.car_id;
    const problem_description = body.problem_description ?? body.description ?? body.problem;
    const ai_summary = body.ai_summary ?? body.diagnosis ?? null;
    const assigned_garage_id = body.assigned_garage_id ?? null;
    const status = body.status ?? "open";

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id" }, { status: 400 });
    }

    if (!vehicle_id) {
      return NextResponse.json({ success: false, message: "Missing vehicle_id / car_id" }, { status: 400 });
    }

    // Enforce that new requests start as 'open'
    if (status !== "open") {
      return NextResponse.json({ success: false, message: "Invalid status for new request; must be 'open'" }, { status: 400 });
    }

    const insertPayload: any = {
      user_id,
      vehicle_id,
      description: problem_description,
      ai_summary,
      assigned_garage_id,
      status,
    };

    const { data, error } = await supabase.from("requests").insert(insertPayload).select().single();

    if (error) {
      return NextResponse.json({ success: false, message: "Failed to create request", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Request created successfully", request: data });
  } catch (err) {
    return NextResponse.json({ success: false, message: "Server error", error: (err as Error).message }, { status: 500 });
  }
}
