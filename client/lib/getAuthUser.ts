import { createServerSupabase } from "@/lib/supabaseServer";

export async function getAuthUser() {
  try {
    const supabase = await createServerSupabase();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    return user;
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return null;
  }
}
