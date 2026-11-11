import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de la confirmación de correo y de OAuth: cambia el `code` por una sesión.
 * Siempre redirige a una ruta fija (sin parámetro `next`) para evitar redirecciones abiertas.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    console.error(
      "auth/callback: exchangeCodeForSession falló:",
      error.message,
    );
  }

  return NextResponse.redirect(`${origin}/acceso?error=auth`);
}
