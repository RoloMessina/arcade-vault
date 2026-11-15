# SPEC 10 — Integración del juego Deep Dive

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-15
> **Tema de jam:** Océano
> **Objetivo:** Integrar Deep Dive como juego jugable en Arcade Vault, construyendo su
> canvas desde cero (descenso vertical infinito en submarino) y conectando el leaderboard
> de Supabase.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `deep-dive` a la tabla `games` en Supabase.
- Crear `components/games/DeepDiveGame.tsx` — componente React `"use client"` que encapsula
  el canvas (600 × 800 px) y el game loop completo. Acepta props:
  `paused`, `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`.
- El game loop se construye desde cero con primitivas del canvas (sin sprites ni assets
  nuevos): submarino controlado en horizontal mientras el fondo y los obstáculos suben,
  simulando un descenso continuo.
- El HUD interno del canvas (profundidad y score top-left, nivel top-right, vidas como
  iconos de submarino bajo el nivel) se dibuja dentro del canvas — patrón doble HUD igual
  que Asteroids, Tetris, Arkanoid y Snake.
- El componente notifica a React de cada cambio de estado vía callbacks (comparando con
  el valor anterior antes de disparar).
- La condición de game over es perder la tercera vida; dispara `onLivesChange(0)` y
  `onGameOver(finalScore)`.
- El prop `paused: boolean` congela el loop (no ejecuta `update()`) pero sigue llamando
  a `draw()`.
- Limpiar los event listeners de teclado (`keydown`, `keyup` en `document`) y el
  `requestAnimationFrame` en el `return` del `useEffect`.
- Crear `app/games/deep-dive/play/page.tsx` — play-page específica para este juego.
  Gestiona el estado (`score`, `level`, `lives`, `paused`, `over`, `name`, `saved`,
  `gameKey`) y pasa callbacks al componente canvas.
- Guardar score al terminar: modal React pre-rellena nombre desde `localStorage`
  (`av_player_name`), inserta en Supabase y persiste el nombre para la próxima partida.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase — ya existen (spec 06).
- Controles táctiles o mobile.
- Supabase Auth y RLS — `user_id` se almacena como `null`.
- Realtime en el leaderboard.
- Paginación del leaderboard — se muestran los top 10 fijos.
- Sonido y música.
- Power-ups, tienda de mejoras o jefes de profundidad.
- Cover CSS propio — se reutiliza una clase existente; un cover específico queda para un
  spec de CSS posterior.

---

## Data model

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'deep-dive',
  'DEEP DIVE',
  'Desciende sin fin y esquiva las minas marinas.',
  'Pilota un submarino hacia las profundidades del océano. Esquiva minas y medusas, recoge perlas para multiplicar tu puntuación y llega cada vez más hondo: cuanto más desciendes, más rápido cae el mundo a tu alrededor.',
  'ARCADE',
  'cover-bg',
  'cyan'
);
```

### Props del componente `DeepDiveGame`

```ts
interface DeepDiveGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estado inicial: `lives = 3`, `score = 0`, `level = 1`. `onLivesChange(0)` se dispara justo
antes de `onGameOver(score)` al perder la última vida.

Reglas de puntuación y progresión:

- **Profundidad:** `depth` (metros) aumenta con la velocidad de descenso; cada metro suma
  1 punto de score.
- **Perla:** +50 puntos.
- **Nivel:** sube 1 cada 250 m de profundidad. La velocidad de descenso es
  `120 + (level - 1) * 25` px/s (en nivel 1 equivale a ≈ 4 m/s con 30 px = 1 m).
- **Vidas:** 3. Tras recibir un golpe, el submarino queda invulnerable 1,5 s (parpadeo).

No se introducen nuevas tablas ni tipos TypeScript — se reutilizan `GameRow` y `ScoreRow`
de `lib/supabase/types.ts`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model en el SQL Editor de Supabase.
   Verificación: la fila `deep-dive` aparece en el Table Editor; `/games` muestra la card
   de Deep Dive con cover `cover-bg` y color `cyan`.

2. **Crear `components/games/DeepDiveGame.tsx`** — componente `"use client"` que:
   - Renderiza un `<canvas>` de 600 × 800 px.
   - **Submarino:** rectángulo redondeado de 48 × 24 px con torreta y ventana, posición
     inicial `x = 300`, `y = 160` (fija en vertical). Movimiento horizontal con
     `←` / `→` o `A` / `D` a 280 px/s, limitado al ancho del canvas. Estado de teclas
     mediante `keydown` / `keyup` en `document`.
   - **Mundo:** `scrollY` aumenta cada frame en `descentSpeed * dt`. Los obstáculos se
     generan por debajo del canvas (`y = 800 + margen`) y suben respecto a la vista;
     se eliminan al salir por arriba.
   - **Generación:** cada `spawnInterval = max(0.45, 1.1 - (level - 1) * 0.08)` s se crea
     un elemento en una `x` aleatoria: 50 % mina (círculo de radio 16 con pinchos,
     estática), 25 % medusa (radio 14, oscila en X con `sin` a ±60 px), 25 % perla
     (radio 8, brillo). Nunca se generan dos minas con menos de 80 px de separación
     horizontal en la misma fila, para garantizar siempre un paso libre.
   - **Colisiones:** círculo-rectángulo simple. Mina o medusa: `lives -= 1`, el obstáculo
     se destruye, se activa la invulnerabilidad de 1,5 s. Perla: `score += 50`, se elimina.
   - **Puntuación y nivel:** `depth` se acumula en `update()`; `score = floor(depth) +
perlas * 50`; `level = 1 + floor(depth / 250)`.
   - `draw()` limpia el canvas, pinta un degradado vertical que se oscurece con la
     profundidad, burbujas decorativas que suben (parallax), obstáculos, submarino
     (parpadeando si es invulnerable) y el HUD interno.
   - Llama `onScoreChange`, `onLevelChange` y `onLivesChange` solo cuando el valor cambia
     respecto al anterior.
   - Al llegar a `lives = 0`, llama `onLivesChange(0)` y luego `onGameOver(score)` una
     única vez y detiene `update()`.
   - Prop `paused: boolean` — si es `true`, el loop omite `update()` pero ejecuta `draw()`.
   - Usa `requestAnimationFrame` con `dt` acotado (`min(dt, 0.05)`) para evitar saltos.
   - Limpia `keydown`, `keyup` y el frame en el `return` del `useEffect`.
     Verificación: el juego arranca en `/games/deep-dive/play` y es jugable con A/D o flechas.

3. **Crear `app/games/deep-dive/play/page.tsx`** — play-page específica:
   - Importa `DeepDiveGame` con `dynamic(..., { ssr: false })`.
   - Estado local: `score`, `level`, `lives` (inicial `3`), `paused`, `over`, `name`,
     `saved`, `gameKey`.
   - Pasa `paused` y los cuatro callbacks a `DeepDiveGame`.
   - Reutiliza el layout visual de la plataforma (HUD React + CRT + modal game over),
     igual que `app/games/snake/play/page.tsx`; el HUD de vidas muestra `♥` repetido
     `lives` veces (o `—` si es 0).
   - Modal game over: pre-rellena nombre desde `localStorage.getItem('av_player_name')`;
     al confirmar, guarda en `localStorage` e inserta en Supabase
     `{ game_id: 'deep-dive', player_name: name, score, user_id: null }`.
   - Botón de guardar se deshabilita tras el primer envío.
     Verificación: el HUD React refleja score, vidas y nivel en tiempo real; tras una
     partida el score aparece en `/games/deep-dive` y en `/hall-of-fame` al recargar.

4. **Verificación final** — `npm run build` termina sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `deep-dive` existe en la tabla `games` de Supabase con los valores del data model.
- [ ] La card de Deep Dive aparece en `/games` con cover `cover-bg` y color `cyan`.
- [ ] La ruta `/games/deep-dive/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas (600 × 800) se renderiza con el submarino, el fondo degradado y las burbujas.
- [ ] El submarino se mueve en horizontal con A/D y flechas, sin salir del canvas.
- [ ] Los obstáculos y perlas suben respecto a la vista y se eliminan al salir del canvas.
- [ ] Chocar con una mina o medusa resta 1 vida y activa 1,5 s de invulnerabilidad.
- [ ] Recoger una perla suma 50 puntos.
- [ ] El score aumenta con la profundidad (1 punto por metro).
- [ ] El nivel sube cada 250 m y la velocidad de descenso aumenta.
- [ ] Siempre existe un camino libre entre las minas de una misma fila.
- [ ] El HUD interno del canvas (profundidad/score, nivel, vidas) se dibuja correctamente.
- [ ] El HUD React de la plataforma refleja en tiempo real score, vidas y nivel.
- [ ] El botón "PAUSA" de la plataforma congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al perder la tercera vida, `onLivesChange(0)` y `onGameOver(score)` se disparan una sola vez.
- [ ] Aparece el modal React de game over con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (3 vidas, score 0, nivel 1).
- [ ] Al abrir el modal, el campo de nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] El score guardado aparece en `/games/deep-dive` y en `/hall-of-fame` al recargar.
- [ ] `/hall-of-fame` muestra un tab para Deep Dive.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Doble HUD** — el canvas conserva su HUD interno y React muestra los mismos valores
  en el HUD de la plataforma. Razón: coherencia con el patrón establecido en Asteroids,
  Tetris, Arkanoid y Snake.

- **Sí: 3 vidas con invulnerabilidad temporal** — un golpe no es fatal y la invulnerabilidad
  de 1,5 s evita perder varias vidas en un solo cluster de obstáculos. Razón: partidas de
  1-3 min y justicia de la dificultad.

- **Sí: Score = profundidad + perlas** — la profundidad premia sobrevivir y las perlas
  premian el riesgo (desviarse del camino seguro). Razón: score numérico claro y
  competitivo para el leaderboard.

- **Sí: Submarino fijo en vertical, el mundo sube** — solo hay un eje de control.
  Razón: controles simples (A/D o flechas) y generación de obstáculos trivial.

- **Sí: Camino libre garantizado** — nunca dos minas a menos de 80 px en la misma fila.
  Razón: evitar partidas injustas por patrones imposibles.

- **Sí: Solo primitivas de canvas** — sin sprites ni audio nuevos. Razón: sin coste de
  assets y estética vectorial retro coherente con la plataforma.

- **Sí: Play-page específica `app/games/deep-dive/play/page.tsx`** — en lugar de modificar
  la ruta genérica `[id]/play`. Razón: coherencia con los demás juegos; Next.js App Router
  da prioridad a rutas estáticas sobre dinámicas.

- **Sí: `dynamic(..., { ssr: false })`** — el componente canvas se carga solo en cliente.
  Razón: `canvas` y `requestAnimationFrame` no existen en el entorno Node.js de Next.js SSR.

- **Sí: Reutilizar `cover-bg`** — Razón: no hay cover marino en `globals.css`; añadir uno
  es CSS ajeno a este spec.

- **No: Movimiento vertical del submarino** — Razón: complica el diseño de la dificultad
  sin aportar variedad suficiente.

- **No: Componente genérico `CanvasGame`** — cada juego tiene su componente propio.
  Razón: YAGNI; generalizar ahora sería abstraer sin caso de uso suficientemente confirmado.

- **No: RLS en este spec** — las tablas quedan abiertas (INSERT y SELECT públicos).
  Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — los scores se ven al recargar.
  Razón: la complejidad de subscriptions no aporta valor mientras haya pocos jugadores activos.
