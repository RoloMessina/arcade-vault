"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ScoreEntry } from "./games";
import { createClient } from "./supabase/client";

/**
 * Persistencia local mínima.
 * BACKEND: para usuarios autenticados, reemplazar las funciones de escritura por
 * llamadas REST (POST /api/scores) o Supabase (supabase.from("scores").insert(...))
 * y las de lectura por GET /api/scores?game=:id.
 */

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  startAuth();
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
  listeners.forEach((l) => l());
}

function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  return useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
}

/* ---------- Sesión ---------- */

/**
 * Cuenta real: sesión de Supabase Auth (cookies) + `profiles.username`.
 * Invitado: solo en localStorage (`av:user` con `guest: true`), sin usuario en Supabase.
 */
export type User = { name: string; guest: boolean };
const USER_KEY = "av:user";
const NO_USER = null as User | null;

let account: User | null = null;
let authStarted = false;
let authSeq = 0;

function supabaseConfigurado() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

async function applySession(userId: string | null) {
  const seq = ++authSeq;
  if (!userId) {
    if (account) {
      account = null;
      listeners.forEach((l) => l());
    }
    return;
  }
  const { data, error } = await createClient().from("profiles").select("username").eq("id", userId).maybeSingle();
  if (seq !== authSeq) return; // llegó una sesión más reciente
  if (error) console.error("store: no se pudo leer el perfil:", error.message);
  const name = data?.username ?? "JUGADOR";
  if (account?.name === name) return; // p. ej. TOKEN_REFRESHED: nada que actualizar
  account = { name, guest: false };
  listeners.forEach((l) => l());
}

/** Engancha una sola vez la sesión de Supabase al store (solo en el navegador). */
function startAuth() {
  if (authStarted || typeof window === "undefined") return;
  authStarted = true;
  // Las sesiones simuladas anteriores (no invitado) ya no cuentan.
  try {
    const old = JSON.parse(read(USER_KEY) ?? "null") as User | null;
    if (old && !old.guest) write(USER_KEY, null);
  } catch {
    write(USER_KEY, null);
  }
  if (!supabaseConfigurado()) return;
  // INITIAL_SESSION se emite al suscribirse; el callback no debe esperar llamadas a Supabase.
  createClient().auth.onAuthStateChange((_evento, session) => {
    setTimeout(() => void applySession(session?.user.id ?? null), 0);
  });
}

export function useUser() {
  const guest = useStored<User | null>(USER_KEY, NO_USER);
  const cuenta = useSyncExternalStore(
    subscribe,
    () => account,
    () => null,
  );
  return cuenta ?? (guest?.guest ? guest : null);
}

/** Entra como invitado: solo local, sin cuenta ni ranking. */
export function loginGuest() {
  write(USER_KEY, JSON.stringify({ name: "INVITADO", guest: true } satisfies User));
}

export async function logout() {
  if (supabaseConfigurado()) {
    const { error } = await createClient().auth.signOut();
    if (error) console.error("store: signOut falló:", error.message);
  }
  authSeq++;
  account = null;
  write(USER_KEY, null);
}

/* ---------- Puntuaciones globales (usuarios con cuenta) ---------- */

const SCORES_KEY = "av:scores";
const NO_SCORES: ScoreEntry[] = [];

export function useSavedScores() {
  return useStored<ScoreEntry[]>(SCORES_KEY, NO_SCORES);
}

export function saveScore(entry: ScoreEntry) {
  const current = (() => {
    try {
      return JSON.parse(read(SCORES_KEY) ?? "[]") as ScoreEntry[];
    } catch {
      return [];
    }
  })();
  write(SCORES_KEY, JSON.stringify([...current, entry]));
}

/* ---------- Mejor marca local (invitados) ---------- */

const GUEST_KEY = "av:guest-best";
const NO_BEST: Record<string, number> = {};

export function useGuestBest() {
  return useStored<Record<string, number>>(GUEST_KEY, NO_BEST);
}

export function recordGuestBest(gameId: string, score: number) {
  let best: Record<string, number> = {};
  try {
    best = JSON.parse(read(GUEST_KEY) ?? "{}");
  } catch {
    /* vacío */
  }
  if (score > (best[gameId] ?? 0)) write(GUEST_KEY, JSON.stringify({ ...best, [gameId]: score }));
}
