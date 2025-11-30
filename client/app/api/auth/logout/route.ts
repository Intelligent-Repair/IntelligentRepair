import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Logout error", details: String(err) },
      { status: 500 }
    );
  }
}

