import Link from "next/link";

export default function Logo({ size = "md" }: { size?: "md" | "xl" }) {
  const cls =
    size === "xl" ? "text-2xl sm:text-4xl md:text-5xl leading-snug" : "text-[0.7rem] sm:text-sm";
  return (
    <Link href="/" aria-label="ARCADE VAULT, ir a la biblioteca" className={`neon-title flicker ${cls}`}>
      ARCADE<span className="neon-magenta"> VAULT</span>
    </Link>
  );
}
