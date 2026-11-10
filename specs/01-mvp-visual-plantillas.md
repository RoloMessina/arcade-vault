# SPEC 01 — MVP visual de Arcade Vault según las plantillas

> **Estado:** Implementado
> **Depende de:** ninguna (primera spec del repo)
> **Fecha:** 2026-11-09
> **Objetivo:** Alinear las 5 pantallas ya existentes de Arcade Vault con las plantillas de `references/templates/` (catálogo de 8 juegos, podio, franja de estadísticas, contador de créditos y detalles globales) sin tocar la lógica actual.

---

## Por qué existe esta spec

El repo ya tiene un MVP visual en Next.js (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/acceso`, `/salon-de-la-fama`). Esta spec no lo rehace: es una **auditoría contra las plantillas** (`data.jsx`, `nav.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `auth.jsx`, `salon.jsx`, `app.jsx`, `styles.css`) y define solo las diferencias a cerrar. Las plantillas son prototipos React + Babel con datos falsos y enrutado por hash; sirven de referencia visual, no de código a copiar.

## Alcance

**Dentro:**

- Sustituir el catálogo de 6 clásicos por los 8 juegos de `data.jsx`, con sus textos, categorías, partidas y mejor puntuación.
- Añadir la franja de estadísticas y las etiquetas en `/juego/[id]` (Partidas, Mejor global, Dificultad ★).
- Añadir el podio de los 3 primeros y el botón "Volver a la biblioteca" en `/salon-de-la-fama`.
- Añadir el contador decorativo `CRÉDITOS · 03` en la navbar de escritorio y en el menú móvil.
- Detalles globales: capa de ruido de fondo, subtítulo y aviso de términos en `/acceso`, versión `v2.6.0` en el footer.
- Portar a `app/globals.css` solo las clases y tokens que faltan (`--green`, `--silver`, `--bronze`, podio, franja de estadísticas, créditos, ruido).

**Fuera de alcance (para otras specs):**

- Implementar juegos reales. Solo `snake.html` es real; el resto sigue con `demo.html`.
- Sustituir el reproductor por la arena simulada de `reproductor.jsx` (puntos falsos, botón FIN). Se mantiene el iframe con `postMessage`.
- Quitar la validación de `/acceso` o el store con `localStorage`.
- Enrutado por hash de la plantilla. Se mantienen las rutas de Next.
- Portar `styles.css` completo ni las portadas CSS (`cover-bricks`, `cover-snake`…). Las portadas siguen siendo sprites pixel-art.
- Backend real (REST / Supabase) y contador de créditos con lógica.
- Cambios en `public/games/` (`snake.html`, `demo.html`).

## Modelo de datos

Se amplía el tipo `Game` de `lib/games.ts`. `ScoreEntry`, el store y las claves de `localStorage` no cambian.

```ts
export type Game = {
  id: string;
  titulo: string;
  categoria: string;
  corta: string;
  larga: string;
  accent: string;
  accent2: string;
  sprite: string[];
  archivo: string;
  vidas: number;
  recordBase: number;   // = `best` de data.jsx
  partidas: string;     // NUEVO: texto tal cual, p. ej. "12.4K"
  dificultad: 1 | 2 | 3 | 4 | 5; // NUEVO: estrellas llenas de 5
};
```

Catálogo resultante (`id` → origen en `data.jsx`):

| id | titulo | categoria | accent | archivo | recordBase | partidas |
| --- | --- | --- | --- | --- | --- | --- |
| `bloque-buster` | Bloque Buster | Arcade | cian | `demo.html` | 28450 | 12.4K |
| `caida` | Caída | Puzzle | magenta | `demo.html` | 184220 | 31.8K |
| `serpentina` | Serpentina | Arcade | verde | `snake.html` | 7820 | 9.1K |
| `gloton` | Glotón | Arcade | amarillo | `demo.html` | 96400 | 27.2K |
| `invasores` | Invasores | Shooter | verde | `demo.html` | 54190 | 18.0K |
| `rocas` | Rocas | Shooter | amarillo | `demo.html` | 41200 | 15.6K |
| `ranaria` | Ranaria | Arcade | verde | `demo.html` | 18900 | 6.4K |
| `duelo-pixel` | Duelo Pixel | Versus | cian | `demo.html` | 24 | 4.2K |

Convenciones:

- `corta` y `larga` salen literalmente de `short` y `long` de `data.jsx`.
- `dificultad` vale 3 en los 8 juegos, igual que el `★ ★ ★ ☆ ☆` fijo de `detalle.jsx`.
- Los sprites 8×8 se reutilizan: Arkanoid→`bloque-buster`, Tetris→`caida`, Snake→`serpentina`, Pac-Man→`gloton`, Invaders→`invasores`, Asteroids→`rocas`. Se dibujan dos nuevos (`ranaria`, `duelo-pixel`).
- `CATEGORIAS` se sigue derivando de `GAMES` (`Todos, Arcade, Puzzle, Shooter, Versus`).
- Nuevos tokens CSS en `:root`: `--green: #00ff88`, `--silver: #c7d0e0`, `--bronze: #d97a3a` (valores de `styles.css`). `--gold` ya existe y no se toca.

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de escribir código, leer la guía relevante en `node_modules/next/dist/docs/` (Next 16: `params` es `Promise`).

1. **Catálogo.** En `lib/games.ts`, ampliar `Game` y reemplazar `GAMES` por los 8 juegos de la tabla. Añadir `--green` a `globals.css`. Dibujar los sprites de `ranaria` y `duelo-pixel`. Prueba: `/` muestra 8 tarjetas, los chips filtran por las 4 categorías y `/juego/serpentina/jugar` carga `snake.html`.
2. **Créditos en la navbar.** En `components/Navbar.tsx`, añadir `Créditos · 03` entre los enlaces y el bloque de usuario (escritorio) y al pie del drawer (móvil). Clase `.coin-counter` y moneda CSS en `globals.css`. Prueba: visible en `/`, ausente en `/juego/*/jugar`.
3. **Detalle.** En `app/juego/[id]/page.tsx`, añadir la fila de etiquetas (categoría, `1 jugador`, `Teclado / táctil`, `Retro 1985`) y un componente cliente `components/GameStats.tsx` con Partidas, Mejor global y Dificultad ★. "Mejor global" usa el primer puesto de `buildBoard`. Clases `.detail-tags` y `.stat-strip` en `globals.css`. Prueba: `/juego/caida` muestra `31.8K`, un mejor global coherente con el top 1 del ranking y 3 estrellas llenas de 5.
4. **Podio y navegación del Salón.** Crear `components/Podium.tsx` (puestos 2-1-3 con oro, plata y bronce, "CAMPEÓN" en el primero) y renderizarlo en `components/HallOfFame.tsx` sobre la tabla, alimentado por `buildBoard`. Añadir el botón "Volver a la biblioteca" al pie de `app/salon-de-la-fama/page.tsx`. Prueba: cambiar de pestaña actualiza el podio y se mantiene la fila "TU MEJOR MARCA".
5. **Detalles globales.** Añadir la capa `.vault-noise` en `app/layout.tsx`, el subtítulo `ACCESO AL SISTEMA · v2.6` y el aviso `AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE` en `app/acceso/page.tsx`, y ` · v2.6.0` al final del footer del layout. Prueba: aparecen en sus pantallas y no interceptan clics (`pointer-events: none`).

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `/` muestra exactamente 8 tarjetas con los títulos de la tabla del modelo de datos.
- [ ] Los chips de `/` son `Todos, Arcade, Puzzle, Shooter, Versus` y cada uno filtra correctamente.
- [ ] Buscar "serp" muestra solo Serpentina; buscar "zzz" muestra el estado "SIN RESULTADOS".
- [ ] `/juego/serpentina/jugar` carga `snake.html`; los otros 7 juegos cargan `demo.html`.
- [ ] `/juego/ranaria` y `/juego/duelo-pixel` muestran portada con sprite propio, no vacía.
- [ ] `/juego/[id]` muestra las 4 etiquetas, `Partidas` con el valor de la tabla y `Dificultad` con 3 estrellas llenas de 5.
- [ ] El "Mejor global" del detalle coincide con la primera fila del ranking de esa misma página.
- [ ] `/salon-de-la-fama` muestra un podio con 3 puestos ordenados 2-1-3 y los nombres coinciden con las 3 primeras filas de la tabla.
- [ ] Al cambiar de juego en el Salón, el podio y la tabla cambian a la vez.
- [ ] `/salon-de-la-fama` termina con un botón "Volver a la biblioteca" que lleva a `/`.
- [ ] `Créditos · 03` aparece en la navbar de escritorio y en el drawer móvil, y no aparece en `/juego/[id]/jugar`.
- [ ] `/acceso` muestra el subtítulo y el aviso de términos, y la validación de usuario, contraseña y correo sigue funcionando.
- [ ] El footer termina en `v2.6.0` en todas las rutas con footer.
- [ ] La capa de ruido no bloquea clics en botones, enlaces ni campos.
- [ ] Ninguna pantalla tiene scroll horizontal a 375 px de ancho.
- [ ] Guardar una puntuación con cuenta en `/juego/gloton/jugar` hace que aparezca en el ranking de Glotón y en el Salón.

## Decisiones

- **Sí:** adoptar los 8 juegos de `data.jsx`. Es la referencia visual aprobada y el catálogo actual no está ligado a ningún dato persistente que valga la pena conservar.
- **Sí:** Serpentina usa `snake.html`. Es el único juego real y no debe perder jugabilidad.
- **Sí:** portar solo los estilos que faltan a `globals.css`. Respeta la regla del `CLAUDE.md` de que los estilos viven ahí y evita reescribir el marcado de las 5 pantallas.
- **No:** portar `styles.css` completo. Reescribiría todos los componentes por ~33 KB de CSS, la mayoría ya cubierto.
- **Sí:** mantener las portadas con sprites y no portar `cover-bg`. El `Cover` actual ya funciona y las portadas CSS de la plantilla son 8 gradientes a medida que duplicarían el sistema. Se aceptó al elegir "portar solo lo que falta".
- **Sí:** mantener el reproductor con iframe, la validación de `/acceso`, el store con `localStorage` y las rutas de Next. La plantilla los simplifica porque es una maqueta.
- **Sí:** "Créditos · 03" es solo decorativo. En la plantilla es texto fijo.
- **Sí:** "Mejor global" se calcula con `buildBoard`, no con `best` de la plantilla, para que coincida con el ranking que se ve en la página.
- **Sí:** `dificultad = 3` para los 8 juegos. La plantilla usa el mismo valor para todos y no hay criterio para diferenciarlos.
- **Sí:** el footer conserva "PÍXELES" con tilde y añade solo la versión; la plantilla escribe "PIXELES".
- **No:** copiar el tagline del Salón ("LOS NOMBRES QUE NUNCA SE BORRAN…") ni la fila "tu mejor marca" de la plantilla. El texto actual y el panel "TU MEJOR MARCA" ya cubren esa función con datos reales.
- **No:** hash routing ni `localStorage` con las claves de la plantilla (`av_user`, `av_scores`). El store actual usa `av:user` y `av:scores`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Los `id` de juego cambian (`snake`→`serpentina`, etc.) y las puntuaciones ya guardadas en `localStorage` bajo `av:scores` y `av:guest-best` quedan huérfanas | `buildBoard` filtra por `gameId`, así que las antiguas se ignoran sin errores. Es un MVP simulado y no se migran. |
| `recordBase` de Duelo Pixel es 24 y la fórmula de `seedScores` produce marcas muy bajas o con poca separación | Comprobar el ranking de `/juego/duelo-pixel`: 10 filas, orden descendente y sin valores ≤ 0. Si falla, ajustar `recordBase` solo para ese juego. |
| Dos juegos comparten `accent` verde o amarillo y se ven iguales en la biblioteca | Distinguirlos con `accent2` y con el sprite. No se cambia el color que define la plantilla. |
| La capa de ruido tapa la UI o resta rendimiento en móvil | `pointer-events: none`, `position: fixed` y opacidad baja. Es el criterio de aceptación sobre clics. |

## Qué **no** está en esta spec

- Juegos reales distintos de Snake.
- Reproductor con arena simulada o botón FIN.
- Backend, autenticación real o créditos funcionales.
- Portado completo de `styles.css` o de las portadas CSS.
- Tests automatizados (el repo no tiene configurados).

Cada uno, si llega, va en su propia spec.
