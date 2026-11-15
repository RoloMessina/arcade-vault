# SPEC 13 — Integración del juego Lily Leap

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-15
> **Tema de jam:** Frogger — cruza la carretera y el río sin hacerte papilla
> **Objetivo:** Integrar Lily Leap, una reinterpretación por turnos y de puzzle del cruce
> de carretera y río, como juego jugable en Arcade Vault, con canvas desde cero y
> leaderboard de Supabase.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `lily-leap` a la tabla `games` en Supabase.
- Crear `components/games/LilyLeapGame.tsx` — componente React `"use client"` con el
  canvas (540 × 660 px) y la lógica por turnos. Acepta props:
  `paused`, `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`.
- Tablero de 9 columnas × 10 filas de 60 px más una franja de HUD de 60 px. El mundo solo
  avanza cuando el jugador mueve: cada movimiento (o espera) desplaza todos los carriles una
  celda. Hay que llegar a la fila superior con un presupuesto limitado de movimientos.
- Doble HUD: canvas (score, nivel, vidas, movimientos restantes) y HUD React.
- Notificación por callbacks comparando con el valor anterior.
- Game over cuando las vidas llegan a 0: `onLivesChange(0)` y `onGameOver(finalScore)`.
- El prop `paused` congela `update()` (animaciones y entrada) pero sigue llamando a `draw()`.
- Limpiar listeners y frames en el `return` del `useEffect`.
- Crear `app/games/lily-leap/play/page.tsx` con estado `score`, `level`, `lives`,
  `paused`, `over`, `name`, `saved`, `gameKey`.
- Modal de guardado con `av_player_name` e INSERT en `scores`.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` — ya existen (spec 06).
- Controles táctiles o mobile.
- Supabase Auth y RLS — `user_id` = `null`.
- Realtime en el leaderboard.
- Paginación — top 10 fijos.
- Editor de niveles, niveles prediseñados o solver que demuestre solubilidad (el
  generador garantiza huecos, no prueba solución; ver Decisions).
- Deshacer movimientos.
- Cover CSS propio — se reutiliza `cover-tetro`; un cover propio queda para un spec de CSS.

---

## Data model

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'lily-leap',
  'LILY LEAP',
  'Puzzle por turnos: cruza tráfico y río saltando.',
  'Una rana, un tablero y un presupuesto de movimientos. El mundo solo avanza cuando tú te mueves: planifica cuándo cruzar entre coches y cómo encadenar troncos para llegar a la otra orilla sin ahogarte. Cuantos menos movimientos gastes, más puntos ganas.',
  'PUZZLE',
  'cover-tetro',
  'cyan'
);
```

### Props del componente `LilyLeapGame`

```ts
interface LilyLeapGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Valores iniciales: `lives = 3`, `score = 0`, `level = 1`, `movesLeft = 30`.
Regla de nivel: al llegar a la fila de meta, `level` sube 1 y se genera un tablero nuevo;
al morir o quedarse sin movimientos se pierde 1 vida y se reintenta el mismo tablero con
`movesLeft = 30` otra vez.

No se introducen nuevas tablas ni tipos — se reutilizan `GameRow` y `ScoreRow`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model.
   Verificación: la fila `lily-leap` aparece en el Table Editor; `/games` muestra la card
   con cover `cover-tetro` y color `cyan`.

2. **Crear `components/games/LilyLeapGame.tsx`** — componente `"use client"`:
   - **Canvas:** 540 × 660 px, `CELL = 60`. Fila 0 (y 0-60) = HUD interno. Filas de tablero
     1-10: fila 1 = meta (hierba segura), filas 2-4 = río (3 carriles), fila 5 = mediana
     segura, filas 6-9 = carretera (4 carriles), fila 10 = salida segura.
   - **Estado:**
     - `frog: { col, row }` (empieza en `col = 4`, `row = 10`).
     - `lanes`: array con un objeto por fila de carril `{ row, kind: 'road' | 'river',
       dir: 1 | -1, step: 1 | 2, cells: boolean[9] }`. En `road`, `true` = coche; en
       `river`, `true` = tronco (`false` = agua). `cells` es un anillo: avanzar es rotar
       `step` posiciones en `dir`.
     - `movesLeft`, `lives`, `score`, `level`, `anim` (tween visual de 100 ms) y `lock`
       (true mientras dura el tween o la animación de muerte de 500 ms).
   - **Generación de tablero** (`generateBoard(level)`):
     - Carriles de río: aleatoriamente `dir` ±1, `step = 1`, tronco en
       `ceil(9 × max(0.4, 0.6 - 0.03 × level))` celdas formando rachas contiguas de 2-3
       (mínimo 3 celdas de tronco por carril, al menos una racha de 2).
     - Carriles de carretera: `dir` ±1; `step = 1`, salvo desde el nivel 4 donde 2 de los 4
       carriles usan `step = 2`; coches en `round(9 × min(0.55, 0.25 + 0.03 × level))`
       celdas, nunca dos seguidos en más de 2 rachas, y siempre al menos 3 celdas libres.
     - Se guarda una copia profunda inicial para reintentar el mismo tablero tras morir.
   - **Controles:** flechas/WASD mueven a la celda adyacente (no se sale del tablero);
     `Space` espera un turno sin mover. Solo se procesa si `!lock`, `!paused` y se ignora
     `e.repeat`. `preventDefault` en flechas y espacio.
   - **Resolución de un turno** `takeTurn(dx, dy)`:
     1. `movesLeft--` y mueve la rana (si el destino es válido).
     2. Rota todos los carriles según `dir` y `step`.
     3. Si la rana está sobre un carril de río, se desplaza con él (misma rotación); si
        sale del tablero (col < 0 o > 8), muere.
     4. Comprueba: en carretera, `cells[col] === true` → muerte por atropello; en río,
        `cells[col] === false` → ahogo.
     5. Si `row === 1`: nivel completado.
     6. Si `movesLeft === 0` y no está en meta: muerte por agotar movimientos.
     Con `step = 2` solo se comprueba la celda final (no las intermedias; documentado).
   - **Puntuación:** +10 por cada fila nueva más alta alcanzada (`maxRow`, se resetea al
     reintentar); al llegar a la meta +100 × `level` y +15 por cada movimiento restante.
     Penalización: ninguna al morir (se pierde la vida y el progreso del intento).
   - **Muerte:** `lock` 500 ms con animación (rana tachada), `lives--`; si `lives > 0`,
     restaurar el tablero inicial y la rana; si no, `onLivesChange(0)` y `onGameOver(score)`.
   - **`update(dt)`** avanza los tweens y temporizadores de `lock`; **`draw()`** pinta
     fondos por franja, carriles (coches rectangulares coloreados, troncos marrones, agua
     azul con ondas), la rana con tween entre celdas, y el HUD interno (score, nivel, vidas
     como puntos, movimientos restantes con barra). Muestra una guía tenue "ESPACIO = esperar".
   - **Pausa:** `paused` impide procesar entrada y `update()`, pero `draw()` sigue.
   - Callbacks con comparación contra el valor anterior; en el `return` del `useEffect` se
     retira `keydown` de `document` y se cancela el `requestAnimationFrame`.
     Verificación: `/games/lily-leap/play` es jugable por turnos; el mundo no se mueve
     sin input; llegar a la meta genera un tablero nuevo.

3. **Crear `app/games/lily-leap/play/page.tsx`** — play-page específica:
   - Importa `LilyLeapGame` con `dynamic(..., { ssr: false })`.
   - Estado: `score`, `level`, `lives` (inicial `3`), `paused`, `over`, `name`, `saved`,
     `gameKey`.
   - Layout como `app/games/snake/play/page.tsx` (HUD React + CRT + modal).
   - Modal: nombre desde `av_player_name`; INSERT
     `{ game_id: 'lily-leap', player_name: name, score, user_id: null }`; botón de guardar
     deshabilitado tras el envío.
     Verificación: HUD React sincronizado; score visible en `/games/lily-leap` y
     `/hall-of-fame`.

4. **Verificación final** — `npm run build` sin errores. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `lily-leap` existe en la tabla `games` con los valores del data model.
- [ ] La card de Lily Leap aparece en `/games` con cover `cover-tetro` y color `cyan`.
- [ ] `/games/lily-leap/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas (540 × 660) renderiza HUD, meta, río, mediana, carretera y salida.
- [ ] Flechas/WASD mueven la rana una celda; `Space` espera un turno.
- [ ] El mundo solo avanza cuando el jugador realiza un turno.
- [ ] Los coches matan, el agua ahoga y los troncos transportan a la rana.
- [ ] Salir del tablero arrastrado por un tronco mata a la rana.
- [ ] Quedarse sin movimientos resta una vida y reinicia el mismo tablero.
- [ ] Llegar a la meta suma puntos con bonus por movimientos restantes y genera un tablero nuevo con `level + 1`.
- [ ] El HUD interno del canvas se dibuja correctamente.
- [ ] El HUD React refleja score, nivel y vidas en tiempo real.
- [ ] El botón "PAUSA" bloquea la entrada; "REANUDAR" la reactiva.
- [ ] Al perder la tercera vida se disparan `onLivesChange(0)` y `onGameOver(score)`.
- [ ] Aparece el modal React de game over con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero.
- [ ] El campo de nombre se pre-rellena con `av_player_name` si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste.
- [ ] El botón de guardar se deshabilita tras el primer envío.
- [ ] El score aparece en `/games/lily-leap` y en `/hall-of-fame` al recargar.
- [ ] `/hall-of-fame` muestra un tab para Lily Leap.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Doble HUD** — Razón: coherencia con el resto de juegos de la plataforma.

- **Sí: Mecánica por turnos** — Razón: distingue claramente este juego del Frogger en tiempo
  real (spec 12): ritmo reflexivo, género PUZZLE.

- **Sí: 3 vidas con reintento del mismo tablero** — Razón: un puzzle se aprende
  reintentando; el tablero nuevo solo llega al superar el nivel.

- **Sí: Carriles como anillos de 9 celdas** — Razón: simplifica la rotación y garantiza
  que el patrón sea cíclico y predecible.

- **Sí: `Space` espera un turno** — Razón: esperar es parte del puzzle (dejar pasar un
  coche).

- **Sí: Presupuesto de 30 movimientos** — Razón: introduce puntuación por eficiencia y
  evita esperar indefinidamente.

- **Sí: Generador con garantías de huecos, sin solver** — Razón: un solver añadiría alcance;
  las medidas (3+ celdas libres, rachas de troncos) hacen casi siempre viable el tablero y
  el reintento limita el coste de un tablero difícil. Pregunta abierta: ¿añadir un solver
  BFS en un spec posterior? Se aplaza por alcance.

- **Sí: Reutilizar `cover-tetro`** — Razón: es el cover de puzzle más cercano.

- **Sí: Play-page específica y `dynamic(..., { ssr: false })`** — Razón: igual que los
  demás juegos; canvas y `requestAnimationFrame` no existen en SSR.

- **No: Componente genérico `CanvasGame`** — Razón: YAGNI.

- **No: RLS en este spec** — Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — Razón: no aporta valor con pocos jugadores.
