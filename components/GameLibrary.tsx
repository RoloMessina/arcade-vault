"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildBoard, CATEGORIAS, GAMES, type Game } from "@/lib/games";
import { useGuestBest, useSavedScores } from "@/lib/store";

const COLOR_BTN: Record<string, string> = {
  "#ff006e": "var(--magenta)",
  "#f5ff00": "var(--yellow)",
};

function GameCard({ game, record }: { game: Game; record: number }) {
  const router = useRouter();
  const href = `/juego/${game.id}`;

  const tilt = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };
  const reset = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "";
  };

  return (
    <article
      className="av-card"
      onMouseMove={tilt}
      onMouseLeave={reset}
      onClick={() => router.push(href)}
    >
      <div className="av-cover">
        <div className={`cover-bg ${game.portada}`} />
        <div className="label">{game.categoria}</div>
      </div>
      <div className="meta">
        <h3 className="title">{game.titulo}</h3>
        <p className="desc">{game.corta}</p>
        <div className="row">
          <div className="score-badge">
            <span>Mejor puntuación</span>
            <b>{record.toLocaleString("es-ES")}</b>
          </div>
          <Link
            href={href}
            className="av-btn"
            style={{ "--bc": COLOR_BTN[game.accent] ?? "var(--cyan)" } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            JUGAR
          </Link>
        </div>
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
    <section aria-labelledby="biblioteca">
      <h2 id="biblioteca" className="sr-only">
        Biblioteca de juegos
      </h2>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico" aria-hidden="true">
            ⌕
          </span>
          <label htmlFor="buscar" className="sr-only">
            Buscar juegos
          </label>
          <input
            id="buscar"
            type="search"
            placeholder="Buscar un juego por nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="av-chips" role="group" aria-label="Filtrar por categoría">
          {CATEGORIAS.map((c) => (
            <button key={c} className="av-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {list.map((g) => {
          const record = Math.max(g.recordBase, buildBoard(g, saved, 1)[0].score, guest[g.id] ?? 0);
          return <GameCard key={g.id} game={g} record={record} />;
        })}
        {list.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 80, color: "var(--ink-faint)" }}>
            <div className="font-pixel" style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}>
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
            <button
              className="av-btn mt-6"
              onClick={() => {
                setQ("");
                setCat("Todos");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
