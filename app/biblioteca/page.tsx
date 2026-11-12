import GameLibrary from "@/components/GameLibrary";
import { getRecords } from "@/lib/leaderboard";

export default async function Biblioteca() {
  const records = await getRecords();
  return (
    <>
      <header className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </header>
      <GameLibrary records={records} />
    </>
  );
}
