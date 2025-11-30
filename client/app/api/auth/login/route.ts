import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Missing email or password" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json(
        { success: false, message: "User role not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      role: userRecord.role,
      redirect:
        userRecord.role === "garage" ? "/garage" : "/user",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

