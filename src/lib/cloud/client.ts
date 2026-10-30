import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * The Supabase client, or null when cloud saving isn't configured (the default).
 * Call this from effects and event handlers, not during render, so it never runs on the server.
 *
 * PKCE keeps the magic-link redirect in the query string instead of the hash, which the palette
 * link already uses.
 */
export function getCloud(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client =
    process.env.NEXT_PUBLIC_STORAGE_DRIVER === "supabase" && url && key
      ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
      : null;
  return client;
}

export function cloudEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STORAGE_DRIVER === "supabase" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
