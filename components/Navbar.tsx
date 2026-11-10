"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import { logout, useUser } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/salon-de-la-fama", label: "Salón de la Fama" },
];

/** Contador decorativo: texto fijo, sin lógica. */
function Creditos() {
  return (
    <div className="coin-counter">
      <span className="coin" aria-hidden="true" />
      <span>Créditos · 03</span>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  // En el reproductor se oculta la barra para no distraer.
  if (pathname.endsWith("/jugar")) return null;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/biblioteca"
        ? pathname.startsWith("/biblioteca") || pathname.startsWith("/juego")
        : pathname.startsWith(href);

  const salir = () => {
    logout();
    setMenu(false);
    setOpen(false);
    router.push("/");
  };

  const initial = (user?.name ?? "?").charAt(0).toUpperCase();

  return (
    <>
    <header className="av-nav" role="banner">
        <Link href="/" className="logo" aria-label="ARCADE VAULT, ir al inicio">
          <span className="logo-mark" aria-hidden="true" />
          <span className="logo-text">
            <span className="c">ARCADE</span> <span className="m">VAULT</span>
          </span>
        </Link>

        <nav className="links" aria-label="Principal">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="spacer" />

        <Creditos />
        <div className="auth-btn relative">
          {user ? (
            <>
              <button
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                aria-label="Menú de usuario"
              >
                <span
                  className="grid h-10 w-10 place-items-center border-2 border-[var(--magenta)] font-pixel text-xs text-[var(--magenta)]"
                  style={{ boxShadow: "0 0 12px var(--magenta)" }}
                >
                  {initial}
                </span>
                <span className="text-sm font-bold uppercase tracking-wide">{user.name}</span>
              </button>
              {menu && (
                <div className="panel absolute right-0 top-14 w-52 p-3" style={{ "--accent": "var(--magenta)" } as React.CSSProperties}>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    {user.guest ? "Sesión de invitado" : "Sesión iniciada"}
                  </p>
                  <button className="btn btn-magenta btn-sm w-full" onClick={salir}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link href="/acceso" className="av-btn">
              Iniciar Sesión
            </Link>
          )}
        </div>

        <button
          className="av-btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          ≡
        </button>
    </header>

      {/* Fuera del <header>: su backdrop-blur haría de bloque contenedor de los `fixed` y los recortaría. */}
      {open && <div className="overlay !z-[55]" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className="drawer" data-open={open} aria-hidden={!open} inert={!open}>
        <button className="btn btn-magenta btn-sm self-end" onClick={() => setOpen(false)}>
          Cerrar ✕
        </button>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="nav-link self-start text-lg"
            aria-current={isActive(l.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        <div className="mt-auto space-y-6">
          <Creditos />
          {user ? (
            <div className="space-y-3">
              <p className="text-sm uppercase">{user.name}</p>
              <button className="btn btn-magenta btn-sm w-full" onClick={salir}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <Link href="/acceso" className="btn w-full" onClick={() => setOpen(false)}>
              Iniciar Sesión
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
