import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

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
      city,
      garage_name,
      license_number,
      street,
      number,
    } = body;

    console.log("[register] Received registration request:", {
      role,
      email,
      hasPassword: !!password,
      ...(role === "driver"
        ? { first_name, last_name, phone, national_id, city }
        : { 
            garage_name, 
            license_number, 
            phone, 
            city, 
            street, 
            number,
            national_id,
          }),
    });

    const admin = createAdminClient();

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate garage required fields
    if (role === "garage") {
      if (!garage_name || !license_number) {
        return NextResponse.json(
          { error: "Missing required garage fields: garage_name and license_number are required" },
          { status: 400 }
        );
      }
      if (!city) {
        return NextResponse.json(
          { error: "City is required for garage registration" },
          { status: 400 }
        );
      }
      if (!national_id) {
        return NextResponse.json(
          { error: "Owner national ID is required for garage registration" },
          { status: 400 }
        );
      }
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

    const userData = {
      id: userId,
      email,
      phone,
      role,
      first_name: role === "driver" ? first_name : null,
      last_name: role === "driver" ? last_name : null,
      national_id: national_id || null,
      city: city || null,
    };

    console.log("[register] Inserting user data:", userData);

    // Use admin client to bypass RLS for inserting users
    const { data: insertedUser, error: userInsertError } = await admin
      .from("users")
      .insert(userData)
      .select();

    if (userInsertError) {
      console.error("[register] User insert error:", userInsertError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: userInsertError.message, details: userInsertError },
        { status: 400 }
      );
    }

    console.log("[register] User inserted successfully:", insertedUser);

    if (role === "garage") {
      const garageData = {
        owner_national_id: national_id,
        garage_name,
        license_number,
        phone,
        email,
        City: city || null,
        Street: street || null,
        Number: number || null,
      };

      console.log("[register] Inserting garage data:", garageData);

      // Use admin client to bypass RLS for inserting garages
      const { data: insertedGarage, error: garageError } = await admin
        .from("garages")
        .insert(garageData)
        .select();

      if (garageError) {
        console.error("[register] Garage insert error:", garageError);
        // Cleanup: delete user record
        await admin.from("users").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);

        return NextResponse.json(
          { error: garageError.message, details: garageError },
          { status: 400 }
        );
      }

      console.log("[register] Garage inserted successfully:", insertedGarage);
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