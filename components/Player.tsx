"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fmtScore, type Game } from "@/lib/games";
import { recordGuestBest, saveScore, useUser } from "@/lib/store";

/**
 * Protocolo con el juego (iframe sandbox):
 *   juego -> portal: { type: "arcade:state", score, lives, level }
 *                    { type: "arcade:gameover", score }
 *   portal -> juego: { type: "arcade:pause" } | { type: "arcade:resume" }
 * Para cargar otro juego HTML basta con apuntar `src` a su archivo y emitir esos mensajes.
 */

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v < text.length ? v + 1 : v)), 70);
    return () => clearInterval(t);
  }, [text]);
  return (
    <span className="caret" role="status">
      {text.slice(0, n)}
    </span>
  );
}

export default function Player({ game }: { game: Game }) {
  const user = useUser();
  const frame = useRef<HTMLIFrameElement>(null);
  const [run, setRun] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // El iframe solo se crea en el cliente: si viniera en el HTML del servidor, podría cargar
  // antes de la hidratación y su `onLoad` se perdería (carga infinita).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({ score: 0, lives: game.vidas, level: 1 });
  const [final, setFinal] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const name = user?.name ?? "INVITADO";
  const canSave = !!user && !user.guest;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; score?: number; lives?: number; level?: number };
      if (d?.type === "arcade:state") {
        setHud({ score: d.score ?? 0, lives: d.lives ?? 0, level: d.level ?? 1 });
      } else if (d?.type === "arcade:gameover") {
        const s = d.score ?? 0;
        setHud((h) => ({ ...h, score: s, lives: 0 }));
        setFinal(s);
        if (!user || user.guest) recordGuestBest(game.id, s); // marca local del invitado
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [game.id, user]);

  const post = (type: string) => frame.current?.contentWindow?.postMessage({ type }, "*");

  const togglePause = () => {
    post(paused ? "arcade:resume" : "arcade:pause");
    setPaused((p) => !p);
  };

  const restart = useCallback(() => {
    setRun((r) => r + 1);
    setLoaded(false);
    setPaused(false);
    setFinal(null);
    setSaved(false);
    setHud({ score: 0, lives: game.vidas, level: 1 });
  }, [game.vidas]);

  const guardar = () => {
    if (final === null) return;
    // BACKEND: POST /api/scores { gameId, score } o supabase.from("scores").insert(...)
    saveScore({ gameId: game.id, name, score: final, date: new Date().toISOString().slice(0, 10) });
    setSaved(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-3 py-4 sm:px-4">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-3 sm:p-4" style={{ "--accent": game.accent } as React.CSSProperties}>
        <div className="hud text-[var(--muted)]">
          JUGADOR
          <b className="!text-[var(--cyan)]">{name}</b>
        </div>
        <div className="hud text-[var(--muted)]" aria-live="off">
          PUNTUACIÓN
          <b className="tabular-nums">{fmtScore(hud.score)}</b>
        </div>
        <div className="hud text-[var(--muted)]">
          VIDAS
          <b>{hud.lives}</b>
        </div>
        <div className="hud text-[var(--muted)]">
          NIVEL
          <b>{hud.level}</b>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-yellow btn-sm" onClick={togglePause} disabled={final !== null || !loaded}>
            {paused ? "Seguir" : "Pausa"}
          </button>
          <Link href={`/juego/${game.id}`} className="btn btn-magenta btn-sm">
            Salir
          </Link>
        </div>
      </div>

      <div className="crt-bezel">
        <div className="crt-screen">
          {mounted && (
          <iframe
            key={run}
            ref={frame}
            title={`Juego: ${game.titulo}`}
            src={`/games/${game.archivo}?game=${game.id}&titulo=${encodeURIComponent(game.titulo)}&c=${encodeURIComponent(game.accent)}&vidas=${game.vidas}`}
            sandbox="allow-scripts"
            onLoad={() => {
              setLoaded(true);
              frame.current?.focus();
            }}
          />
          )}
          {!loaded && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black">
              <div className="scan-wipe" />
              <div className="relative text-center">
                <div className="loader" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <span key={i} style={{ "--i": i } as React.CSSProperties} />
                  ))}
                </div>
                <p className="mt-5 font-pixel text-xs text-[var(--cyan)]" role="status">
                  CARGANDO...
                </p>
              </div>
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/70">
              <p className="neon-yellow font-pixel text-lg">PAUSA</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between px-2">
          <span className="font-pixel text-[0.55rem] tracking-widest text-[var(--muted)]">{game.titulo.toUpperCase()}</span>
          <span className="crt-led" aria-hidden="true" />
        </div>
      </div>
      <p className="text-center text-sm text-[var(--muted)]">Controles: flechas o WASD · en móvil, desliza o toca la pantalla.</p>

      {final !== null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="fin">
          <div className="panel w-full max-w-md p-6 text-center sm:p-8" style={{ "--accent": "var(--magenta)" } as React.CSSProperties}>
            <h2 id="fin" className="neon-magenta font-pixel text-xl leading-snug sm:text-2xl">
              FIN DEL JUEGO
            </h2>
            <p className="mt-6 font-pixel text-[0.6rem] text-[var(--muted)]">PUNTUACIÓN FINAL</p>
            <p className="neon-yellow mt-2 font-pixel text-2xl tabular-nums">{fmtScore(final)}</p>

            <div className="mt-6 min-h-16">
              {saved ? (
                <p className="font-pixel text-xs leading-loose text-[var(--cyan)]">
                  <Typewriter text="PUNTUACIÓN GUARDADA" />
                </p>
              ) : canSave ? (
                <button className="btn btn-yellow w-full" onClick={guardar}>
                  Guardar puntuación
                </button>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  {user ? "Juegas como invitado: tu marca queda solo en este dispositivo." : "No has iniciado sesión: tu marca queda solo en este dispositivo."}{" "}
                  <Link href="/acceso" className="text-[var(--cyan)] underline">
                    Inicia sesión
                  </Link>{" "}
                  para entrar al Salón de la Fama.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button className="btn flex-1" onClick={restart}>
                Jugar de nuevo
              </button>
              <Link href="/" className="btn btn-magenta flex-1">
                Volver al vault
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
