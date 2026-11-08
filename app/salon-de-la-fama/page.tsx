import type { Metadata } from "next";
import HallOfFame from "@/components/HallOfFame";

export const metadata: Metadata = { title: "Salón de la Fama · ARCADE VAULT" };

export default function SalonPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="neon-yellow mb-2 text-center font-pixel text-xl leading-snug sm:text-3xl">SALÓN DE LA FAMA</h1>
      <p className="mb-10 text-center text-[var(--muted)]">Los diez mejores jugadores de cada juego.</p>
      <HallOfFame />
    </section>
  );
}
