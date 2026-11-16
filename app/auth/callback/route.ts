import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Destino del redirect de OAuth (Google / GitHub): intercambia el `code`
// por la sesión (cookies) y vuelve a la home. Si algo falla, vuelve a /auth.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (code && !searchParams.get('error')) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth`);
}
