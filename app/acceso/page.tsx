"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { login } from "@/lib/store";

export default function AccesoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");

  const entrar = (name: string, guest = false) => {
    login(name, guest);
    router.push("/");
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (usuario.trim().length < 3) return setError("El usuario debe tener al menos 3 caracteres.");
    if (clave.length < 4) return setError("La contraseña debe tener al menos 4 caracteres.");
    if (modo === "crear" && !/^\S+@\S+\.\S+$/.test(correo)) return setError("Introduce un correo electrónico válido.");
    setError("");
    // BACKEND: supabase.auth.signInWithPassword / signUp, o POST /api/auth/login | /api/auth/register
    entrar(usuario.trim().toUpperCase());
  };

  const social = (proveedor: string) => {
    // BACKEND: supabase.auth.signInWithOAuth({ provider: "google" | "github" })
    entrar(`${proveedor}_USER`);
  };

  return (
    <section className="grid flex-1 place-items-center px-4 py-12">
      <div className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-8 text-center">
          <Logo />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2" role="tablist" aria-label="Acceso">
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
          <div>
            <label className="label" htmlFor="usuario">
              Usuario
            </label>
            <input id="usuario" className="field" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </div>
          {modo === "crear" && (
            <div>
              <label className="label" htmlFor="correo">
                Correo electrónico
              </label>
              <input id="correo" type="email" className="field" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="clave">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              className="field"
              autoComplete={modo === "crear" ? "new-password" : "current-password"}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-[var(--magenta)]">
              ⚠ {error}
            </p>
          )}
          <button type="submit" className="btn btn-yellow w-full">
            {modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--line)]" />O<span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-sm" onClick={() => social("GOOGLE")}>
            Google
          </button>
          <button className="btn btn-sm" onClick={() => social("GITHUB")}>
            GitHub
          </button>
        </div>

        <button className="btn btn-magenta mt-4 w-full" onClick={() => entrar("INVITADO", true)}>
          Jugar como invitado
        </button>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">Como invitado, tus puntuaciones no se guardan en el Salón de la Fama.</p>
      </div>
    </section>
  );
}
