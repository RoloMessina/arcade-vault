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

- `/frontend-design` — úsalo siempre para diseñar la interfaz de usuario.
- `/spec` — escribe un spec en `specs/NN-<slug>.md` sección por sección (template en `.claude/skills/spec/template.md`).
- `/spec-impl NN` — implementa un spec paso a paso.
- `/spec-impl-game NN` — propio (`.claude/skills/spec-impl-game/`). Igual que `/spec-impl` y al terminar lanza **en secuencia** `skin-designer` y luego `mobile-porter` sobre el juego nuevo (nunca en paralelo: tocan los mismos archivos).
- `/add-game <references/started-games/NN-name | descripción>` — propio (`.claude/skills/add-game/`). Genera **solo el spec** de un juego canvas nuevo; se implementa después con `/spec-impl-game`.

`spec` y `spec-impl` (de `Klerith/fernando-skills`, ver `skills-lock.json`) existen como copias reales en `.agents/skills/`, `.claude/skills/` y `.claude/agents/` (los symlinks se rompían). Si se editan, mantener las copias sincronizadas.

## Agentes

Definición completa de cada uno en su archivo `.claude/agents/<nombre>.md` (todos modelo sonnet).

- `game-planner` — decide qué juego canvas nuevo añadir (puntúa candidatos, no repite sugerencias; memoria en `.claude/agent-memory/game-planner/`, to-do en `references/templates/game-sugestion-to_do.md`).
- `game-jam` — recibe un tema y genera tres specs `Borrador` en `specs/game-jam/<game-id>/`. Solo escribe specs.
- `skin-designer` — audita y configura skins (`classic`, `neon`, `retro`, legibles en modo oscuro). Estado en `references/templates/games-with-themes.md`.
- `mobile-porter` — audita/arregla la web en navegador móvil (sin scroll horizontal, `TouchControls`, canvas escalado, áreas táctiles ≥ 44 px). Estado en `references/templates/mobile-status.md`.
- `game-performance-booster` — recibe el id de un juego y audita/optimiza su rendimiento (game loop, coste de canvas, re-renders). Solo toca rendimiento.

Flujo para un juego nuevo: `game-planner` o `game-jam <tema>` → `/add-game` (o copiar el spec de la jam a `specs/`) → `/spec-impl-game NN`.

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
- `/games/[id]/play` — reproductor genérico; además existen play-pages específicas: `/games/{asteroids,tetris,arkanoid,snake,frogger}/play`
- `/hall-of-fame` (`page.tsx` + `HallOfFameClient.tsx`) — leaderboards por juego (tabs automáticas por cada fila de `games`)
- `/about` — página About con formulario de contacto
- `/auth` (`page.tsx` + `AuthForm.tsx`) — registro y login con Supabase Auth: email + contraseña, Google y GitHub; "jugar como invitado"
- `/auth/callback` (`route.ts`) — intercambia el `code` de OAuth por la sesión y redirige a `/`
- `/api/contact` (`route.ts`) — POST que envía el mensaje vía Resend

### Juegos (`components/games/`)

`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame`, `FroggerGame` (más `TouchControls`, controles táctiles compartidos) — componentes canvas con HUD en React (`score`, `lives`, `level`, `paused`, `over`), prop `paused`, limpieza de listeners en el `useEffect`, y modal de guardado de score al terminar. `AsteroidsGame` es la referencia de patrón. Assets en `public/` (sprites, mp3). Fuentes originales en `references/started-games/` y maquetas en `references/templates/`.

### Datos y estado

- `lib/supabase/{client,server,types}.ts` — clientes browser/server (`createClient` async con `cookies()`), y tipos `GameRow` / `ScoreRow` (`scores`: `game_id`, `player_name`, `score`, `user_id`).
- `app/context/UserContext.tsx` — `UserProvider`/`useUser`: lee la sesión de Supabase (`getSession` + `onAuthStateChange`) y expone `{ user (profiles.username), userId (auth.uid()), loading, signOut }`. Sin sesión (o sesión sin perfil) = invitado. Las play-pages guardan el score con `user_id: userId` y el username bloqueado; el invitado usa nombre libre (`localStorage` `av_player_name`) y `user_id: null`.
- Tabla `profiles` (`id` → `auth.users`, `username` único `^[A-Z0-9_]{3,10}$`), creada por el trigger `handle_new_user` al registrarse (migraciones en `supabase/migrations/`). RLS de `scores`: el INSERT exige `user_id` nulo o igual a `auth.uid()`.
- `app/data/` — datos locales estáticos (legado de las primeras specs; la fuente real es Supabase).
- `components/Nav.tsx` — navegación global. `demos/Demo.tsx` — demo auxiliar.

## Specs (`specs/`)

| #   | Spec                                  | Estado      |
| --- | ------------------------------------- | ----------- |
| 01  | MVP visual screens                    | Implementado |
| 02  | Home landing page                     | Aprobado    |
| 03  | About page + contacto con Resend      | Aprobado    |
| 04  | Integración de Supabase               | Implementado |
| 05  | Juego Asteroids                       | Implementado |
| 06  | Tabla `games` + leaderboard Supabase  | Implementado |
| 07  | Juego Tetris                          | Implementado |
| 08  | Juego Arkanoid                        | Implementado |
| 09  | Juego Snake                           | Implementado |
| 12  | Juego Frog Crossing (Frogger)         | Obsoleto (sustituido por 13) |
| 13  | Juego Frogger (spec de game-jam)      | Implementado (3 criterios de guardado de score pendientes de verificar a mano) |
| 14  | Autenticación con Supabase Auth       | Implementado (4 criterios sin cerrar, ver el spec) |

Specs de game-jam en `specs/game-jam/<game-id>/` (estado `Borrador`, aún sin pasar a `specs/`): `deep-dive` (10), `fish-feast` (11), `lily-leap` (13), `tongue-tide` (14, número ya usado por el spec 14 de auth: renumerar al copiar); `frog-crossing` (12) y `frogger` (`01-frogger-core.md`, `Propuesto`) ya cubiertos por el spec 13.

Para añadir un juego: `/add-game` → genera `specs/NN-<id>-game.md` (estado `Borrador`) → revisar y pasar a `Aprobado` → `/spec-impl-game NN` (o `/spec-impl NN` si no se quieren skins/móvil automáticos). Las tablas `games`/`scores` ya existen; cada juego nuevo solo requiere un INSERT en `games`.
