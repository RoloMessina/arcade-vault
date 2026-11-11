"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { loginGuest } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[A-Z0-9_]{3,20}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ERROR_GENERICO =
  "No se pudo completar la operación. Inténtalo de nuevo más tarde.";

type AuthError = { code?: string; status?: number } | null;

function mensajeDeError(error: AuthError, modo: "entrar" | "crear") {
  if (error?.code === "invalid_credentials")
    return "Correo o contraseña incorrectos.";
  if (error?.code === "email_not_confirmed")
    return "Confirma tu correo antes de entrar.";
  if (error?.code === "weak_password")
    return "La contraseña es demasiado débil.";
  if (error?.code?.includes("rate_limit") || error?.status === 429)
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return modo === "crear"
    ? "No se pudo crear la cuenta. Inténtalo de nuevo más tarde."
    : ERROR_GENERICO;
}

function configurado() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export default function AccesoForm() {
  const router = useRouter();
  const errorInicial =
    useSearchParams().get("error") === "auth"
      ? "No se pudo completar el acceso. Inténtalo de nuevo."
      : "";
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState(errorInicial);
  const [cargando, setCargando] = useState(false);
  const [revisaCorreo, setRevisaCorreo] = useState(false);

  const entrarInvitado = () => {
    loginGuest();
    router.push("/");
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;

    const nombre = usuario.trim().toUpperCase();
    const mail = correo.trim();
    if (modo === "crear" && !USERNAME_RE.test(nombre))
      return setError(
        "El usuario debe tener de 3 a 20 caracteres: letras, números o guion bajo.",
      );
    if (!EMAIL_RE.test(mail))
      return setError("Introduce un correo electrónico válido.");
    if (clave.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (!configurado())
      return setError("El servicio de cuentas no está disponible.");

    setError("");
    setCargando(true);
    try {
      const supabase = createClient();

      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: mail,
          password: clave,
        });
        if (error) return setError(mensajeDeError(error, "entrar"));
        router.push("/");
        router.refresh();
        return;
      }

      const { data: libre, error: errorRpc } = await supabase.rpc(
        "username_disponible",
        { nombre },
      );
      if (errorRpc) {
        console.error("acceso: username_disponible falló:", errorRpc.message);
        return setError(ERROR_GENERICO);
      }
      if (!libre) return setError("ESE USUARIO YA EXISTE.");

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password: clave,
        options: {
          data: { username: nombre },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) return setError(mensajeDeError(error, "crear"));
      if (data.session) {
        // Confirmación de correo desactivada en el proyecto: ya hay sesión.
        router.push("/");
        router.refresh();
        return;
      }
      setRevisaCorreo(true);
    } catch (err) {
      console.error("acceso: error inesperado:", err);
      setError(ERROR_GENERICO);
    } finally {
      setCargando(false);
    }
  };

  const social = async (provider: "google" | "github") => {
    if (cargando) return;
    if (!configurado())
      return setError("El servicio de cuentas no está disponible.");
    setError("");
    setCargando(true);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        console.error("acceso: signInWithOAuth falló:", error.message);
        setError(ERROR_GENERICO);
        setCargando(false);
      }
      // Si no hay error el navegador navega al proveedor.
    } catch (err) {
      console.error("acceso: error inesperado:", err);
      setError(ERROR_GENERICO);
      setCargando(false);
    }
  };

  if (revisaCorreo) {
    return (
      <section className="grid flex-1 place-items-center px-4 py-12">
        <div
          className="panel w-full max-w-md p-6 text-center sm:p-8"
          role="status"
        >
          <Logo />
          <h1 className="font-pixel mt-6 text-sm uppercase text-[var(--cyan)]">
            Revisa tu correo
          </h1>
          <p className="mt-4 text-sm">
            Te enviamos un enlace de confirmación a{" "}
            <strong className="break-all">{correo.trim()}</strong>. Ábrelo para
            activar tu cuenta y entrar.
          </p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Si no lo ves, mira en la carpeta de spam.
          </p>
          <button
            className="btn btn-yellow mt-6 w-full"
            onClick={() => {
              setRevisaCorreo(false);
              setModo("entrar");
              setClave("");
            }}
          >
            Volver a iniciar sesión
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid flex-1 place-items-center px-4 py-12">
      <div className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-8 text-center">
          <Logo />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Acceso al sistema · v2.6
          </p>
        </div>

        <div
          className="mb-6 grid grid-cols-2 gap-2"
          role="tablist"
          aria-label="Acceso"
        >
          {(
            [
              ["entrar", "Iniciar sesión"],
              ["crear", "Crear cuenta"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={modo === k}
              className="chip !py-3"
              onClick={() => {
                setModo(k);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          {modo === "crear" && (
            <div>
              <label className="label" htmlFor="usuario">
                Usuario
              </label>
              <input
                id="usuario"
                className="field"
                autoComplete="username"
                maxLength={20}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="correo">
              Correo electrónico
            </label>
            <input
              id="correo"
              type="email"
              className="field"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="clave">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              className="field"
              autoComplete={
                modo === "crear" ? "new-password" : "current-password"
              }
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-[var(--magenta)]">
              ⚠ {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-yellow w-full"
            disabled={cargando}
          >
            {cargando
              ? "Procesando…"
              : modo === "entrar"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--line)]" />O
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn btn-sm"
            disabled={cargando}
            onClick={() => social("google")}
          >
            Google
          </button>
          <button
            className="btn btn-sm"
            disabled={cargando}
            onClick={() => social("github")}
          >
            GitHub
          </button>
        </div>

        <button
          className="btn btn-magenta mt-4 w-full"
          disabled={cargando}
          onClick={entrarInvitado}
        >
          Jugar como invitado
        </button>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Como invitado, tus puntuaciones no se guardan en el Salón de la Fama.
        </p>
        <p className="mt-5 text-center text-[0.7rem] uppercase tracking-[0.1em] text-[var(--muted)]">
          Al entrar aceptas los términos del Salón Arcade
        </p>
      </div>
    </section>
  );
}
