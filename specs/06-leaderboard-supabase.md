# SPEC 06 — Leaderboard real y tabla `games` en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 01 (`GAMES`, `Leaderboard`, `Podium`, `HallOfFame`, `Player.tsx`), SPEC 04 (`public.profiles`, clientes `lib/supabase/`, sesión por cookies)
> **Fecha:** 2026-11-12
> **Objetivo:** Guardar las puntuaciones de las cuentas en una tabla `scores` de Supabase (con tabla `games` como referencia) y leer de ahí todos los rankings, sustituyendo `buildBoard` y `av:scores`.

---

## Por qué existe esta spec

La SPEC 04 dejó la identidad real pero las puntuaciones siguen en `localStorage` (`av:scores`), mezcladas en cliente con semillas deterministas (`seedScores`). Eso impide un ranking compartido entre jugadores. Esta spec es la «spec de puntuaciones» que la SPEC 04 dejó pendiente: crea `games` y `scores`, mueve las semillas a la base de datos, y migra todos los consumidores de `buildBoard` para que haya una sola fuente de verdad.

`GAMES` (`lib/games.ts`) sigue siendo la fuente de verdad de la UI (sprites, colores, textos). La tabla `games` guarda solo lo que la base de datos necesita para validar y relacionar puntuaciones.

## Alcance

**Dentro:**

- Migración SQL versionada en `supabase/migrations/`: tablas `public.games` y `public.scores`, vista `public.leaderboard`, trigger de `nombre`, RLS y semillas (juegos y puntuaciones semilla).
- `lib/leaderboard.ts` (servidor): lectura del top de un juego, del top de todos los juegos y del récord por juego.
- Server Action `guardarPuntuacion` (`app/juego/[id]/jugar/actions.ts`): valida y guarda la puntuación del usuario autenticado, y invalida la caché de los rankings (`updateTag("leaderboard")`).
- `components/Player.tsx`: el botón de guardar llama a la Server Action en lugar de `saveScore`, con estados de guardando y de error.
- Migrar a datos de Supabase `Leaderboard`, `Podium`, `GameStats`, `HallOfFame` y `GameLibrary` (récord por juego).
- Retirar `buildBoard`, `seedScores`, `NOMBRES` de `lib/games.ts` y `saveScore`, `useSavedScores`, `SCORES_KEY` de `lib/store.ts`.
- Los invitados siguen guardando solo `av:guest-best` (`recordGuestBest`, `useGuestBest`) y no entran en el ranking.
- Actualizar `CLAUDE.md` (arquitectura de datos y estado).

**Fuera de alcance (para otras specs):**

- Contador real de partidas (`Game.partidas` sigue siendo texto fijo en `lib/games.ts`).
- Anti-trampas fuerte (firma de la partida, validación en el juego, detección de bots): solo hay validación básica de rango.
- Mover sprites, colores, textos, dificultad o `portada` de `GAMES` a la base de datos.
- Panel de administración de juegos, alta de juegos desde la UI.
- Rankings por periodo (semanal/mensual), paginación, perfil público de jugador, historial personal.
- Realtime (el ranking no se actualiza en vivo; se actualiza al guardar o recargar).
- Migrar las puntuaciones existentes de `av:scores` (se descartan; eran de prueba).
- Invitados como usuarios de Supabase o entrada de invitados en el ranking.
- Cambios en los juegos HTML o en el protocolo `postMessage`.
- Pruebas automatizadas (el repo no tiene configuradas).

## Modelo de datos

Migración `supabase/migrations/<timestamp>_games_scores.sql`:

```sql
create table public.games (
  id text primary key,                 -- mismo id que Game.id ("rocas", "snake"…)
  titulo text not null,
  categoria text not null,
  archivo text not null,
  vidas int not null check (vidas > 0),
  record_base int not null check (record_base > 0),
  score_max int not null check (score_max >= record_base)  -- tope de validación
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,  -- null en semillas
  nombre text not null,                -- username al guardar; nombre ficticio en semillas
  score int not null check (score >= 0),
  es_semilla boolean not null default false,
  created_at timestamptz not null default now(),
  check ((es_semilla and user_id is null) or (not es_semilla and user_id is not null))
);
create index scores_game_score_idx on public.scores (game_id, score desc);
```

- **Trigger** `scores_set_nombre` (`before insert`, `security definer`, `set search_path = ''`): si `user_id` no es nulo, fija `nombre` con `profiles.username` e ignora el valor enviado.
- **Vista** `public.leaderboard` (`security_invoker = true`): una fila por jugador y juego con su mejor puntuación (`distinct on (game_id, coalesce(user_id::text, nombre))` ordenado por `score desc`, `created_at asc`). Columnas: `game_id`, `nombre`, `score`, `fecha` (`created_at::date`), `es_semilla`.
- **RLS** (ambas tablas activadas):
  - `games`: política `select` pública; sin escritura.
  - `scores`: política `select` pública; política `insert` para `authenticated` con `check (user_id = auth.uid() and es_semilla = false)`; sin `update` ni `delete`.
- **Semillas:** la migración inserta los 8 juegos (valores de `GAMES`; `score_max` = `record_base * 10`) y, por juego, las 10 puntuaciones que hoy calcula `seedScores` (nombres `NEO_RIDER`…`ZXCVBN`, fechas `2026-10-28` a `2026-10-10`), con `es_semilla = true`. Se generan con un script SQL (`generate_series`) que reproduce la fórmula de `seedScores`, para que el ranking inicial sea idéntico al actual.

Contratos en el cliente:

```ts
// lib/leaderboard.ts
export type LeaderboardEntry = { gameId: string; name: string; score: number; date: string }; // date: yyyy-mm-dd
getLeaderboard(gameId: string, limit?: number): Promise<LeaderboardEntry[]>;   // por defecto 10
getAllLeaderboards(limit?: number): Promise<Record<string, LeaderboardEntry[]>>; // por defecto 100
getRecords(): Promise<Record<string, number>>;  // gameId → mejor puntuación global

// app/juego/[id]/jugar/actions.ts
guardarPuntuacion(gameId: string, score: number): Promise<{ ok: true } | { ok: false; error: string }>;
```

`ScoreEntry` de `lib/games.ts` se sustituye por `LeaderboardEntry` (mismos campos). Las lecturas usan un cliente público sin cookies (`lib/supabase/public.ts`, `createClient` de `supabase-js` con la clave publicable), porque `games`, `scores` y `leaderboard` tienen lectura pública; así las páginas pueden seguir siendo estáticas. El proyecto usa Cache Components (`cacheComponents: true`), que no permite un `fetch` sin caché durante el prerenderizado: `getLeaderboard` lleva `"use cache"`, `cacheLife("hours")` y `cacheTag("leaderboard")` (constante `LEADERBOARD_TAG`), y `guardarPuntuacion` la invalida con `updateTag`.

Variables de entorno: sin cambios (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de escribir código, leer en `node_modules/next/dist/docs/` las guías de Server Actions, `use cache`, `cacheTag` / `updateTag` y caché/revalidación de páginas (Next 16 difiere de lo conocido).

1. **Migración de esquema.** Crear `supabase/migrations/<timestamp>_games_scores.sql` con tablas, índice, trigger, vista y RLS (sin semillas) y aplicarla con `apply_migration`. Ejecutar `get_advisors` (security). Prueba: `list_tables` muestra `games` y `scores` con RLS activa; un insert anónimo en `scores` falla.
2. **Semillas.** Segunda migración `<timestamp>_games_scores_seed.sql` con los juegos y las puntuaciones semilla. Prueba: `select count(*) from scores` = 80 y la fila 1 de `leaderboard` de `rocas` coincide con la que muestra hoy la web.
3. **Cliente público y lecturas.** Crear `lib/supabase/public.ts` y `lib/leaderboard.ts`. Prueba: importar sin errores de tipos; las tres funciones devuelven datos desde un script o ruta temporal.
4. **Leaderboard y Podium.** `Leaderboard` y `Podium` pasan a recibir `entries: LeaderboardEntry[]` por props (dejan de usar `useSavedScores`). La página `/juego/[id]` llama a `getLeaderboard` y pasa los datos. Prueba: `/juego/rocas` muestra el mismo top que antes.
5. **GameStats.** Recibe `mejor: number` por props y se calcula en `/juego/[id]` a partir de la primera entrada. Prueba: «Mejor global» coincide con el primer puesto.
6. **HallOfFame y biblioteca.** `app/salon-de-la-fama/page.tsx` llama a `getAllLeaderboards` y pasa `boards` a `HallOfFame`; `HallOfFame` calcula la «marca propia» y el puesto con los datos recibidos (fuera del top 100: sin marca ni puesto, se muestra «—»). `app/biblioteca/page.tsx` llama a `getRecords` y pasa `records` a `GameLibrary`, que muestra `Math.max(records[id], marca de invitado)` (la home no usa `GameLibrary`, así que no cambia). Prueba: ambas rutas muestran los récords de Supabase; `bloque-buster` pasa de 28.450 (`recordBase`) a 27.430, el primer puesto real.
7. **Guardado.** Crear `app/juego/[id]/jugar/actions.ts` con `guardarPuntuacion` (usa `lib/supabase/server.ts`; comprueba sesión, que el juego exista en `games`, que `score` sea entero entre 0 y `score_max`, inserta con `user_id` de la sesión y llama a `updateTag(LEADERBOARD_TAG)`, que invalida el ranking en `/juego/[id]`, `/salon-de-la-fama` y `/biblioteca`). Conectar `Player.tsx` con estados «guardando» y de error genérico en español. Prueba: con cuenta, guardar inserta una fila y aparece en el ranking tras invalidar la caché; con puntuación negativa, inválida o fuera de tope devuelve error y no inserta.
8. **Limpieza y documentación.** Eliminar `buildBoard`, `seedScores`, `NOMBRES`, `ScoreEntry`, `saveScore`, `useSavedScores` y `SCORES_KEY`; borrar el comentario `BACKEND` de `Player.tsx` y `lib/store.ts`. Actualizar `CLAUDE.md`. Prueba: `npm run build` y `npm run lint` sin errores; no quedan referencias (`grep`) a lo eliminado.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript y `npm run lint` no reporta errores nuevos.
- [ ] Existen `public.games` (8 filas) y `public.scores` con RLS activada; `get_advisors` (security) no reporta problemas nuevos.
- [ ] La única política de escritura es el `insert` de `scores` para `authenticated` con `user_id = auth.uid()` y `es_semilla = false`; `games` no tiene políticas de escritura.
- [ ] Un insert en `scores` con la clave anónima, o con `user_id` distinto al propio, es rechazado.
- [ ] `scores.nombre` de una fila real siempre coincide con `profiles.username`, aunque el cliente envíe otro valor.
- [ ] Al arrancar, el ranking de cada juego muestra las mismas 10 semillas (nombres, puntuaciones y fechas) que mostraba antes `seedScores`.
- [ ] `/juego/[id]` muestra el top 10 y el podio desde Supabase y «Mejor global» es el primer puesto.
- [ ] `/salon-de-la-fama` muestra el podio y la tabla de cada juego desde Supabase y el selector de juego sigue funcionando.
- [ ] Con cuenta, tras terminar una partida, el botón de guardar inserta una fila en `scores` y la puntuación aparece en el ranking del juego al recargar la página.
- [ ] Si el usuario guarda varias partidas en un juego, el ranking muestra solo su mejor puntuación (una fila por jugador) y `scores` conserva todas.
- [ ] El jugador con sesión ve su fila marcada «(TÚ)» en el ranking.
- [ ] `guardarPuntuacion` rechaza sin sesión, con `gameId` inexistente, con `score` no entero, negativo o mayor que `games.score_max`, sin insertar nada.
- [ ] Si Supabase falla al guardar, `Player.tsx` muestra un error genérico en español y permite reintentar; el botón no queda en estado «guardado».
- [ ] Un invitado no ve el botón de guardar en el ranking global, su marca se guarda en `av:guest-best`, y su fila no aparece en `scores`.
- [ ] `GameLibrary` muestra como récord el máximo entre el récord global de Supabase y la marca local de invitado, igual que antes.
- [ ] `buildBoard`, `seedScores`, `saveScore` y `useSavedScores` ya no existen en el repo.
- [ ] Ninguna clave secreta (`service_role`) aparece en el repo ni en `.next/static`.
- [ ] Las páginas del ranking no tienen scroll horizontal a 375 px de ancho.

## Decisiones

- **Sí:** tabla `games` mínima (id, título, categoría, archivo, vidas, récord base, tope). Es lo que necesita la FK y la validación; sprites y colores siguen en código y no justifican migrar el catálogo.
- **No:** catálogo completo en Supabase. Mover sprites/colores aumenta el riesgo en la UI sin beneficio para el ranking.
- **Sí:** `GAMES` sigue como fuente de verdad de la UI y `games` se siembra por migración. Coste: al añadir un juego hay que tocar los dos sitios; `guardarPuntuacion` falla si el juego no existe en `games`, lo que lo hace visible.
- **Sí:** `scores` guarda todas las partidas y la vista `leaderboard` toma la mejor por jugador. Permite estadísticas futuras sin migrar datos.
- **No:** una sola fila por (usuario, juego) con actualización. Más simple pero pierde historial y obliga a dar permiso de `update`.
- **Sí:** filas semilla con `user_id` nulo, `nombre` y `es_semilla`. Sin usuarios falsos en `auth.users`; la restricción `check` impide mezclar los dos casos.
- **No:** tabla aparte `seed_scores`. Obliga a unir en la vista y duplicar columnas.
- **Sí:** sembrar la base con las semillas actuales. El ranking inicial queda poblado y estéticamente igual al de hoy.
- **Sí:** escritura por Server Action con sesión y validación de rango (`score_max`), con RLS como segunda barrera. El valor sigue viniendo del navegador, así que no es anti-trampas fuerte; eso se declara fuera de alcance.
- **No:** insert directo desde el cliente. Permitiría cualquier puntuación sin validar el juego ni el tope desde una única entrada.
- **Sí:** `nombre` fijado por trigger desde `profiles.username`. El cliente no puede suplantar un nombre aunque use la API directamente.
- **Sí:** vista `leaderboard` con `security_invoker`. Hereda la RLS de `scores` y no abre una puerta con permisos del propietario.
- **Sí:** lecturas con cliente público sin cookies. Las tablas son de lectura pública, y mantiene las páginas estáticas: `"use cache"` + `cacheTag` en la lectura y `updateTag` al guardar (con `cacheComponents`, un `fetch` sin caché rompe el build; `revalidatePath` no sirve aquí).
- **Sí:** `score_max = record_base * 10`. Tope razonable y editable por SQL; ajustar si algún juego lo supera legítimamente.
- **Sí:** el top de `HallOfFame` se trae con límite 100 por juego para calcular «puesto #N» sin consultas por usuario; fuera del top 100 no se muestra puesto.
- **Sí:** migrar todos los consumidores de `buildBoard` y el guardado del `Player`. Evita dos fuentes de verdad.
- **No:** migrar `av:scores`. Eran datos de prueba del backend simulado.
- **Sí:** invitados siguen locales (`av:guest-best`) y fuera del ranking, como en SPEC 04.
- **No:** Realtime, contador real de partidas, paginación. Cada uno es una spec independiente.

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un usuario falsea la puntuación (la envía el navegador)                                   | Validación en la Server Action (sesión, juego, entero, 0–`score_max`) y RLS. Anti-trampas fuerte queda fuera; el riesgo se acepta para esta versión.   |
| `GAMES` y `games` se desincronizan                                                        | La Server Action falla si el `gameId` no existe en `games`; el paso 2 reproduce los 8 juegos actuales; `CLAUDE.md` documenta que se actualizan juntos. |
| Las páginas dejan de ser estáticas o muestran datos viejos tras guardar                   | Cliente de lectura sin cookies, `"use cache"` con `cacheTag("leaderboard")` y `updateTag` al guardar; `cacheLife("hours")` como respaldo. Verificado con `npm run build`.                        |
| Las semillas SQL no reproducen exactamente `seedScores` (redondeo, `(i*7 + len(id)) % 5`) | Paso 2 compara contra la salida actual de la web antes de eliminar `seedScores`; criterio de aceptación explícito.                                     |
| `distinct on` de la vista es lento con muchas filas                                       | Índice `scores_game_score_idx`; con el volumen actual es irrelevante. Una tabla agregada o paginación quedan para otra spec.                           |
| Empates: dos jugadores con la misma puntuación                                            | Orden estable por `score desc, fecha asc, nombre asc` (la vista solo expone la fecha, no la hora: en empate del mismo día se ordena por nombre). Añadir `created_at` a la vista para el desempate exacto queda para otra spec.                                                                             |
| Un usuario sin perfil (fallo del trigger de la SPEC 04) no puede guardar                  | `user_id` referencia `profiles`; la Server Action devuelve error genérico y se registra con `console.error`.                                           |
| El usuario cierra sesión o caduca la sesión antes de pulsar guardar                       | La Server Action devuelve «Inicia sesión para guardar»; `Player.tsx` conserva la puntuación final para reintentar.                                     |

## Qué **no** está en esta spec

- Contador real de partidas (`Game.partidas`).
- Anti-trampas fuerte (firma de partida, validación en el juego).
- Mover sprites, colores o textos de `GAMES` a la base de datos.
- Panel de administración, rankings por periodo, paginación, perfil público o historial personal.
- Realtime.
- Migración de `av:scores`.
- Invitados en el ranking o como usuarios de Supabase.
- Cambios en los juegos HTML o en el protocolo `postMessage`.
- Pruebas automatizadas.

Cada uno, si llega, va en su propia spec.
