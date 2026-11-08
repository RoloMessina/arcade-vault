"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ScoreEntry } from "./games";

/**
 * Persistencia local mínima.
 * BACKEND: para usuarios autenticados, reemplazar las funciones de escritura por
 * llamadas REST (POST /api/scores) o Supabase (supabase.from("scores").insert(...))
 * y las de lectura por GET /api/scores?game=:id.
 */

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
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

export type User = { name: string; guest: boolean };
const USER_KEY = "av:user";
const NO_USER = null as User | null;

export function useUser() {
  return useStored<User | null>(USER_KEY, NO_USER);
}

/** BACKEND: aquí iría supabase.auth.signInWithPassword / OAuth (Google, GitHub). */
export function login(name: string, guest = false) {
  write(USER_KEY, JSON.stringify({ name, guest } satisfies User));
}

export function logout() {
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
