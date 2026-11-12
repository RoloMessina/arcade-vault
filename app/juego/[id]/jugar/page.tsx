import { Suspense } from "react";
import { notFound } from "next/navigation";
import Player from "@/components/Player";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

// `params` se lee dentro de <Suspense>: así el shell estático no depende de la URL (Next 16, Cache Components).
async function JugarContenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();
  return <Player game={game} />;
}

export default function JugarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p
          className="mx-auto w-full max-w-6xl px-4 py-10 font-pixel text-xs text-[var(--cyan)]"
          role="status"
        >
          CARGANDO…
        </p>
      }
    >
      <JugarContenido params={params} />
    </Suspense>
  );
}
