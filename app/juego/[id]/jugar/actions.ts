"use server";

import { updateTag } from "next/cache";
import { LEADERBOARD_TAG } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

export type GuardarResultado = { ok: true } | { ok: false; error: string };

const ERROR_SESION = "Inicia sesión para guardar tu puntuación.";
const ERROR_VALIDACION = "No se pudo guardar: la puntuación no es válida.";
const ERROR_GENERICO = "No se pudo guardar la puntuación. Inténtalo de nuevo.";

/**
 * Guarda la puntuación del usuario con sesión. Solo cuentas reales: los invitados no entran al ranking.
 * La puntuación la envía el navegador, así que aquí solo se valida el rango (0..games.score_max);
 * el anti-trampas fuerte queda fuera de la SPEC 06.
 */
export async function guardarPuntuacion(
  gameId: string,
  score: number,
): Promise<GuardarResultado> {
  if (typeof gameId !== "string" || !Number.isInteger(score) || score < 0) {
    return { ok: false, error: ERROR_VALIDACION };
  }

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: ERROR_SESION };

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("score_max")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError) {
    console.error(
      "guardarPuntuacion: no se pudo leer el juego:",
      gameError.message,
    );
    return { ok: false, error: ERROR_GENERICO };
  }
  if (!game || score > game.score_max)
    return { ok: false, error: ERROR_VALIDACION };

  // `nombre` es obligatorio en la tabla, pero el trigger scores_set_nombre lo sustituye por profiles.username.
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, user_id: auth.user.id, nombre: "", score });
  if (error) {
    console.error("guardarPuntuacion: no se pudo insertar:", error.message);
    return { ok: false, error: ERROR_GENERICO };
  }

  // Invalida los rankings en caché (detalle, salón de la fama y biblioteca) y el usuario ya ve su marca.
  updateTag(LEADERBOARD_TAG);
  return { ok: true };
}
