import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase sin sesión ni cookies, solo para leer datos de lectura pública
 * (games, scores, leaderboard). No usa `cookies()`, así que no vuelve dinámicas las páginas.
 * Para escribir o leer datos del usuario usa `lib/supabase/server.ts`.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
