import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ שגיאה חמורה: המפתחות לא נמצאו ב-env!");
    console.log("URL:", url ? "קיים" : "חסר");
    console.log("KEY:", key ? "קיים" : "חסר");
  }

  return createClient(url!, key!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
