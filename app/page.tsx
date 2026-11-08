import Logo from "@/components/Logo";
import GameLibrary from "@/components/GameLibrary";

export default function Home() {
  return (
    <>
      <header className="px-4 pb-10 pt-14 text-center sm:pt-20">
        <h1 className="sr-only">ARCADE VAULT</h1>
        <div aria-hidden="true">
          <Logo size="xl" />
        </div>
        <p className="neon-yellow mt-6 font-pixel text-[0.6rem] leading-loose tracking-wider sm:text-xs">
          INSERTA UNA MONEDA PARA JUGAR
          <span className="caret" aria-hidden="true" />
        </p>
      </header>
      <GameLibrary />
    </>
  );
}
