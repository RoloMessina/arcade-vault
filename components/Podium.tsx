"use client";

import { buildBoard, fmtDate, fmtScore, type Game } from "@/lib/games";
import { useSavedScores } from "@/lib/store";

const SLOTS = [
  { clase: "gold", puesto: "01" },
  { clase: "silver", puesto: "02" },
  { clase: "bronze", puesto: "03" },
] as const;

/** Top 3 del juego. Usa el mismo ranking que la tabla, así que ambos siempre coinciden. */
export default function Podium({ game }: { game: Game }) {
  const saved = useSavedScores();
  const top = buildBoard(game, saved, 3);

  return (
    // key: reinicia la animación de entrada al cambiar de juego
    <ol className="podium" key={game.id} aria-label={`Podio de ${game.titulo}`}>
      {SLOTS.map((s, i) => {
        const e = top[i];
        if (!e) return null;
        return (
          <li key={s.clase} className={`podium-slot ${s.clase}`}>
            {i === 0 && <p className="podium-crown">Campeón</p>}
            <p className="rank-num">{s.puesto}</p>
            <p className="name">{e.name}</p>
            <p className="score tabular-nums">{fmtScore(e.score)}</p>
            <p className="date">{fmtDate(e.date)}</p>
          </li>
        );
      })}
    </ol>
  );
}
