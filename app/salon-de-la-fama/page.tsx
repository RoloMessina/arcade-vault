import type { Metadata } from "next";
import Link from "next/link";
import HallOfFame from "@/components/HallOfFame";
import { getAllLeaderboards } from "@/lib/leaderboard";

export const metadata: Metadata = { title: "Salón de la Fama · ARCADE VAULT" };

export default async function SalonPage() {
  const boards = await getAllLeaderboards();
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="neon-yellow mb-2 text-center font-pixel text-xl leading-snug sm:text-3xl">SALÓN DE LA FAMA</h1>
      <p className="mb-10 text-center text-[var(--muted)]">Los diez mejores jugadores de cada juego.</p>
      <HallOfFame boards={boards} />
      <div className="mt-10 text-center">
        <Link href="/biblioteca" className="btn btn-lg">
          Volver a la biblioteca
        </Link>
      </div>
    </section>
  );
}
