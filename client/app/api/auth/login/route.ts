import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json(
        { error: "User role not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Login successful",
      role: userRecord.role,
      redirect: userRecord.role === "garage" ? "/garage" : "/user",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
