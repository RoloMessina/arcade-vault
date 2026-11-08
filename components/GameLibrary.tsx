"use client";

import Link from "next/link";
import { useState } from "react";
import { Cover } from "./Sprite";
import { buildBoard, CATEGORIAS, fmtScore, GAMES, type Game } from "@/lib/games";
import { useGuestBest, useSavedScores } from "@/lib/store";

function GameCard({ game, record }: { game: Game; record: number }) {
  const tilt = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--ry", `${x * 8}deg`);
    e.currentTarget.style.setProperty("--rx", `${-y * 8}deg`);
  };
  const reset = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--ry", "0deg");
    e.currentTarget.style.setProperty("--rx", "0deg");
  };

  return (
    <article
      className="panel game-card flex flex-col"
      style={{ "--accent": game.accent } as React.CSSProperties}
      onMouseMove={tilt}
      onMouseLeave={reset}
    >
      <Link href={`/juego/${game.id}`} aria-label={`Ver ${game.titulo}`} tabIndex={-1}>
        <Cover game={game} />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-pixel text-sm leading-relaxed" style={{ color: game.accent, textShadow: `0 0 10px ${game.accent}` }}>
            {game.titulo}
          </h3>
          <span className="shrink-0 border border-[var(--line)] px-2 py-1 text-[0.65rem] uppercase text-[var(--muted)]">
            {game.categoria}
          </span>
        </div>
        <p className="flex-1 text-[0.95rem] text-[var(--fg)]/85">{game.corta}</p>
        <div className="border-2 border-dashed border-[var(--yellow)]/50 px-3 py-2">
          <p className="font-pixel text-[0.5rem] text-[var(--muted)]">MEJOR PUNTUACIÓN</p>
          <p className="neon-yellow mt-1 font-pixel text-sm tabular-nums">{fmtScore(record)}</p>
        </div>
        <Link
          href={`/juego/${game.id}`}
          className="btn w-full"
          style={{ "--c": game.accent } as React.CSSProperties}
        >
          Jugar
        </Link>
      </div>
    </article>
  );
}

export default function GameLibrary() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const saved = useSavedScores();
  const guest = useGuestBest();

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = GAMES.filter(
    (g) => (cat === "Todos" || g.categoria === cat) && norm(`${g.titulo} ${g.categoria}`).includes(norm(q.trim())),
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16" aria-labelledby="biblioteca">
      <h2 id="biblioteca" className="sr-only">
        Biblioteca de juegos
      </h2>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <label htmlFor="buscar" className="sr-only">
            Buscar juegos
          </label>
          <input
            id="buscar"
            type="search"
            className="field"
            placeholder="Buscar juego por nombre o categoría..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {CATEGORIAS.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="font-pixel text-sm leading-loose text-[var(--magenta)]">SIN RESULTADOS</p>
          <p className="mt-3 text-[var(--muted)]">Ningún juego coincide con tu búsqueda. Prueba con otro nombre.</p>
          <button
            className="btn btn-sm mt-6"
            onClick={() => {
              setQ("");
              setCat("Todos");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const record = Math.max(buildBoard(g, saved, 1)[0].score, guest[g.id] ?? 0);
            return <GameCard key={g.id} game={g} record={record} />;
          })}
        </div>
      )}
    </section>
  );
}
