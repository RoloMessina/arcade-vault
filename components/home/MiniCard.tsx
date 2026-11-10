import Link from "next/link";
import { Cover } from "@/components/Sprite";
import type { Game } from "@/lib/games";

export default function MiniCard({ game }: { game: Game }) {
  return (
    <Link href={`/juego/${game.id}`} className="mini-card">
      <div className="mini-cover">
        <Cover game={game} />
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.titulo}</div>
        <div className="mini-cat">{game.categoria}</div>
      </div>
    </Link>
  );
}
