import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Sign out
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      return NextResponse.json(
        { success: false, message: "שגיאה בהתנתקות", error: signOutError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "שגיאה בשרת", error: err.message },
      { status: 500 }
    );
  }
}

