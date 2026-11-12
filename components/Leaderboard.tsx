"use client";

import { fmtDate, fmtScore, type Game } from "@/lib/games";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import { useUser } from "@/lib/store";

export default function Leaderboard({ game, entries }: { game: Game; entries: LeaderboardEntry[] }) {
  const user = useUser();
  const board = entries;
  const me = user && !user.guest ? user.name : null;

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Mejores puntuaciones de {game.titulo}</caption>
      <thead>
        <tr className="font-pixel text-[0.55rem] sm:text-[0.6rem] text-[var(--cyan)]">
          <th className="p-3 w-16 font-normal">RANGO</th>
          <th className="p-3 font-normal">JUGADOR</th>
          <th className="p-3 text-right font-normal">PUNTUACIÓN</th>
          <th className="p-3 hidden sm:table-cell text-right font-normal">FECHA</th>
        </tr>
      </thead>
      {/* key: reinicia la animación escalonada al cambiar de juego */}
      <tbody key={game.id}>
        {board.map((s, i) => (
          <tr
            key={`${s.name}-${s.score}-${i}`}
            className={`score-row border-t border-[var(--line)] ${i < 3 ? `rank-${i + 1}` : ""} ${
              me && s.name === me ? "me-row" : ""
            }`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <td className="p-2 sm:p-3 font-pixel text-xs">{String(i + 1).padStart(2, "0")}</td>
            <td className="p-2 sm:p-3 font-bold uppercase whitespace-nowrap text-sm">
              {s.name}
              {me && s.name === me && <span className="ml-2 text-[0.65rem] text-[var(--magenta)]">(TÚ)</span>}
            </td>
            <td className="p-3 text-right font-pixel text-xs tabular-nums">{fmtScore(s.score)}</td>
            <td className="p-3 hidden sm:table-cell text-right text-[var(--muted)]">{fmtDate(s.date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
