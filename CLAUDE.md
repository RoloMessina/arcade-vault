# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play and compete for points. Uses **Spec Driven Design** via the `/spec` and `/spec-impl` skills from `npx skills@latest add Klerith/fernando-skills` (registrados en `skills-lock.json`).

## Stack

- **Next.js 16.2.6** with App Router (`app/` directory) — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19.2.4**
- **Tailwind CSS v4** (PostCSS plugin via `@tailwindcss/postcss`)
- **TypeScript**
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — tablas `games` y `scores`
- **Resend** — envío de emails del formulario de contacto
- **Prettier + ESLint** (flat config, `eslint.config.mjs`)

No test runner is configured yet.

## Commands

```powershell
npm run dev           # servidor de desarrollo
npm run build         # build de producción
npm run lint          # eslint
npm run format        # prettier --write
npm run format:check  # prettier --check
```

## Environment variables

Copiar `.env.template` a `.env.local` y completar:

- `RESEND_API_KEY` — API key de Resend (`/api/contact`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — clientes Supabase
- `SUPABASE_DB_PASSWORD`

Nunca commitear `.env.local`.

## Skills

- Usa siempre `/frontend-design` para diseñar la interfaz de usuario.
- `/spec` — escribe un spec en `specs/NN-<slug>.md` sección por sección (template en `.claude/skills/spec/template.md`).
- `/spec-impl NN` — implementa un spec paso a paso.
- `/add-game <references/started-games/NN-name | descripción>` — skill propio (`.claude/skills/add-game/`, `disable-model-invocation`). Genera **solo el spec** de un juego canvas nuevo (componente, play-page, INSERT en `games`, leaderboard). Luego se implementa con `/spec-impl`.

Los skills `spec` y `spec-impl` viven en `.agents/skills/` y se exponen en `.claude/skills/` (symlinks).

## Hooks y MCP

- **Hook PostToolUse** (`.claude/settings.json`, `Write|Edit|MultiEdit`): ejecuta `.claude/hooks/format-and-lint.sh` → prettier en ts/tsx/js/jsx/json/css/md y `eslint --fix` en ts/tsx/js/jsx. No hace falta formatear a mano.
- **MCP Supabase** (`.mcp.json`, HTTP, habilitado en `settings.local.json`): usar para inspeccionar/modificar la base de datos del proyecto.
- Directorios `.playwright-mcp/` y `.playwright-screenshots/` reservados para pruebas visuales con Playwright.

## Architecture

Uses Next.js **App Router** exclusively — no `pages/` directory. Server Components are the default; mark client components with `"use client"` only when needed. Alias de imports: `@/` (ej. `@/app/context/UserContext`).

### Rutas (`app/`)

- `/` (`page.tsx`) — landing; `RevealObserver.tsx` anima secciones al hacer scroll
- `/games` (`page.tsx` + `GamesGrid.tsx`) — catálogo leído de la tabla `games`
- `/games/[id]` — detalle del juego (dinámico desde Supabase)
- `/games/[id]/play` — reproductor genérico; además existen play-pages específicas: `/games/{asteroids,tetris,arkanoid,snake}/play`
- `/hall-of-fame` (`page.tsx` + `HallOfFameClient.tsx`) — leaderboards por juego (tabs automáticas por cada fila de `games`)
- `/about` — página About con formulario de contacto
- `/auth` — login/registro (por ahora solo nombre de jugador local)
- `/api/contact` (`route.ts`) — POST que envía el mensaje vía Resend

### Juegos (`components/games/`)

`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame` — componentes canvas con HUD en React (`score`, `lives`, `level`, `paused`, `over`), prop `paused`, limpieza de listeners en el `useEffect`, y modal de guardado de score al terminar. `AsteroidsGame` es la referencia de patrón. Assets en `public/` (sprites, mp3). Fuentes originales en `references/started-games/` y maquetas en `references/templates/`.

### Datos y estado

- `lib/supabase/{client,server,types}.ts` — clientes browser/server (`createClient` async con `cookies()`), y tipos `GameRow` / `ScoreRow` (`scores`: `game_id`, `player_name`, `score`, `user_id`).
- `app/context/UserContext.tsx` — `UserProvider`/`useUser` (usuario en `localStorage` key `av_user`; `login`, `signOut`).
- `app/data/` — datos locales estáticos (legado de las primeras specs; la fuente real es Supabase).
- `components/Nav.tsx` — navegación global. `demos/Demo.tsx` — demo auxiliar.

## Specs (`specs/`)

| #   | Spec                                  | Estado      |
| --- | ------------------------------------- | ----------- |
| 01  | MVP visual screens                    | —           |
| 02  | Home landing page                     | —           |
| 03  | About page + contacto con Resend      | —           |
| 04  | Integración de Supabase               | Implementado |
| 05  | Juego Asteroids                       | Implementado |
| 06  | Tabla `games` + leaderboard Supabase  | Implementado |
| 07  | Juego Tetris                          | Implementado |
| 08  | Juego Arkanoid                        | Aprobado (verificar implementación) |
| 09  | Juego Snake                           | Implementado |

Para añadir un juego: `/add-game` → genera `specs/NN-<id>-game.md` (estado `Borrador`) → revisar y pasar a `Aprobado` → `/spec-impl NN`. Las tablas `games`/`scores` ya existen; cada juego nuevo solo requiere un INSERT en `games`.
