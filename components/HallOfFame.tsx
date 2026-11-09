"use client";

import { useState } from "react";
import Leaderboard from "./Leaderboard";
import Podium from "./Podium";
import { buildBoard, fmtScore, GAMES } from "@/lib/games";
import { useGuestBest, useSavedScores, useUser } from "@/lib/store";

export default function HallOfFame() {
  const [id, setId] = useState(GAMES[0].id);
  const game = GAMES.find((g) => g.id === id)!;
  const user = useUser();
  const saved = useSavedScores();
  const guest = useGuestBest();

  let mine: number | null = null;
  if (user && !user.guest) {
    const own = saved.filter((s) => s.gameId === id && s.name === user.name).map((s) => s.score);
    if (own.length) mine = Math.max(...own);
  } else if (user) {
    mine = guest[id] ?? null;
  }
  const rank = mine === null || !user || user.guest ? null : buildBoard(game, saved, 1000).findIndex((s) => s.name === user.name && s.score === mine) + 1;

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

      <Podium game={game} />

      <div className="panel p-2 sm:p-4" style={{ "--accent": game.accent } as React.CSSProperties}>
        <Leaderboard game={game} />
      </div>
    </>
  );
}
