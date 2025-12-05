import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Export a default instance for backward compatibility
export const supabase = createClientSupabase();

