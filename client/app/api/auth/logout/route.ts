import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (err) {
    return NextResponse.json(
      { error: "Logout error", details: String(err) },
      { status: 500 }
    );
  }
}
