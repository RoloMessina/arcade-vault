# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

No hay tests configurados.

## Next.js no estándar

AGENTS.md avisa que esta versión de Next (16.x) tiene cambios incompatibles con lo que conoces. Antes de escribir código, lee la guía relevante en `node_modules/next/dist/docs/`. Ej.: `params` de las páginas es una `Promise` (`await params`), y `LayoutProps<"/">` es un tipo global.

## Skills

Usa fronted-design cuando vas a diseñar y construir interfaz de usuario.

## Idioma

Toda la UI y los textos están en español (ver `prompt-design.md`, la especificación visual y funcional). Estética: fondo `#0a0a0f`, neón cian/magenta/amarillo, fuentes Press Start 2P (`font-pixel`) y Courier Prime. Los estilos viven en clases personalizadas de `app/globals.css` (`.btn`, `.panel`, `.field`, `.chip`, `.crt-*`…), con Tailwind v4 solo como apoyo.

## Arquitectura

- **Rutas** (`app/`): `/` biblioteca, `/juego/[id]` detalle, `/juego/[id]/jugar` reproductor, `/acceso`, `/salon-de-la-fama`. `app/template.tsx` aplica la transición de página.
- **Datos** (`lib/games.ts`): catálogo `GAMES` (único origen de verdad de juegos, sprites pixel-art y colores), puntuaciones semilla deterministas y `buildBoard()` que las mezcla con las guardadas.
- **Estado** (`lib/store.ts`): sesión, puntuaciones y mejor marca de invitado en `localStorage` vía `useSyncExternalStore` (snapshot de servidor `null` para evitar errores de hidratación). Es un backend simulado; los puntos de integración REST/Supabase están marcados con comentarios `BACKEND`.
- **Invitados vs. cuenta**: los invitados solo guardan su marca local (`recordGuestBest`); las puntuaciones con cuenta (`saveScore`) entran en los rankings.
- **Navbar** se oculta en rutas que terminan en `/jugar`.
- **Juegos HTML** (`public/games/`): se cargan en un iframe con `sandbox="allow-scripts"` desde `components/Player.tsx`. Protocolo por `postMessage`: juego→portal `{type:"arcade:state", score, lives, level}` y `{type:"arcade:gameover", score}`; portal→juego `arcade:pause` / `arcade:resume`. Solo `snake.html` es un juego real; el resto usa `demo.html` (minijuego de demostración). El portal valida `e.source` contra el iframe.
