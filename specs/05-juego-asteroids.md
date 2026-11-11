# SPEC 05 — Juego real «Rocas» (Asteroids) adaptado al portal

> **Estado:** Implementado
> **Depende de:** SPEC 01 (catálogo `GAMES`, `Player.tsx` y protocolo `postMessage`), SPEC 04 (solo indirectamente: el reproductor ya distingue cuenta e invitado al guardar la marca)
> **Fecha:** 2026-11-11
> **Objetivo:** Sustituir el minijuego de demostración de «Rocas» por el clon de Asteroids de `references/started-games/02-asteroids`, adaptado a `public/games/asteroids.html` con la estética neón del portal y el protocolo `arcade:*`.

---

## Por qué existe esta spec

Hoy solo `snake.html` es un juego real; el resto del catálogo usa `demo.html`. «Rocas» (`id: "rocas"`) ya existe en `lib/games.ts` como Asteroids, pero apunta a `demo.html`. El juego original está terminado (canvas 800×600, ~420 líneas en `game.js`, sin dependencias) y es independiente del portal: no habla con él, usa teclado directo y trae su propio reinicio. Esta spec lo porta como un único HTML siguiendo el patrón de `snake.html`.

La carpeta de referencia en el repo (`references/started-games/02-asteroids`) solo contiene archivos `._*` de macOS (basura de copia), no el juego. El código fuente real está en `C:\Users\rolom\Downloads\started-games.zip` (`02-asteroids/game.js` e `index.html`). **Antes del paso 1, hay que extraer `02-asteroids/` del zip (sin los `._*`) a `references/started-games/02-asteroids/`** para que el original quede versionado como referencia.

Del original, `README.md` documenta controles y puntuación (grande 20, mediano 50, pequeño 100); `game.js` añade además un power-up de triple disparo que el README no menciona.

## Alcance

**Dentro:**

- Nuevo `public/games/asteroids.html`: un solo archivo con el CSS y el script inline (igual que `snake.html`), canvas 800×600 escalado al contenedor (4:3, como el resto de juegos).
- Lógica del original conservada: nave con inercia, asteroides de 3 tamaños que se parten, envolvimiento toroidal, partículas, 3 vidas con invencibilidad al reaparecer, niveles (`3 + nivel` asteroides) y power-up `3x` (triple disparo).
- Estética del portal: fondo `#05050a`, trazos vectoriales con color neón y `shadowBlur`, fuente `Courier New`; HUD propio mínimo (el portal ya muestra puntuación, vidas y nivel fuera del iframe).
- Protocolo con el portal: `arcade:state` al cambiar puntuación, vidas o nivel; `arcade:gameover` al perder la última vida; `arcade:pause` / `arcade:resume` detienen y reanudan la simulación.
- Vidas iniciales desde el parámetro `?vidas=` de la URL (el portal ya lo envía), con 3 por defecto.
- Controles: `←` `→` o `A` `D` rotan, `↑` o `W` propulsan, `Espacio` dispara.
- Pantalla de inicio «PULSA ESPACIO PARA EMPEZAR»: la partida no arranca (ni cuenta la invencibilidad) hasta la primera pulsación.
- `lib/games.ts`: `archivo` de `rocas` pasa a `"asteroids.html"` y se quita la mención a los OVNIs de `larga`.
- Actualizar `CLAUDE.md` (juegos reales: `snake.html` y `asteroids.html`).
- Copiar el juego original (sin `._*`) a `references/started-games/02-asteroids/` como referencia.

**Fuera de alcance (para otras specs):**

- OVNIs, hiperespacio, escudo u otras mecánicas que el original no tiene.
- Controles táctiles / UI para móvil.
- Sonido y música.
- Reinicio interno: el reinicio lo hace el portal (`restart()` en `Player.tsx` recarga el iframe); el juego no escucha Espacio tras el game over.
- Guardado de puntuaciones: sigue siendo cosa del portal (`localStorage`); no se toca `Player.tsx`, `lib/store.ts` ni los rankings.
- Cambios en `snake.html`, `demo.html`, otros juegos, sprites, `recordBase` o el resto del catálogo.
- Pruebas automatizadas (el repo no tiene configuradas).

## Modelo de datos

No hay datos persistentes ni estructuras nuevas en la app. Contratos que se respetan:

```ts
// juego → portal (ya definidos en Player.tsx)
{ type: "arcade:state", score: number, lives: number, level: number }
{ type: "arcade:gameover", score: number }
// portal → juego
{ type: "arcade:pause" } | { type: "arcade:resume" }
```

Estados internos del juego (sustituyen al `'playing' | 'dead' | 'gameover'` original):

```
'ready'    → pantalla de inicio, esperando Espacio
'playing'  → partida en curso
'dead'     → nave destruida, cuenta atrás de 2 s para reaparecer
'gameover' → sin vidas; ya se envió arcade:gameover; sin reinicio interno
```

Más una bandera `paused` independiente del estado.

Cambio en el catálogo, `lib/games.ts` (solo la entrada `rocas`):

| Campo     | Antes                                     | Después                                            |
| --------- | ----------------------------------------- | -------------------------------------------------- |
| `archivo` | `"demo.html"`                             | `"asteroids.html"`                                 |
| `larga`   | «…Cuidado con los OVNIs en el horizonte.» | Sin la frase de los OVNIs (el juego no los tiene). |

Paleta propuesta (a ajustar en implementación, siempre dentro de los colores del portal): nave `#f5ff00` (acento del juego), asteroides `#00f5ff`, balas `#ffffff`, power-up y propulsor `#ff006e`, partículas cian con alfa.

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de tocar nada, leer `components/Player.tsx` y `public/games/snake.html` como referencia del protocolo, y no copiar el estilo `Courier Prime`/pixel del portal dentro del iframe (el juego usa `Courier New`, como Snake).

1. **Referencia.** Extraer `02-asteroids/` del zip de Descargas a `references/started-games/02-asteroids/` excluyendo los `._*`. Prueba: existen `game.js`, `index.html`, `README.md` y `favicon.svg` ahí.
2. **Esqueleto HTML.** Crear `public/games/asteroids.html` con `<meta viewport>`, CSS como el de `snake.html` (`body` en rejilla centrada, `canvas{width:100%;height:100%}`), `<canvas id="c" width="800" height="600">` y el script del original pegado sin cambios funcionales. Prueba: abierto directamente, el juego funciona como el original.
3. **Entrada y estados.** Reemplazar el `keydown` global por el manejo con `e.code` (`ArrowLeft/Right/Up`, `KeyA/D/W`, `Space`) con `preventDefault` para evitar el scroll del iframe; limpiar `keys` al perder el foco. Añadir el estado `'ready'` con el overlay «PULSA ESPACIO PARA EMPEZAR» (la primera pulsación arranca y **no** dispara) y que la invencibilidad inicial de la nave empiece al arrancar. Prueba: al cargar nada se mueve contra la nave y la primera pulsación de Espacio solo inicia.
4. **Protocolo.** Añadir `send()` y `sendState()`; llamar a `sendState()` al iniciar, al cambiar `score`, `lives` o `level`, y a `arcade:gameover` una sola vez al llegar a 0 vidas. Leer `?vidas=`. Escuchar `arcade:pause` / `arcade:resume` (con `e.source === parent` no hace falta: solo hay un padre) para congelar `update` y limpiar teclas. Eliminar el «ESPACIO PARA REINICIAR» y el `initGame()` tras game over. Prueba: en el reproductor del portal el HUD externo refleja puntuación, vidas y nivel, y el pausar/seguir detiene y reanuda el juego.
5. **Estética neón.** Pasar los colores a la paleta del portal, fondo `#05050a`, `shadowBlur` en nave, balas y power-up, `font: 'Courier New'`. Simplificar el HUD interno (el portal ya muestra puntuación/vidas/nivel): conservar solo el contador del power-up `3x` y los overlays «PULSA ESPACIO…» y «GAME OVER». Prueba: se ve coherente junto a Snake.
6. **Independencia de la tasa de refresco.** Cambiar el rozamiento `vx *= 0.987` por frame a `vx *= Math.pow(0.987, dt * 60)` (idéntico a 60 Hz, igual en 144 Hz). Mantener `dt` limitado a 50 ms. Prueba: la inercia se siente igual a 60 y 144 Hz.
7. **Catálogo.** En `lib/games.ts`, entrada `rocas`: `archivo: "asteroids.html"` y retirar la frase de los OVNIs. Prueba: `/juego/rocas/jugar` carga el nuevo juego y las demás rutas no cambian.
8. **Revisión final y documentación.** Jugar una partida completa en `/juego/rocas/jugar` con Playwright (screenshots en `.playwrite-screemshots/`): inicio, disparo, power-up, perder una vida, pausa, game over y reinicio desde el portal; comprobar 375 px. Actualizar `CLAUDE.md` («Solo `snake.html` es un juego real» → `snake.html` y `asteroids.html`). Prueba: criterios de aceptación.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript y `npm run lint` no reporta errores nuevos.
- [ ] `/juego/rocas/jugar` carga `asteroids.html` (no `demo.html`) en el iframe con `sandbox="allow-scripts"`, sin errores en la consola.
- [ ] Al cargar se ve la pantalla «PULSA ESPACIO PARA EMPEZAR» y no se pierde ninguna vida hasta pulsar Espacio; esa primera pulsación no dispara.
- [ ] `←` `→` y `A` `D` rotan la nave, `↑` y `W` propulsan con inercia, `Espacio` dispara; las flechas y Espacio no hacen scroll de la página.
- [ ] Los asteroides grandes se parten en 2 medianos, los medianos en 2 pequeños y los pequeños desaparecen; todo se envuelve por los bordes.
- [ ] Puntuación: grande 20, mediano 50, pequeño 100.
- [ ] El power-up `3x` aparece, al recogerlo dispara 3 balas durante 5 s y muestra su contador.
- [ ] Al chocar con un asteroide se pierde una vida, la nave reaparece a los 2 s con ~3 s de invencibilidad (parpadeo).
- [ ] Al vaciar el campo, el nivel sube y aparecen `3 + nivel` asteroides grandes.
- [ ] El HUD del portal (puntuación, vidas, nivel) se actualiza en vivo a partir de `arcade:state`.
- [ ] Con `?vidas=3` el juego empieza con 3 vidas; sin el parámetro, también 3.
- [ ] Al perder la última vida se envía `arcade:gameover` **una sola vez** con la puntuación final; el portal muestra su panel de fin de partida y su botón de reiniciar recarga el juego desde cero.
- [ ] El juego no se reinicia por su cuenta pulsando Espacio tras el game over.
- [ ] «Pausa» del portal congela el juego (nave, asteroides, balas y contadores) y «Seguir» lo reanuda sin saltos; dejar la pestaña oculta no provoca saltos ni teclas atascadas.
- [ ] Con cuenta se puede guardar la marca y con invitado se registra la marca local, igual que con Snake.
- [ ] La inercia de la nave se siente igual a 60 Hz y a 144 Hz.
- [ ] El juego usa los colores y el fondo del portal y se ve coherente junto a Snake.
- [ ] El canvas mantiene 4:3 y no provoca scroll horizontal a 375 px de ancho.
- [ ] El catálogo, la biblioteca, el detalle (`/juego/rocas`), el salón de la fama y los demás juegos (`demo.html`, `snake.html`) funcionan igual que antes; la descripción de `rocas` ya no menciona OVNIs.
- [ ] `references/started-games/02-asteroids/` contiene el código original (sin `._*`) y `CLAUDE.md` refleja que ahora hay dos juegos reales.

## Decisiones

- **Sí:** un solo `asteroids.html` con CSS y script inline, como `snake.html`. Una sola unidad sin rutas relativas que dependan del iframe; coste: archivo más largo y menos legible el diff contra el original.
- **No:** `asteroids.html` + `asteroids.js`. Conserva el diff pero son dos archivos y una ruta relativa más.
- **Sí:** estética neón del portal (fondo `#05050a`, cian/magenta/amarillo con glow). Coherencia con Snake y el resto de la UI; coste: se pierde el blanco y negro puro del original.
- **Sí:** conservar el power-up `3x` aunque el README no lo mencione. Está en el código y aporta variedad.
- **Sí:** añadir `A` `D` `W` además de las flechas. Coherencia con Snake (que acepta WASD). `Espacio` sigue disparando.
- **Sí:** pantalla de inicio con Espacio. Evita perder vidas al cargar y alinea con el «PULSA UNA FLECHA PARA EMPEZAR» de Snake. El reinicio tras game over lo hace el portal recargando el iframe.
- **No:** reinicio interno con Espacio. Duplicaría el flujo del portal (`restart()` ya recarga el iframe y reinicia el HUD).
- **Sí:** recortar el HUD interno a lo que el portal no muestra (contador `3x`, overlays). Evita duplicar puntuación, vidas y nivel dentro y fuera del canvas.
- **Sí:** rozamiento dependiente de `dt` (`Math.pow(0.987, dt * 60)`). El original lo aplica por fotograma, lo que acelera la inercia en pantallas de 120/144 Hz; a 60 Hz el resultado es idéntico.
- **Sí:** `?vidas=` desde la URL, como Snake. El catálogo ya define `vidas: 3`.
- **Sí:** quitar los OVNIs de la descripción de `rocas`. El juego no los implementa y la ficha no debe prometer algo que no existe.
- **No:** controles táctiles, sonido, OVNIs. Cada uno es una spec independiente.
- **No:** tocar `Player.tsx`, `lib/store.ts` o las puntuaciones. El protocolo existente basta.
- **Sí:** guardar el original en `references/` y extraerlo del zip excluyendo `._*`. Sin él la referencia del repo está vacía, y los `._*` son basura de macOS.
- **Sí:** nombre de archivo `asteroids.html` (como la carpeta de origen y `snake.html`), aunque el `id` del catálogo siga siendo `rocas`.

## Riesgos identificados

| Riesgo                                                          | Mitigación                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| El iframe no tiene el foco y las teclas no llegan al juego      | `Player.tsx` ya hace `frame.current?.focus()` al cargar; probarlo en el paso 8. Si hiciera falta, el juego pide foco al primer clic. |
| Flechas y Espacio hacen scroll de la página padre               | `preventDefault` en las teclas del juego; criterio de aceptación explícito.                                                          |
| Teclas atascadas al pausar o cambiar de pestaña                 | Limpiar `keys` en `blur`, `visibilitychange` y `arcade:pause`.                                                                       |
| Doble `arcade:gameover` o `arcade:state` en exceso              | Bandera de envío de game over y `sendState()` solo ante cambios de valores.                                                          |
| El tamaño fijo 800×600 se ve borroso o pequeño en el contenedor | Escalado por CSS al 100 % del contenedor 4:3; los trazos vectoriales escalan bien. Revisar a 375 px y escritorio.                    |
| El zip de Descargas no está o cambia                            | Es un paso previo explícito (paso 1); sin el original no se implementa nada.                                                         |
| `shadowBlur` caro con muchos objetos y partículas               | Limitar el glow a nave, balas y power-up, no a cada partícula; medir fluidez en el paso 8.                                           |

## Qué **no** está en esta spec

- OVNIs, hiperespacio, escudos, jefes.
- Controles táctiles y adaptación a móvil.
- Sonido, música o efectos.
- Reinicio interno del juego (lo hace el portal).
- Persistencia, puntuaciones en Supabase o cambios en rankings.
- Cambios en otros juegos del catálogo o en `demo.html`.
- Pruebas automatizadas.

Cada uno, si llega, va en su propia spec.
