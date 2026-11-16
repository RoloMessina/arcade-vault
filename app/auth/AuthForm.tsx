'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { createClient } from '@/lib/supabase/client';

type Provider = 'google' | 'github';

const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;

export default function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, loading, signOut } = useUser();

  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error')
      ? 'No se pudo completar el acceso con el proveedor. Inténtalo de nuevo.'
      : null,
  );

  // Con sesión iniciada no tiene sentido ver /auth.
  useEffect(() => {
    if (!loading && userId) router.replace('/');
  }, [loading, userId, router]);

  function switchTab(next: 'in' | 'up') {
    setTab(next);
    setError(null);
  }

  async function signUp() {
    const name = username.trim().toUpperCase();
    if (!USERNAME_RE.test(name)) {
      return 'El usuario debe tener de 3 a 10 caracteres: letras, números o guion bajo.';
    }
    if (pass.length < 8) return 'Contraseña débil: mínimo 8 caracteres.';

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', name)
      .maybeSingle();
    if (taken) return 'Ese usuario ya está en uso.';

    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { username: name } },
    });
    if (!err) return null;
    if (err.code === 'user_already_exists') {
      return 'Ese correo ya está registrado.';
    }
    if (err.code === 'weak_password') {
      return 'Contraseña débil: mínimo 8 caracteres.';
    }
    if (err.code === 'email_address_invalid') {
      return 'El correo electrónico no es válido.';
    }
    return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }

  async function signIn() {
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (!err) return null;
    // Mensaje genérico: no revelar si el correo existe.
    if (err.status && err.status >= 500) {
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    }
    return 'Credenciales inválidas.';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = tab === 'up' ? await signUp() : await signIn();
    if (message) {
      setError(message);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function oauth(provider: Provider) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError('No se pudo iniciar el acceso con el proveedor.');
      setBusy(false);
    }
    // Si no hay error, el navegador ya está redirigiendo al proveedor.
  }

  async function playAsGuest() {
    if (busy) return;
    setBusy(true);
    await signOut();
    router.push('/');
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.16em',
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === 'in' ? 'on' : ''}
            onClick={() => switchTab('in')}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === 'up' ? 'on' : ''}
            onClick={() => switchTab('up')}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === 'up' && (
            <div className="field slide-in">
              <label htmlFor="auth-username">Usuario</label>
              <input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                maxLength={10}
                autoComplete="username"
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: '100%', marginTop: 8 }}
          >
            {busy
              ? 'PROCESANDO…'
              : tab === 'in'
                ? 'ENTRAR AL VAULT'
                : 'CREAR Y JUGAR'}
          </button>
        </form>

        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          style={{ width: '100%', marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => oauth('google')}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => oauth('github')}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
