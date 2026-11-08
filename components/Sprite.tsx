import type { Game } from "@/lib/games";

export default function Sprite({ rows, color }: { rows: string[]; color: string }) {
  const h = rows.length;
  const w = rows[0].length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) =>
        [...r].map((c, x) =>
          c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null,
        ),
      )}
    </svg>
  );
}

export function Cover({ game }: { game: Game }) {
  return (
    <div
      className="cover"
      style={{ "--accent": game.accent, "--accent2": game.accent2 } as React.CSSProperties}
    >
      <Sprite rows={game.sprite} color={game.accent} />
    </div>
  );
}
