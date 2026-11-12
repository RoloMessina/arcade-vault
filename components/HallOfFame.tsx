"use client";

import { useState } from "react";
import Leaderboard from "./Leaderboard";
import Podium from "./Podium";
import { fmtScore, GAMES } from "@/lib/games";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import { useGuestBest, useUser } from "@/lib/store";

/** `boards`: top 100 de cada juego (Supabase), una fila por jugador y ordenadas por puntuación. */
export default function HallOfFame({ boards }: { boards: Record<string, LeaderboardEntry[]> }) {
  const [id, setId] = useState(GAMES[0].id);
  const game = GAMES.find((g) => g.id === id)!;
  const user = useUser();
  const guest = useGuestBest();
  const board = boards[id] ?? [];

  // Con cuenta: su fila del ranking (solo si está en el top 100; fuera no hay marca ni puesto).
  // Invitado: su marca local, sin puesto.
  let mine: number | null = null;
  let rank: number | null = null;
  if (user && !user.guest) {
    const i = board.findIndex((s) => s.name === user.name);
    if (i >= 0) {
      mine = board[i].score;
      rank = i + 1;
    }
  } else if (user) {
    mine = guest[id] ?? null;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Juegos">
        {GAMES.map((g) => (
          <button key={g.id} role="tab" className="chip" aria-selected={g.id === id} onClick={() => setId(g.id)}>
            {g.titulo}
          </button>
        ))}
      </div>

      {user && (
        <div className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4" style={{ "--accent": "var(--magenta)" } as React.CSSProperties}>
          <div>
            <p className="font-pixel text-[0.6rem] text-[var(--magenta)]">TU MEJOR MARCA</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {user.name} · {game.titulo}
              {rank ? ` · puesto #${rank}` : ""}
            </p>
          </div>
          <p className="neon-yellow font-pixel text-lg tabular-nums">{mine === null ? "—" : fmtScore(mine)}</p>
        </div>
      )}

      <Podium game={game} entries={board} />

      <div className="panel p-2 sm:p-4" style={{ "--accent": game.accent } as React.CSSProperties}>
        <Leaderboard game={game} entries={board.slice(0, 10)} />
      </div>
    </>
  );
}
