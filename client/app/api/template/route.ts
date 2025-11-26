import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";


export async function GET() {
  // מנסה להביא משתמש אחד מטבלת users
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .limit(1);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error connecting to Supabase",
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Connected to Supabase successfully!",
    data,
  });
}
