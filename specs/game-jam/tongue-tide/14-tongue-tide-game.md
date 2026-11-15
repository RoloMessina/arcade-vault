# SPEC 14 — Integración del juego Tongue Tide

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-15
> **Tema de jam:** Frogger — cruza la carretera y el río sin hacerte papilla
> **Objetivo:** Integrar Tongue Tide, un shooter fijo donde la rana del río defiende su
> tronco lanzando la lengua, como juego jugable en Arcade Vault con canvas desde cero y
> leaderboard de Supabase.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `tongue-tide` a la tabla `games` en Supabase.
- Crear `components/games/TongueTideGame.tsx` — componente React `"use client"` con el
  canvas (800 × 600 px) y el game loop. Acepta props:
  `paused`, `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`.
- La rana se desplaza horizontalmente por la orilla inferior y dispara su lengua en vertical
  contra insectos y avispas que bajan del cielo; las luciérnagas amigas no se deben tocar.
- Doble HUD: canvas (score, nivel, vidas, combo) y HUD React.
- Notificación por callbacks comparando con el valor anterior.
- Game over cuando las vidas llegan a 0: `onLivesChange(0)` y `onGameOver(finalScore)`.
- El prop `paused` congela `update()` pero sigue llamando a `draw()`.
- Limpiar listeners y frames en el `return` del `useEffect`.
- Crear `app/games/tongue-tide/play/page.tsx` con estado `score`, `level`, `lives`,
  `paused`, `over`, `name`, `saved`, `gameKey`.
- Modal de guardado con `av_player_name` e INSERT en `scores`.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` — ya existen (spec 06).
- Controles táctiles o mobile.
- Supabase Auth y RLS — `user_id` = `null`.
- Realtime en el leaderboard.
- Paginación — top 10 fijos.
- Power-ups, jefes y sonido.
- Cover CSS propio — se reutiliza `cover-invaders`; un cover propio queda para un spec de CSS.

---

## Data model

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'tongue-tide',
  'TONGUE TIDE',
  'Dispara tu lengua y defiende el río.',
  'Una rana en la orilla, un enjambre que no para de bajar. Lanza tu lengua para cazar mosquitos y avispas, encadena capturas para multiplicar los puntos y no toques a las luciérnagas amigas. Cada oleada trae más bichos y más rápidos.',
  'SHOOTER',
  'cover-invaders',
  'magenta'
);
```

### Props del componente `TongueTideGame`

```ts
interface TongueTideGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Valores iniciales: `lives = 3`, `score = 0`, `level = 1`.
Regla de nivel: sube 1 cada 15 bichos hostiles cazados (`killsInLevel`).
Vida extra única a los 5 000 puntos (máx. 5 vidas).

No se introducen nuevas tablas ni tipos — se reutilizan `GameRow` y `ScoreRow`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model.
   Verificación: la fila `tongue-tide` aparece en el Table Editor; `/games` muestra la card
   con cover `cover-invaders` y color `magenta`.

2. **Crear `components/games/TongueTideGame.tsx`** — componente `"use client"`:
   - **Canvas:** 800 × 600 px. Zona de juego y = 0-540; orilla/tronco en y = 540-600 donde
     se mueve la rana (centro en `y = 560`). Fondo azul oscuro con ondas del río abajo y
     nenúfares decorativos.
   - **Entidades:**
     - `frog`: `{ x, w: 40 }`, velocidad 320 px/s, `x` limitado a [20, 780]; `invuln`
       (1.5 s tras ser golpeada, parpadea).
     - `tongue`: `{ state: 'idle' | 'out' | 'back', length }`; sale de `(frog.x, 540)`
       hacia arriba. Extensión a 1400 px/s, retracción a 1800 px/s, `length` máx. 480 px.
       La lengua sigue la `x` de la rana mientras está fuera. Solo hay una lengua a la vez.
     - `bugs[]`: `{ x, y, vx, vy, type, hp, r }`.
       - `mosquito`: radio 12, `hp 1`, +10 puntos, baja a `vy = 70 + 8 × level` px/s con
         zigzag senoidal (`x = x0 + 40 × sin(t × 3)`).
       - `avispa`: radio 16, `hp 2` (la primera lengua la aturde y la retrasa 0.5 s, la
         segunda la caza), +30 puntos, `vy = 95 + 10 × level` y se desvía hacia la `x` de la
         rana (`vx` hasta 60 px/s). Aparece desde el nivel 2.
       - `luciernaga` (amiga): radio 12, `vy = 60`, flota lateralmente; cazarla resta 50
         puntos (mínimo 0), rompe el combo; no daña si llega abajo.
     - Combo: `combo` 1-5; +1 por cada captura hostil consecutiva sin fallo; vuelve a 1 si
       la lengua se retrae sin capturar nada, si se atrapa una luciérnaga o si la rana es
       golpeada. Los puntos de una captura se multiplican por `combo` (aplicado antes de
       incrementarlo).
   - **Spawn:** intervalo `max(0.45, 1.3 - 0.08 × level)` s; en cada spawn, `x` aleatoria
     en [30, 770], tipo ponderado (nivel 1: 80 % mosquito, 20 % luciérnaga; desde nivel 2:
     55 % mosquito, 25 % avispa, 20 % luciérnaga).
   - **`update(dt)`:** (dt ≤ 0.05)
     1. Entrada: ← → / A D mueven la rana; `Space` lanza la lengua si `state === 'idle'`.
     2. Avanza la lengua: en `out` aumenta `length`; si alcanza 480 px o colisiona, pasa a
        `back`; en `back` disminuye hasta 0 → `idle` (si no capturó nada, `combo = 1`).
     3. Colisión lengua-bicho: la punta `(frog.x, 540 - length)` contra círculos de cada
        bicho, tolerando un ancho de lengua de 8 px (distancia horizontal ≤ `r + 4` y
        vertical dentro del último tramo recorrido). Solo captura el primer bicho; luego
        `state = 'back'`.
     4. Mueve los bichos y los elimina al salir por debajo (y > 620) sin penalización, salvo
        que sean hostiles: un hostil que cruza y > 600 también rompe el combo.
     5. Colisión bicho-rana: si un hostil entra en la caja de la rana (±24 px en x,
        y ≥ 535) y `invuln <= 0` → `lives--`, `invuln = 1.5`, el bicho se destruye, `combo = 1`.
     6. Progresión: cada captura hostil incrementa `killsInLevel`; al llegar a 15 →
        `level++`, `killsInLevel = 0`, y se limpian los bichos en pantalla (sin puntos).
   - **`draw()`:** fondo, bichos (círculos con alas semitransparentes; avispas amarillas
     con rayas; luciérnagas con brillo cian), lengua (línea rosa gruesa de 8 px con bola
     en la punta), rana con ojos, HUD interno: score arriba-izquierda, nivel arriba-centro,
     vidas arriba-derecha y combo `xN` debajo del score.
   - **Game over:** `lives === 0` → `onLivesChange(0)` y `onGameOver(score)`.
   - **Pausa:** `paused` impide `update()` y entrada, pero `draw()` sigue.
   - Callbacks con comparación contra el valor anterior; en el `return` del `useEffect` se
     retiran `keydown`/`keyup` de `document` y se cancela el `requestAnimationFrame`.
     Verificación: `/games/tongue-tide/play` es jugable; las capturas suman combo, las
     luciérnagas penalizan y el nivel sube a los 15 hostiles cazados.

3. **Crear `app/games/tongue-tide/play/page.tsx`** — play-page específica:
   - Importa `TongueTideGame` con `dynamic(..., { ssr: false })`.
   - Estado: `score`, `level`, `lives` (inicial `3`), `paused`, `over`, `name`, `saved`,
     `gameKey`.
   - Layout como `app/games/snake/play/page.tsx` (HUD React + CRT + modal).
   - Modal: nombre desde `av_player_name`; INSERT
     `{ game_id: 'tongue-tide', player_name: name, score, user_id: null }`; botón de
     guardar deshabilitado tras el envío.
     Verificación: HUD React sincronizado; score visible en `/games/tongue-tide` y
     `/hall-of-fame`.

4. **Verificación final** — `npm run build` sin errores. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `tongue-tide` existe en la tabla `games` con los valores del data model.
- [ ] La card de Tongue Tide aparece en `/games` con cover `cover-invaders` y color `magenta`.
- [ ] `/games/tongue-tide/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas (800 × 600) renderiza río, rana y bichos.
- [ ] La rana se mueve con flechas izquierda/derecha o A/D sin salir del canvas.
- [ ] `Space` lanza la lengua; solo hay una lengua a la vez y se retrae tras capturar o llegar al máximo.
- [ ] Los mosquitos se cazan con una lengua; las avispas necesitan dos.
- [ ] Cazar una luciérnaga resta 50 puntos y rompe el combo.
- [ ] El combo (x1 a x5) multiplica los puntos y se reinicia al fallar.
- [ ] Un bicho hostil que toca a la rana resta una vida y da 1.5 s de invulnerabilidad.
- [ ] El nivel sube cada 15 hostiles cazados y aumenta la dificultad; las avispas aparecen desde el nivel 2.
- [ ] El HUD interno del canvas se dibuja correctamente.
- [ ] El HUD React refleja score, nivel y vidas en tiempo real.
- [ ] El botón "PAUSA" congela el juego; "REANUDAR" lo reanuda.
- [ ] Al perder la tercera vida se disparan `onLivesChange(0)` y `onGameOver(score)`.
- [ ] Aparece el modal React de game over con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero.
- [ ] El campo de nombre se pre-rellena con `av_player_name` si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste.
- [ ] El botón de guardar se deshabilita tras el primer envío.
- [ ] El score aparece en `/games/tongue-tide` y en `/hall-of-fame` al recargar.
- [ ] `/hall-of-fame` muestra un tab para Tongue Tide.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Doble HUD** — Razón: coherencia con el resto de juegos de la plataforma.

- **Sí: Género SHOOTER con lengua como arma** — Razón: distingue el juego del Frogger
  clásico (spec 12) y del puzzle por turnos (spec 13), conservando la rana como icono.

- **Sí: Una sola lengua a la vez, con retracción** — Razón: añade riesgo y timing (hay que
  esperar el regreso), base del sistema de combo.

- **Sí: Luciérnagas amigas** — Razón: obliga a apuntar y no solo a disparar sin pensar.

- **Sí: 3 vidas e invulnerabilidad temporal** — Razón: evita perder varias vidas en
  un mismo contacto.

- **Sí: Reutilizar `cover-invaders`** — Razón: es el cover de shooter vertical más
  cercano; un cover propio queda para un spec de CSS.

- **Sí: Play-page específica y `dynamic(..., { ssr: false })`** — Razón: igual que los
  demás juegos; canvas y `requestAnimationFrame` no existen en SSR.

- **No: Power-ups ni jefes** — Razón: reducen el alcance; candidatos a un spec posterior.

- **No: Componente genérico `CanvasGame`** — Razón: YAGNI.

- **No: RLS en este spec** — Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — Razón: no aporta valor con pocos jugadores.
