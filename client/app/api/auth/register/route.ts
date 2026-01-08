import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      role,
      first_name,
      last_name,
      phone,
      national_id,
      garage_name,
      license_number,
      address,
    } = body;

    const admin = createAdminClient();
    const supabase = await createServerSupabase();

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Auth error" },
        { status: 400 }
      );
    }

    const userId = authUser.user.id;

    const { error: userInsertError } = await supabase
      .from("users")
      .insert({
        id: userId,
        email,
        phone,
        role,
        first_name: role === "driver" ? first_name : null,
        last_name: role === "driver" ? last_name : null,
        national_id: role === "driver" ? national_id : null,
      });

    if (userInsertError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: userInsertError.message },
        { status: 400 }
      );
    }

    if (role === "garage") {
      const { error: garageError } = await supabase
        .from("garages")
        .insert({
          owner_user_id: userId,
          garage_name,
          license_number,
          phone,
          email,
          address: address || null,
        });

      if (garageError) {
        await supabase.from("users").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);

        return NextResponse.json(
          { error: garageError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      role,
      message: "Registration successful",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}