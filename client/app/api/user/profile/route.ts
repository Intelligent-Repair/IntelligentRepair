import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// GET - Get user profile
export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabase();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user data from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, national_id, first_name, last_name, phone, email, role, created_at")
      .eq("id", user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: "Failed to fetch user profile", details: userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

// PUT - Update user profile
export async function PUT(req: Request) {
  try {
    const supabase = await createServerSupabase();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { national_id, first_name, last_name, phone, email } = body;

    // Validate required fields
    if (!phone || !email) {
      return NextResponse.json(
        { error: "Phone and email are required" },
        { status: 400 }
      );
    }

    // Check if email is being changed and if it's already taken
    const { data: currentUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (email !== currentUser?.email) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }

      // Update email in auth.users table
      const admin = createAdminClient();
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(
        user.id,
        { email }
      );

      if (updateAuthError) {
        return NextResponse.json(
          { error: "Failed to update email", details: updateAuthError.message },
          { status: 500 }
        );
      }
    }

    // Update user data in users table
    const updateData: any = {
      phone,
      email,
    };

    if (national_id !== undefined) updateData.national_id = national_id || null;
    if (first_name !== undefined) updateData.first_name = first_name || null;
    if (last_name !== undefined) updateData.last_name = last_name || null;

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update profile", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

