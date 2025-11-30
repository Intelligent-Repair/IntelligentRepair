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
    const {
      role,
      id_number,
      first_name,
      last_name,
      phone,
      email,
      password,
      garage_name,
      license_number,
    } = body;

    if (!role || !email || !password)
      return NextResponse.json({ success: false, message: "שדות חובה חסרים" }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ success: false, message: "הסיסמה חייבת לפחות 6 תווים" }, { status: 400 });

    if (role === "driver") {
      if (!id_number || !first_name || !last_name || !phone)
        return NextResponse.json({ success: false, message: "חסרים שדות למשתמש פרטי" }, { status: 400 });
    }

    if (role === "garage") {
      if (!garage_name || !license_number || !phone)
        return NextResponse.json({ success: false, message: "חסרים שדות למוסך" }, { status: 400 });
    }

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser.user)
      return NextResponse.json(
        { success: false, message: "שגיאה ביצירת משתמש Auth", error: authError?.message },
        { status: 500 }
      );

    const newUserId = authUser.user.id;

    // Insert into users
    const userData: any = {
      id: newUserId,
      email,
      role,
      phone,
    };

    if (role === "driver") {
      userData.national_id = id_number;
      userData.first_name = first_name;
      userData.last_name = last_name;
    }

    if (role === "garage") {
      userData.national_id = null;
      userData.first_name = null;
      userData.last_name = null;
    }

    const { error: userError } = await supabaseAdmin.from("users").insert(userData);

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ success: false, message: "שגיאה בהכנסת נתוני משתמש", error: userError.message }, { status: 500 });
    }

    if (role === "garage") {
      const { error: garageError } = await supabaseAdmin.from("garages").insert({
        owner_user_id: newUserId,
        garage_name,
        license_number,
        phone,
        email,
      });

      if (garageError) {
        await supabaseAdmin.from("users").delete().eq("id", newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);

        return NextResponse.json({ success: false, message: "שגיאה בהכנסת רשומת מוסך", error: garageError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "ההרשמה הצליחה",
      role,
      user_id: newUserId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "שגיאה בשרת", error: err.message },
      { status: 500 }
    );
  }
}
