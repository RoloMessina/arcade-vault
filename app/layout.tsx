import type { Metadata } from "next";
import { Press_Start_2P, Courier_Prime } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const press = Press_Start_2P({
  variable: "--font-press",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ARCADE VAULT",
  description: "Portal de juegos arcade retro. Inserta una moneda para jugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${press.variable} ${courier.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="vault-bg" aria-hidden="true" />
        <div className="vault-noise" aria-hidden="true" />
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="py-8 text-center text-sm text-[var(--muted)]">
          © 2026 ARCADE VAULT · HECHO CON PÍXELES Y NEÓN · v2.6.0
        </footer>
      </body>
    </html>
  );
}
