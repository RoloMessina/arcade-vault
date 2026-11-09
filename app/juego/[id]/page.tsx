import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Sprite";
import GameStats from "@/components/GameStats";
import Leaderboard from "@/components/Leaderboard";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function JuegoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/" className="btn btn-magenta btn-sm mb-8">
        ← Volver al vault
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="panel overflow-hidden" style={{ "--accent": game.accent } as React.CSSProperties}>
            <Cover game={game} />
          </div>
          <ul className="detail-tags" aria-label="Características">
            {[game.categoria, "1 jugador", "Teclado / táctil", "Retro 1985"].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h1
            className="font-pixel text-2xl leading-snug sm:text-4xl"
            style={{ color: "#fff", textShadow: `0 0 6px #fff, 0 0 18px ${game.accent}, 0 0 44px ${game.accent}` }}
          >
            {game.titulo}
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-[var(--fg)]/90">{game.larga}</p>
          <GameStats game={game} />
          <div>
            <Link
              href={`/juego/${game.id}/jugar`}
              className="btn btn-lg btn-pulse w-full sm:w-auto"
              style={{ "--c": game.accent } as React.CSSProperties}
            >
              ▶ Jugar ahora
            </Link>
          </div>
        </div>

        <aside
          className="panel h-fit p-4 sm:p-6"
          style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
          aria-labelledby="top10"
        >
          <h2 id="top10" className="neon-yellow mb-3 font-pixel text-xs leading-relaxed sm:text-sm">
            MEJORES PUNTUACIONES
          </h2>
          <Leaderboard game={game} />
        </aside>
      </div>
    </section>
  );
}
