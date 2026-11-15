# SPEC 11 — Integración del juego Fish Feast

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-15
> **Tema de jam:** Océano
> **Objetivo:** Integrar Fish Feast como juego jugable en Arcade Vault, construyendo su
> canvas desde cero (pez que come peces más pequeños y huye de los más grandes) y
> conectando el leaderboard de Supabase.

---

## Scope

**In:**

- INSERT SQL para añadir la fila `fish-feast` a la tabla `games` en Supabase.
- Crear `components/games/FishFeastGame.tsx` — componente React `"use client"` que
  encapsula el canvas (800 × 600 px) y el game loop completo. Acepta props:
  `paused`, `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`.
- El game loop se construye desde cero con primitivas del canvas (sin sprites ni assets
  nuevos): el jugador controla un pez que crece al comer peces menores; los peces mayores
  le quitan una vida.
- El HUD interno del canvas (score top-left, nivel top-center, vidas top-right, barra de
  crecimiento bajo el score) se dibuja dentro del canvas — patrón doble HUD igual que
  Asteroids, Tetris, Arkanoid y Snake.
- El componente notifica a React de cada cambio de estado vía callbacks (comparando con
  el valor anterior antes de disparar).
- La condición de game over es perder la tercera vida; dispara `onLivesChange(0)` y
  `onGameOver(finalScore)`.
- El prop `paused: boolean` congela el loop (no ejecuta `update()`) pero sigue llamando
  a `draw()`.
- Limpiar los event listeners de teclado (`keydown`, `keyup` en `document`) y el
  `requestAnimationFrame` en el `return` del `useEffect`.
- Crear `app/games/fish-feast/play/page.tsx` — play-page específica para este juego.
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
- Modo de dos jugadores, power-ups o especies especiales (tiburón, pez globo).
- Cover CSS propio — se reutiliza una clase existente; un cover específico queda para un
  spec de CSS posterior.

---

## Data model

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'fish-feast',
  'FISH FEAST',
  'Come peces más pequeños y huye de los grandes.',
  'En el océano manda la cadena alimenticia. Devora a los peces más pequeños que tú para crecer y sumar puntos, y esquiva a los más grandes antes de que te devoren. Cada nivel trae un mar más abarrotado y depredadores más rápidos.',
  'ARCADE',
  'cover-glot',
  'magenta'
);
```

### Props del componente `FishFeastGame`

```ts
interface FishFeastGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estado inicial: `lives = 3`, `score = 0`, `level = 1`, `size = 14` (radio del jugador
en px). `onLivesChange(0)` se dispara justo antes de `onGameOver(score)` al perder la
última vida.

Reglas de puntuación y progresión:

- **Comer un pez menor** (`fish.size < player.size`): `score += fish.size * 2` (redondeado)
  y `growth += 1`.
- **Crecimiento:** cada 5 peces comidos `player.size += 3` (máximo 40) y sube 1 el nivel.
  Al subir de nivel, el score recibe un bonus de `level * 100`.
- **Ser comido** (`fish.size > player.size * 1.1`): `lives -= 1`, el pez jugador se
  reinicia en el centro y es invulnerable 2 s (parpadeo). Los peces con tamaño entre
  `player.size` y `player.size * 1.1` se cruzan sin interacción (zona neutra).
- **Nivel:** `level = 1 + floor(totalEaten / 5)`. Cada nivel aumenta la velocidad media
  de los peces en un 8 % y el máximo de peces simultáneos (`10 + level * 2`, tope 28).

No se introducen nuevas tablas ni tipos TypeScript — se reutilizan `GameRow` y `ScoreRow`
de `lib/supabase/types.ts`.

---

## Implementation plan

1. **INSERT en Supabase** — ejecutar el SQL del data model en el SQL Editor de Supabase.
   Verificación: la fila `fish-feast` aparece en el Table Editor; `/games` muestra la card
   de Fish Feast con cover `cover-glot` y color `magenta`.

2. **Crear `components/games/FishFeastGame.tsx`** — componente `"use client"` que:
   - Renderiza un `<canvas>` de 800 × 600 px.
   - **Jugador:** pez dibujado con primitivas (elipse de cuerpo + triángulo de cola + ojo),
     radio `player.size`, aparece en el centro. Se mueve en 4 direcciones con flechas o
     WASD a `220 px/s`, con aceleración suave (`vel += (target - vel) * 8 * dt`) y límite
     de pantalla. El pez se orienta según la última dirección horizontal.
   - **Peces enemigos:** nacen fuera de la pantalla por el borde izquierdo o derecho (50 %
     cada uno) a una `y` aleatoria y cruzan el canvas en línea recta con una pequeña
     ondulación vertical (`sin`). Tamaño aleatorio ponderado: 60 % menores que el jugador
     (`size ∈ [6, player.size - 1]`), 30 % mayores (`size ∈ [player.size * 1.2, player.size * 2.2]`),
     10 % cercanos al jugador. Velocidad inversamente proporcional al tamaño
     (`60..160 px/s` × `1 + 0.08 * (level - 1)`). Color según relación de tamaño: verde
     (menor, comestible), rojo (mayor, peligroso), amarillo (neutro) — se recalcula cada
     frame para que el color refleje el tamaño actual del jugador.
   - **Spawn:** se mantiene `maxFish = min(28, 10 + level * 2)` peces; cada 0,4 s se
     intenta crear uno si hay hueco. Los peces se eliminan al salir por el lado opuesto.
   - **Colisiones:** círculo-círculo (`dist < a.size + b.size - 4`, con margen de
     perdón). Aplica las reglas de comer / ser comido / neutro del data model.
   - **Invulnerabilidad:** 2 s tras ser comido; durante ese tiempo el jugador no
     interactúa con ningún pez.
   - `draw()` limpia el canvas, pinta un degradado azul con rayos de luz y burbujas
     decorativas, dibuja peces y jugador, y el HUD interno (barra de crecimiento = peces
     comidos en el nivel actual / 5).
   - Llama `onScoreChange`, `onLevelChange` y `onLivesChange` solo cuando el valor cambia
     respecto al anterior.
   - Al llegar a `lives = 0`, llama `onLivesChange(0)` y luego `onGameOver(score)` una
     única vez y detiene `update()`.
   - Prop `paused: boolean` — si es `true`, el loop omite `update()` pero ejecuta `draw()`.
   - Usa `requestAnimationFrame` con `dt` acotado (`min(dt, 0.05)`).
   - Limpia `keydown`, `keyup` y el frame en el `return` del `useEffect`.
     Verificación: el juego arranca en `/games/fish-feast/play` y es jugable con WASD o flechas.

3. **Crear `app/games/fish-feast/play/page.tsx`** — play-page específica:
   - Importa `FishFeastGame` con `dynamic(..., { ssr: false })`.
   - Estado local: `score`, `level`, `lives` (inicial `3`), `paused`, `over`, `name`,
     `saved`, `gameKey`.
   - Pasa `paused` y los cuatro callbacks a `FishFeastGame`.
   - Reutiliza el layout visual de la plataforma (HUD React + CRT + modal game over),
     igual que `app/games/snake/play/page.tsx`; el HUD de vidas muestra `♥` repetido
     `lives` veces (o `—` si es 0).
   - Modal game over: pre-rellena nombre desde `localStorage.getItem('av_player_name')`;
     al confirmar, guarda en `localStorage` e inserta en Supabase
     `{ game_id: 'fish-feast', player_name: name, score, user_id: null }`.
   - Botón de guardar se deshabilita tras el primer envío.
     Verificación: el HUD React refleja score, vidas y nivel en tiempo real; tras una
     partida el score aparece en `/games/fish-feast` y en `/hall-of-fame` al recargar.

4. **Verificación final** — `npm run build` termina sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `fish-feast` existe en la tabla `games` de Supabase con los valores del data model.
- [ ] La card de Fish Feast aparece en `/games` con cover `cover-glot` y color `magenta`.
- [ ] La ruta `/games/fish-feast/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas (800 × 600) se renderiza con el fondo marino, el pez jugador y los peces enemigos.
- [ ] El pez se mueve en 4 direcciones con WASD y flechas, sin salir del canvas.
- [ ] Los peces menores se muestran en verde, los mayores en rojo y los neutros en amarillo,
      y el color se actualiza al crecer el jugador.
- [ ] Comer un pez menor suma `size * 2` puntos y hace crecer al jugador cada 5 peces.
- [ ] Ser tocado por un pez mayor resta 1 vida, reinicia al jugador en el centro y le da 2 s de invulnerabilidad.
- [ ] Los peces de tamaño neutro no producen interacción.
- [ ] El nivel sube cada 5 peces comidos, otorga un bonus de `level * 100` y aumenta velocidad y densidad.
- [ ] El HUD interno del canvas (score, nivel, vidas, barra de crecimiento) se dibuja correctamente.
- [ ] El HUD React de la plataforma refleja en tiempo real score, vidas y nivel.
- [ ] El botón "PAUSA" de la plataforma congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al perder la tercera vida, `onLivesChange(0)` y `onGameOver(score)` se disparan una sola vez.
- [ ] Aparece el modal React de game over con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (3 vidas, score 0, nivel 1, tamaño inicial).
- [ ] Al abrir el modal, el campo de nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] El score guardado aparece en `/games/fish-feast` y en `/hall-of-fame` al recargar.
- [ ] `/hall-of-fame` muestra un tab para Fish Feast.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Doble HUD** — el canvas conserva su HUD interno y React muestra los mismos valores
  en el HUD de la plataforma. Razón: coherencia con el patrón establecido en Asteroids,
  Tetris, Arkanoid y Snake.

- **Sí: 3 vidas con invulnerabilidad de 2 s tras ser comido** — Razón: evita perder varias
  vidas seguidas por reaparecer junto a un depredador y mantiene el HUD estándar.

- **Sí: Código de color verde / amarillo / rojo** — el color comunica en todo momento qué
  se puede comer. Razón: legibilidad inmediata sin tutorial ni texto.

- **Sí: Zona neutra del 10 %** — peces de tamaño casi igual no interactúan. Razón: evita
  colisiones ambiguas y muertes injustas por diferencias de un píxel.

- **Sí: Score proporcional al tamaño del pez comido** — Razón: comer peces más grandes
  (más arriesgado) da más puntos, lo que diferencia a los jugadores en el leaderboard.

- **Sí: Solo primitivas de canvas** — sin sprites ni audio nuevos. Razón: sin coste de
  assets y estética vectorial coherente con la plataforma.

- **Sí: Play-page específica `app/games/fish-feast/play/page.tsx`** — en lugar de modificar
  la ruta genérica `[id]/play`. Razón: coherencia con los demás juegos; Next.js App Router
  da prioridad a rutas estáticas sobre dinámicas.

- **Sí: `dynamic(..., { ssr: false })`** — el componente canvas se carga solo en cliente.
  Razón: `canvas` y `requestAnimationFrame` no existen en el entorno Node.js de Next.js SSR.

- **Sí: Reutilizar `cover-glot`** — Razón: es el cover comecocos/devorador más cercano
  temáticamente; un cover marino propio es CSS ajeno a este spec.

- **No: Tamaño máximo ilimitado** — el jugador se detiene en `size = 40`; a partir de ahí
  solo suben nivel y score. Razón: un pez gigante vacía el mar de depredadores y rompe la
  dificultad progresiva.

- **No: Componente genérico `CanvasGame`** — cada juego tiene su componente propio.
  Razón: YAGNI; generalizar ahora sería abstraer sin caso de uso suficientemente confirmado.

- **No: RLS en este spec** — las tablas quedan abiertas (INSERT y SELECT públicos).
  Razón: se mitiga en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — los scores se ven al recargar.
  Razón: la complejidad de subscriptions no aporta valor mientras haya pocos jugadores activos.
