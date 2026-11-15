# SPEC 12 — Integración del juego Frog Crossing

> **Estado:** Aprobado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-15
> **Tema de jam:** Frogger — cruza la carretera y el río sin hacerte papilla
> **Objetivo:** Integrar Frog Crossing (el Frogger clásico) como juego jugable en Arcade
> Vault, construyendo su canvas desde cero con primitivas del canvas y conectando el
> leaderboard de Supabase. Corresponde al "Frogger" pendiente en `references/game-sugestion-to_do.md`.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `frog-crossing` a la tabla `games` en Supabase.
- Crear `components/games/FrogCrossingGame.tsx` — componente React `"use client"` que
  encapsula el canvas (640 × 560 px) y el game loop completo. Acepta props:
  `paused`, `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`.
- Tablero de 16 × 14 celdas de 40 px: fila 0 = HUD interno, fila 1 = meta con 5 casillas,
  filas 2-6 = río, fila 7 = mediana segura, filas 8-12 = carretera, fila 13 = salida.
- La rana salta una celda por pulsación; los coches atropellan, el agua ahoga y los troncos
  y tortugas llevan a la rana. Se llega a las 5 casillas de meta para pasar de nivel.
- Doble HUD: el canvas dibuja score (arriba-izquierda), nivel (centro), vidas y barra de
  tiempo (arriba-derecha); React muestra los mismos valores en el HUD de la plataforma.
- Notificación a React por callbacks, comparando con el valor anterior antes de disparar.
- Game over cuando las vidas llegan a 0: dispara `onLivesChange(0)` y `onGameOver(finalScore)`.
- El prop `paused: boolean` congela `update()` pero sigue llamando a `draw()`.
- Limpiar los listeners de teclado y el `requestAnimationFrame` en el `return` del `useEffect`.
- Crear `app/games/frog-crossing/play/page.tsx` — play-page específica con estado
  `score`, `level`, `lives`, `paused`, `over`, `name`, `saved`, `gameKey`.
- Modal de guardado: pre-rellena el nombre desde `localStorage` (`av_player_name`), inserta
  en `scores` y persiste el nombre.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase — ya existen (spec 06).
- Controles táctiles o mobile.
- Supabase Auth y RLS — `user_id` se almacena como `null`.
- Realtime en el leaderboard.
- Paginación del leaderboard — se muestran los top 10 fijos.
- Moscas bonus, cocodrilos, nutrias y serpientes del Frogger original.
- Rana hembra para rescatar, sonido y música.
- Cover CSS propio — se reutiliza `cover-rana`, que ya encaja con el tema.
- Animaciones de muerte elaboradas (solo un parpadeo/cruz de 600 ms).

---

## Data model

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frog-crossing',
  'FROG CROSSING',
  'Cruza la carretera y el río sin hacerte papilla.',
  'Guía a la rana desde la orilla hasta las casillas de meta. Esquiva el tráfico de la carretera, salta sobre troncos y tortugas para cruzar el río y llena las cinco casillas antes de que se acabe el tiempo. Cada nivel trae más tráfico y corrientes más rápidas.',
  'ARCADE',
  'cover-rana',
  'green'
);
```

### Props del componente `FrogCrossingGame`

```ts
interface FrogCrossingGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Valores iniciales: `lives = 3`, `score = 0`, `level = 1`.
Regla de nivel: al llenar las 5 casillas de meta, `level` sube 1, las casillas se vacían y
la velocidad base de los carriles se multiplica por `min(2, 1 + 0.12 × (level - 1))`.
Vida extra única al superar 10 000 puntos (máx. 5 vidas).

No se introducen nuevas tablas ni tipos TypeScript — se reutilizan `GameRow` y `ScoreRow`
de `lib/supabase/types.ts`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model.
   Verificación: la fila `frog-crossing` aparece en el Table Editor; `/games` muestra la
   card con cover `cover-rana` y color `green`.

2. **Crear `components/games/FrogCrossingGame.tsx`** — componente `"use client"`:
   - **Canvas:** 640 × 560 px, celda `CELL = 40`. Fondo por franjas: meta/orilla verde
     oscuro (fila 1), río azul oscuro (2-6), mediana y salida verde (7, 13), carretera
     gris con líneas discontinuas (8-12).
   - **Entidades:**
     - `frog`: `{ x, row }` (`x` en px como float para ser arrastrada; `row` entero 1-13),
       tamaño de colisión 28 × 28 centrado en la celda. Arranca en `x = 320`, `row = 13`.
     - `lanes`: array de 10 carriles `{ row, dir (±1), speed, kind, items[] }`, cada ítem
       `{ x, w }` con `w` en celdas × 40. Los ítems se mueven `dir × speed × level_mult × dt`
       y reaparecen por el lado opuesto (wrap con margen de 1 ítem).
     - Carretera (fila → tipo, ancho, velocidad px/s, nº de ítems, dir): 8 → coche 1 celda,
       70, 4, ←; 9 → coche 1 celda, 100, 3, →; 10 → camión 2 celdas, 60, 3, ←; 11 → coche
       1 celda, 130, 3, →; 12 → camión 3 celdas, 80, 2, ←.
     - Río (fila → tipo, ancho, velocidad px/s, nº de ítems, dir): 2 → tortugas grupos de
       3 celdas, 70, 3, ←; 3 → tronco 3 celdas, 60, 3, →; 4 → tronco 5 celdas, 100, 2, →;
       5 → tortugas 2 celdas, 80, 4, ←; 6 → tronco 3 celdas, 50, 3, →.
     - Separación entre ítems del mismo carril: `(640 + w) / n` para espaciado uniforme.
     - Tortugas: desde el nivel 2 se sumergen cíclicamente (periodo 6 s, 1.5 s hundidas,
       con parpadeo 0.5 s antes); hundidas cuentan como agua.
     - `goal`: array de 5 casillas de 56 px de ancho centradas en x = 80, 200, 320, 440, 560
       (rango `[cx - 28, cx + 28]`), cada una `filled: boolean`. El resto de la fila 1 es
       pared. Al ser más anchas que una celda, el centro flotante de la rana tiene margen
       para acertar aunque venga arrastrada por un tronco.
     - `timeLeft`: 30 s por intento; la barra se dibuja en el HUD interno.
   - **`update(dt)`** (dt en segundos, capado a 0.05):
     1. Si `frog.dead` (cuenta atrás 600 ms): decrementa; al terminar resta una vida y
        respawnea (o game over si vidas = 0). No procesa colisiones ni tiempo.
     2. Mueve los carriles y decrementa `timeLeft`; si llega a 0, muerte por tiempo.
     3. Si la rana está en la carretera (filas 8-12): colisión AABB con cualquier ítem del
        carril → muerte por atropello.
     4. Si está en el río (filas 2-6): busca ítem del carril bajo el centro de la rana
        (`frog.x` dentro de `[item.x, item.x + w]`, tortugas hundidas no cuentan). Si no hay
        → muerte por ahogo; si hay → `frog.x += lane.dir × lane.speed × mult × dt`; si
        `frog.x < 0` o `> 640` → muerte.
     5. Si llega a la fila 1: si el centro de la rana cae dentro de una casilla libre →
        `filled = true`, +50 puntos, +`ceil(timeLeft) × 2`, respawn; si cae en pared o en
        casilla llena → muerte.
     6. Si las 5 casillas están llenas: +1000, `level++`, casillas vacías, `timeLeft` reset.
   - **Controles:** flechas y WASD; un salto de 40 px por `keydown` (se ignora
     `e.repeat`). Un salto se anima 80 ms (interpolación visual) y no admite otro salto
     hasta terminar. No se puede salir por los lados (x entre 20 y 620) ni bajar de la
     fila 13. `preventDefault` en flechas para evitar scroll. Durante el salto de 80 ms,
     `frog.row` ya es la fila destino: las colisiones y el arrastre se evalúan contra esa
     fila; la interpolación es solo visual.
   - **Puntuación:** +10 la primera vez que se alcanza cada fila nueva más alta en el
     intento actual (`maxRow`, se resetea al respawnear); +50 por casilla; bonus de tiempo
     y +1000 por nivel completado (ver `update`).
   - **`draw()`** limpia el canvas, dibuja fondos, carriles (rectángulos de colores:
     coches rojos/amarillos con ventanas, camiones grises, troncos marrones, tortugas verdes
     con círculos), casillas de meta con ranas en las llenas, la rana (cuerpo verde, ojos) y
     el HUD interno (fila 0). Si `dead`, dibuja una cruz roja sobre la rana.
   - **Notificaciones:** `onScoreChange`, `onLevelChange` y `onLivesChange` se llaman al
     cambiar el valor respecto al anterior guardado en variables locales.
   - **Game over:** `lives === 0` tras la animación de muerte → `onLivesChange(0)` y
     `onGameOver(score)`.
   - **Pausa:** `pausedRef.current` impide `update()` pero se llama a `draw()`.
   - Bucle con `requestAnimationFrame` y `dt` por timestamp; en el `return` del
     `useEffect` se cancela el frame y se retira `keydown` de `document`.
     Verificación: `/games/frog-crossing/play` es jugable; la rana muere por tráfico, agua
     y tiempo; las casillas se llenan y el nivel sube.

3. **Crear `app/games/frog-crossing/play/page.tsx`** — play-page específica:
   - Importa `FrogCrossingGame` con `dynamic(..., { ssr: false })`.
   - Estado local: `score`, `level`, `lives` (inicial `3`), `paused`, `over`, `name`,
     `saved`, `gameKey`.
   - Mismo layout visual (HUD React + CRT + modal game over) que
     `app/games/snake/play/page.tsx`.
   - Modal: pre-rellena el nombre desde `localStorage.getItem('av_player_name')`; al
     confirmar guarda en `localStorage` e inserta
     `{ game_id: 'frog-crossing', player_name: name, score, user_id: null }`.
   - Botón de guardar deshabilitado tras el primer envío (`saved`).
     Verificación: el HUD React refleja score, nivel y vidas en tiempo real; tras la
     partida el score aparece en `/games/frog-crossing` y `/hall-of-fame`.

4. **Verificación final** — `npm run build` sin errores de TypeScript. Ninguna ruta
   existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `frog-crossing` existe en la tabla `games` con los valores del data model.
- [ ] La card de Frog Crossing aparece en `/games` con cover `cover-rana` y color `green`.
- [ ] `/games/frog-crossing/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas (640 × 560) renderiza carretera, río, mediana, meta y salida.
- [ ] La rana salta una celda por pulsación con flechas y WASD, sin salir del tablero.
- [ ] Los coches y camiones matan a la rana al contacto.
- [ ] La rana se ahoga en el río salvo que esté sobre un tronco o tortuga, y es arrastrada por ellos.
- [ ] Las tortugas se sumergen desde el nivel 2.
- [ ] Llegar a una casilla libre de la meta (56 px de ancho) la llena y suma puntos; llegar a una pared o casilla llena mata.
- [ ] Al superar 10 000 puntos se concede una única vida extra (máx. 5 vidas).
- [ ] Agotar los 30 s mata a la rana.
- [ ] Llenar las 5 casillas sube el nivel y aumenta la velocidad.
- [ ] El HUD interno del canvas (score, nivel, vidas, barra de tiempo) se dibuja correctamente.
- [ ] El HUD React refleja en tiempo real score, nivel y vidas.
- [ ] El botón "PAUSA" congela el juego; "REANUDAR" lo reanuda.
- [ ] Al perder la tercera vida se disparan `onLivesChange(0)` y `onGameOver(score)`.
- [ ] Aparece el modal React de game over con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero.
- [ ] El campo de nombre se pre-rellena con `av_player_name` si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] El score aparece en `/games/frog-crossing` y en `/hall-of-fame` al recargar.
- [ ] `/hall-of-fame` muestra un tab para Frog Crossing.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Doble HUD** — el canvas conserva su HUD interno y React muestra los mismos valores.
  Razón: coherencia con Asteroids, Tetris, Arkanoid y Snake.

- **Sí: 3 vidas** — el Frogger clásico las tiene y encaja de forma natural con el HUD
  estándar. Razón: tensión por intento sin castigar un solo error.

- **Sí: Salto discreto de una celda, sin repetición de tecla** — Razón: es la sensación
  Frogger original y evita cruzar la carretera manteniendo una tecla.

- **Sí: Rana con posición `x` flotante** — Razón: debe moverse con troncos y tortugas
  aunque estos no estén alineados a la rejilla.

- **Sí: Reutilizar `cover-rana`** — Razón: ya existe y representa el tema; un cover propio
  queda para un spec de CSS.

- **Sí: Play-page específica `app/games/frog-crossing/play/page.tsx`** — Razón: coherencia
  con los demás juegos; las rutas estáticas tienen prioridad sobre `[id]/play`.

- **Sí: `dynamic(..., { ssr: false })`** — Razón: `canvas` y `requestAnimationFrame` no
  existen en el SSR de Node.js.

- **Sí: Tortugas que se sumergen solo desde el nivel 2** — Razón: curva de dificultad
  progresiva sin frustrar el nivel 1.

- **No: Moscas, cocodrilos y nutrias** — Razón: aumentan el alcance; se pueden añadir en
  un spec posterior.

- **No: Componente genérico `CanvasGame`** — Razón: YAGNI.

- **No: RLS en este spec** — Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — Razón: no aporta valor con pocos jugadores activos.
