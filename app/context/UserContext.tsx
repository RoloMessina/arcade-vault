'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ProfileRow } from '@/lib/supabase/types';

interface UserContextValue {
  /** `profiles.username` de la sesión; `null` si es invitado. */
  user: string | null;
  /** `auth.uid()` de la sesión; `null` si es invitado. */
  userId: string | null;
  /** `true` hasta resolver la sesión inicial (y su perfil). */
  loading: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  userId: null,
  loading: true,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  // id de la sesión de Supabase; `undefined` = aún sin resolver.
  const [sessionId, setSessionId] = useState<string | null | undefined>(
    undefined,
  );
  // perfil cargado y el id al que pertenece.
  const [profile, setProfile] = useState<Pick<
    ProfileRow,
    'id' | 'username'
  > | null>(null);

  // Sesión: lectura inicial + cambios (login, logout, OAuth, otras pestañas).
  useEffect(() => {
    try {
      localStorage.removeItem('av_user'); // clave del login simulado anterior
    } catch {}

    supabase.auth.getSession().then(({ data }) => {
      setSessionId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Perfil: se carga aparte para no hacer peticiones dentro del callback de auth.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, username')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data ?? { id: sessionId, username: '' });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionId]);

  const hasProfile = !!sessionId && profile?.id === sessionId && !!profile.username;
  const loading =
    sessionId === undefined || (!!sessionId && profile?.id !== sessionId);

  async function signOut() {
    await supabase.auth.signOut();
    setSessionId(null);
    setProfile(null);
  }

  // Una sesión sin perfil se trata como invitado.
  const value: UserContextValue = {
    user: hasProfile ? profile.username : null,
    userId: hasProfile ? sessionId : null,
    loading,
    signOut,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
