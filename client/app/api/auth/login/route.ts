import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "מייל וסיסמה נדרשים" },
        { status: 400 }
      );
    }

    // For login, we need to use a regular client with anon key to authenticate
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sign in with password
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Fetch user's role from users table using admin client
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, message: "שגיאה בטעינת פרטי המשתמש" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: userData.role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "שגיאה בשרת", error: err.message },
      { status: 500 }
    );
  }
}

