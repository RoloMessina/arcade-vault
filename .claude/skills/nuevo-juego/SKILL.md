---
name: nuevo-juego
description: Crea un juego nuevo para Arcade Vault e lo integra en la plataforma con su leaderboard en Supabase. Úsala cuando el usuario pida añadir, portar o convertir un juego (desde references/started-games/ o escrito desde cero) al catálogo, o sustituir un juego demo por uno real.
argument-hint: "<id-del-juego> [ruta de referencia, p. ej. references/started-games/03-tetris]"
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(ls:*), Bash(git status:*), Bash(git diff:*), Bash(npm run build:*), Bash(npm run lint:*), mcp__supabase__apply_migration, mcp__supabase__execute_sql, mcp__supabase__list_tables, mcp__supabase__get_advisors
---

# /nuevo-juego — Añadir un juego con leaderboard

Destila los patrones de la SPEC 05 (`specs/05-juego-asteroids.md`, portar un juego HTML al portal) y la SPEC 06 (`specs/06-leaderboard-supabase.md`, tabla `games` + `scores`). Léelas si algo no queda claro. Responde en español.

## 0. Antes de empezar

1. Lee `CLAUDE.md` (arquitectura) y `components/Player.tsx` (protocolo). Next es 16.x: si tocas Server Actions o caché, lee `node_modules/next/dist/docs/`.
2. Lee `public/games/snake.html` y `public/games/asteroids.html` como plantilla viva del patrón.
3. Si el usuario da una referencia, léela entera (`game.js`, `index.html`, `README.md`, `CLAUDE.md`). Ignora los archivos `._*` (basura de macOS). Si la carpeta está vacía, el original puede estar en un zip en Descargas: pídeselo antes de seguir. Si no hay referencia, escribe el juego desde cero con el mismo patrón.
4. Si el juego ya existe en `GAMES` con `archivo: "demo.html"`, se **sustituye** (no se crea otra entrada ni otra fila en `games`; solo cambia `archivo`). Si no existe, es un juego nuevo.
5. Confirma con el usuario (solo si no está claro): `id` (kebab-case, el de `GAMES`), nombre del archivo, vidas, `record_base` esperado. Resto por defecto.
6. Pide o propone una mini-spec solo si el juego añade mecánicas grandes; para un port simple basta seguir esta skill.

## 1. Referencia versionada

Copia el original (sin `._*`) a `references/started-games/NN-nombre/` si aún no está ahí.

## 2. El juego: `public/games/<archivo>.html`

Un único HTML con CSS y script inline, como `snake.html`/`asteroids.html`. Se carga en un iframe `sandbox="allow-scripts"` (sin `allow-same-origin`: nada de `localStorage`, cookies ni `fetch` al portal).

- **Layout:** `<meta viewport>`, `body` en rejilla centrada, `canvas{width:100%;height:100%;display:block;touch-action:none}`, canvas con relación 4:3 (p. ej. 800×600). Sin scroll horizontal a 375 px.
- **Estética:** fondo `#05050a`, colores neón del portal (cian `#00f5ff`, magenta `#ff006e`, amarillo `#f5ff00`, verde `#00ff88`) con `shadowBlur` solo en pocos elementos (no en cada partícula). Fuente `Courier New` dentro del iframe. HUD interno mínimo: el portal ya muestra puntuación, vidas y nivel.
- **Vidas:** `const MAXLIVES = +new URLSearchParams(location.search).get("vidas") || 3`.
- **Protocolo `postMessage`** (nada más; no tocar `Player.tsx`):
  ```js
  const send = (m) => parent.postMessage(m, "*");
  // juego → portal
  send({ type: "arcade:state", score, lives, level }); // al iniciar y SOLO cuando cambie score, lives o level
  send({ type: "arcade:gameover", score }); // UNA sola vez, con una bandera
  // portal → juego
  addEventListener("message", (e) => {
    if (e.data?.type === "arcade:pause") {
      paused = true;
      keys = {};
    }
    if (e.data?.type === "arcade:resume") {
      paused = false;
      last = performance.now();
    }
  });
  ```
- **Estados:** `'ready'` (pantalla «PULSA … PARA EMPEZAR»; no se pierde ni una vida antes; la primera pulsación solo inicia) → `'playing'` → `'gameover'`. **Sin reinicio interno**: el reinicio lo hace el portal recargando el iframe.
- **Entrada:** usa `e.code` (flechas + `WASD` + `Space`) con `preventDefault` para que no haga scroll el padre. Limpia `keys` en `blur`, `visibilitychange` y `arcade:pause`.
- **Tiempo:** bucle con `requestAnimationFrame` y `dt` limitado (≤ 50 ms). Todo rozamiento/inercia independiente de la tasa de refresco: `v *= Math.pow(f, dt * 60)`.
- **Sin** sonido, táctil ni mecánicas extra salvo petición.
- Al portar: conserva la lógica del original; cambia solo entrada, estados, protocolo, estética y `dt`. Si el original tiene un extra que el README no menciona (p. ej. power-up), consérvalo y dilo.

### Casos reales de `started-games` (zip en `C:\Users\rolom\Downloads\started-games.zip`)

- **`03-tetris`** (→ `caida`, `vidas: 1`): `index.html` + `style.css` + `game.js`; tablero 300×600 (vertical) y canvas `next` aparte; no tiene vidas ni 4:3. Fusiona CSS/JS en un HTML. Dentro del iframe 4:3 dibuja el tablero a la izquierda y la pieza siguiente (y nivel/líneas) a la derecha en un único canvas, o escala el tablero a la altura del contenedor. Sustituye sus overlays PAUSE/GAME OVER y el botón de reinicio por `arcade:pause` y `arcade:gameover`. `level` = `floor(lines/10)+1`. Controles: flechas, `X`/↑ rotar, `Espacio` caída; `preventDefault`. Ignora `.Claude/` y `.github/`.
- **`04-arkanoid`** (→ `bloque-buster`): `game.js` + `levels.js` + `assets/spritesheet.js` + PNG + 2 MP3. Hay dos caminos: (a) fusionar todo el JS inline y dejar los assets en `public/games/assets/<id>/` (`<img>`/`new Audio()` con ruta absoluta `/games/assets/<id>/…` funcionan en el iframe sandbox; `fetch` desde el iframe NO, su origen es opaco), o (b) incrustar el PNG en base64. Prefiere (a). Tiene 3 vidas, 5 niveles y estado `win`: al ganar el último nivel envía `arcade:gameover` con la puntuación final. Mueve la paleta con `mousemove` (convierte coordenadas con `getBoundingClientRect` por el escalado) y con flechas; el primer clic o tecla lanza la pelota (estado `ready`). Sonidos: el original los trae, así que se conservan (reproducir solo tras la primera interacción) aunque la SPEC 05 los dejaba fuera para Asteroids. Ignora `specs/`, `.agents/` y `.claude/`.
- Los zips traen basura de macOS: extrae a una carpeta temporal y copia a `references/started-games/NN-nombre/` solo los archivos reales (sin `._*`, `.DS_Store`).

## 3. Catálogo de UI: `lib/games.ts`

Edita/añade la entrada en `GAMES`: `id`, `titulo`, `categoria`, `corta`, `larga`, `accent`/`accent2`, `portada` (clase CSS existente en `globals.css`), `sprite` (8×8 pixel-art), `archivo`, `vidas`, `recordBase`, `partidas`, `dificultad`. Ajusta `larga`/`corta` para no prometer mecánicas que el juego no tiene (p. ej. OVNIs). `GAMES` es el único origen de verdad de la UI.

## 4. Base de datos: tabla `games` y semillas

`guardarPuntuacion` rechaza cualquier `gameId` que no exista en `public.games`, así que `GAMES` y `games` se cambian a la vez, **con una migración nueva** en `supabase/migrations/<timestamp>_<id>.sql` (timestamp posterior a la última) aplicada con `mcp__supabase__apply_migration`. No edites migraciones ya aplicadas.

**Juego nuevo** (valores de `GAMES`; `score_max = record_base * 10` salvo razón justificada; para juegos de pocos puntos, `score_max >= record_base`):

```sql
insert into public.games (id, titulo, categoria, archivo, vidas, record_base, score_max)
values ('<id>', '<Título>', '<Categoría>', '<archivo>.html', 3, <record_base>, <record_base * 10>);

-- 10 puntuaciones semilla (misma fórmula que las de los demás juegos).
insert into public.scores (game_id, user_id, nombre, score, es_semilla, created_at)
select
  g.id, null,
  (array['NEO_RIDER','LUNA88','PIXELFOX','KAIJU','DR_BYTE','TURBO_T','ROSA_V','MAXPOWER','CHIPA','ZXCVBN'])[i + 1],
  (floor(
    (g.record_base::float8
      * (1 - i * 0.085::float8 - (((i * 7 + length(g.id)) % 5) * 0.012::float8))
      / (case when g.record_base < 100 then 1 else 10 end)
    ) + 0.5
  ) * (case when g.record_base < 100 then 1 else 10 end))::int,
  true,
  (date '2026-10-28' - 2 * i)::timestamp at time zone 'UTC' + interval '12 hours'
from public.games g
cross join generate_series(0, 9) as i
where g.id = '<id>';
```

**Juego existente** (solo cambia el archivo u otros datos): `update public.games set archivo = '<archivo>.html' where id = '<id>';` (y `record_base`/`score_max` solo si cambian). No toques `scores`.

Después: `get_advisors` (security) sin problemas nuevos y `select count(*) from scores where game_id = '<id>'` = 10 si era nuevo.

## 5. Lo que NO hay que tocar

El leaderboard ya es genérico por `id`: `lib/leaderboard.ts`, `Leaderboard`, `Podium`, `GameStats`, `HallOfFame`, `GameLibrary`, `Player.tsx`, `guardarPuntuacion` y la caché (`LEADERBOARD_TAG`) funcionan sin cambios para cualquier juego que esté en `GAMES` y `games`. Invitados: solo marca local (`av:guest-best`), fuera del ranking. No uses `service_role`.

## 6. Verificación

1. `npm run build` y `npm run lint` sin errores nuevos.
2. Con Playwright (screenshots en `.playwrite-screemshots/`, ver memoria) en `/juego/<id>/jugar`: pantalla de inicio, controles, perder una vida, pausa/seguir, game over, reinicio desde el portal, 375 px. Sin errores en consola.
3. `/juego/<id>` muestra el top 10 y el podio semilla; con cuenta, guardar una marca la inserta en `scores` y aparece al recargar. Con invitado solo se guarda `av:guest-best`.
4. Criterios de la SPEC 05 (juego) y SPEC 06 (ranking) aplicables, en particular: `arcade:gameover` una sola vez, sin reinicio interno, sin scroll de la página con flechas/Espacio, `?vidas=` respetado, resto de juegos intactos.

## 7. Documentación

Actualiza `CLAUDE.md`: la lista de «juegos reales» en **Juegos HTML** (hoy `snake.html` y `asteroids.html`; el resto usa `demo.html`). Resume al usuario qué archivos cambiaron y deja el commit/PR para cuando lo pida.
