import { cacheLife, cacheTag } from "next/cache";
import { GAMES } from "@/lib/games";
import { createPublicClient } from "@/lib/supabase/public";

export type LeaderboardEntry = {
  gameId: string;
  name: string;
  score: number;
  /** yyyy-mm-dd */
  date: string;
};

type Row = { game_id: string; nombre: string; score: number; fecha: string };

/** Etiqueta de caché de todos los rankings. `guardarPuntuacion` la invalida con `updateTag`. */
export const LEADERBOARD_TAG = "leaderboard";

/** Top de un juego: la mejor puntuación de cada jugador, de mayor a menor. */
export async function getLeaderboard(
  gameId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  // Cache Components (next.config.ts): sin 'use cache' un fetch en la página impide prerenderizarla.
  "use cache";
  cacheLife("hours");
  cacheTag(LEADERBOARD_TAG);

  const { data, error } = await createPublicClient()
    .from("leaderboard")
    .select("game_id, nombre, score, fecha")
    .eq("game_id", gameId)
    // La vista no garantiza orden. Empate: antes la fecha más antigua; después el nombre, para que sea estable.
    .order("score", { ascending: false })
    .order("fecha", { ascending: true })
    .order("nombre", { ascending: true })
    .limit(limit)
    .overrideTypes<Row[], { merge: false }>();

  if (error) {
    console.error(
      `leaderboard: no se pudo leer el ranking de ${gameId}:`,
      error.message,
    );
    throw new Error("No se pudo cargar el ranking");
  }

  return data.map((r) => ({
    gameId: r.game_id,
    name: r.nombre,
    score: r.score,
    date: r.fecha,
  }));
}

/** Top de todos los juegos del catálogo, por id de juego. */
export async function getAllLeaderboards(
  limit = 100,
): Promise<Record<string, LeaderboardEntry[]>> {
  const boards = await Promise.all(
    GAMES.map((g) => getLeaderboard(g.id, limit)),
  );
  return Object.fromEntries(GAMES.map((g, i) => [g.id, boards[i]]));
}

/** Mejor puntuación global por juego. Los juegos sin puntuaciones no aparecen. */
export async function getRecords(): Promise<Record<string, number>> {
  const tops = await Promise.all(GAMES.map((g) => getLeaderboard(g.id, 1)));
  const records: Record<string, number> = {};
  GAMES.forEach((g, i) => {
    if (tops[i][0]) records[g.id] = tops[i][0].score;
  });
  return records;
}
