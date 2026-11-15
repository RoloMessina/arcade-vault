# Estado móvil

Referencia del estado de la web en el navegador del móvil, mantenida por el agente `mobile-porter` (`.claude/agents/mobile-porter.md`). Regla del proyecto: sin scroll horizontal, controles táctiles en cada juego, canvas escalado sin distorsión y áreas táctiles ≥ 44 px.

Última verificación: 2026-11-15 (auditoría fase 1, Playwright, 390×844, 360×740 con `hasTouch` y 1280×800 sin táctil). Sin probar en dispositivo real ni con `npm run build`.

## Resumen por ruta

| Ruta                             | Sin overflow 390 / 360 | Táctil               | Canvas OK                        | Áreas táctiles ≥ 44 px                                                |
| -------------------------------- | ---------------------- | -------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `/`                              | Sí / **No (371 px)**   | n/a                  | n/a                              | No: logo 36, hamburguesa 41, `VER SALÓN` 41                           |
| `/games`                         | Sí / Sí                | n/a                  | n/a                              | No: chips 39, JUGAR 41, buscador 20, hamburguesa, logo                |
| `/games/[id]` (tetris)           | Sí / Sí                | n/a                  | n/a                              | Solo logo y hamburguesa                                               |
| `/games/[id]/play` (genérica)    | Sí / Sí                | **Sin TouchControls** | Sin canvas (maqueta con DOM)     | No: PAUSA/FIN/SALIR 41                                                |
| `/games/asteroids/play`          | Sí / Sí                | Sí (4 botones OK)    | Sí (4:3, contain)                | No: select skin 23, botones HUD 41                                    |
| `/games/tetris/play`             | Sí / Sí                | Sí (5 botones OK)    | Sí (1:2, contain)                | No: igual                                                             |
| `/games/arkanoid/play`           | Sí / Sí                | Sí (2 botones OK)    | Sí (4:3; `object-fit: fill`)     | No: igual                                                             |
| `/games/snake/play`              | Sí / Sí                | Sí (4 botones OK)    | Sí (1:1; `object-fit: fill`)     | No: igual y modal 41                                                  |
| `/hall-of-fame`                  | Sí / Sí                | n/a                  | n/a                              | No: chips 39                                                          |
| `/about`                         | Sí / Sí                | n/a                  | n/a                              | Solo logo y hamburguesa                                               |
| `/auth`                          | Sí / Sí                | n/a                  | n/a                              | No: invitado 41, Google/GitHub 39                                     |

Escritorio 1280×800: `scrollWidth <= innerWidth` en todas, `.touch-controls` en `display: none` en las 4 play-pages. Canvas: Asteroids y Arkanoid 1004×753, Tetris 300×600, Snake 753×753 (referencia para comparar tras los arreglos).

## Problemas abiertos (priorizados)

1. **Alta.** Modal de fin de juego (Snake, 390 y 360): el botón `GUARDAR PUNTUACIÓN` se sale del modal por la derecha (right 432 > 390) en `.input-row`. Probablemente afecta a las 4 play-pages.
2. **Alta.** Controles táctiles bajo el pliegue: Tetris 390×844 los tiene en y 844-972 (canvas 353-766), no se ve tablero y controles a la vez. En 360×740 caen bajo el pliegue Tetris, Asteroids, Arkanoid y Snake.
3. **Media.** `/` en 360 px: scroll horizontal de 11 px por `.activity-card` (339 px de ancho desde x=32); ancestro de rejilla sin `min-width: 0`.
4. **Media.** Áreas táctiles < 44 px (botones HUD 41, chips 39, select de skin 23, hamburguesa 41, logo 36, JUGAR 41, buscador 20, auth 39/41).
5. **Media.** `/games/[id]/play` genérica sin `TouchControls` (no hay canvas real; es maqueta).
6. **Baja.** Arkanoid: la pala no se arrastra con el dedo, solo botones/ratón.
7. **Baja.** Botón de cabecera `Iniciar Sesión` se parte en 2 líneas en móvil (ocupa mucho ancho).
8. **Baja.** Snake: la partida termina sola a los pocos segundos sin input (comportamiento del juego, fuera del alcance).

## No es un problema

- Elementos de la nav con `right = 690`: menú móvil fuera de pantalla (`fixed`).
- En dev, el indicador de Next.js (`NEXTJS-PORTAL`) tapa el botón ◀ de abajo a la izquierda y bloquea el toque; no existe en producción.
- Las capturas full-page de `/` salen casi vacías porque `RevealObserver` solo revela al hacer scroll.

## Pendiente

- Probar en un dispositivo real y con `npm run build`.
- Modales con teclado virtual abierto.
