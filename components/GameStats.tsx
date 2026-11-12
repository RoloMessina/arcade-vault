import { fmtScore, type Game } from "@/lib/games";

/** Franja de estadísticas del detalle. "Mejor global" es el primer puesto del ranking visible. */
export default function GameStats({ game, mejor }: { game: Game; mejor: number }) {
  const estrellas = "★ ".repeat(game.dificultad) + "☆ ".repeat(5 - game.dificultad);

  return (
    <dl className="stat-strip">
      <div>
        <dt>Partidas</dt>
        <dd>{game.partidas}</dd>
      </div>
      <div>
        <dt>Mejor global</dt>
        <dd className="text-[var(--magenta)] tabular-nums" style={{ textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
          {fmtScore(mejor)}
        </dd>
      </div>
      <div>
        <dt>Dificultad</dt>
        <dd
          className="text-[var(--yellow)]"
          style={{ textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
          role="img"
          aria-label={`${game.dificultad} de 5`}
        >
          {estrellas.trim()}
        </dd>
      </div>
    </dl>
  );
}
