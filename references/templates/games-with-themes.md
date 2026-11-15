# Juegos con skins

Referencia del estado de skins por juego. Regla del proyecto: todo juego debe tener al menos 3 skins — `classic` (default), `neon` y `retro` — y las tres deben verse bien en modo oscuro.

Última auditoría: 2026-11-15 (Tetris, Asteroids, Arkanoid y Snake verificados visualmente con Playwright).

## Estado

| Juego     | classic (default) | neon | retro | Selector + localStorage         | Dark OK | Cumple |
| --------- | ----------------- | ---- | ----- | ------------------------------- | ------- | ------ |
| Tetris    | Sí                | Sí   | Sí    | Sí (`tetris-skin`)              | Sí      | Sí     |
| Asteroids | Sí                | Sí   | Sí    | Sí (`asteroids-skin`)           | Sí      | Sí     |
| Arkanoid  | Sí                | Sí   | Sí    | Sí (`arkanoid-skin`)            | Sí      | Sí     |
| Snake     | Sí                | Sí   | Sí    | Sí (`snake-skin`)               | Sí      | Sí     |
| Frogger   | Sí                | Sí   | Sí    | Sí (`frogger-skin`)             | Sin verificar visualmente | Sí (pendiente de verificación) |

Juegos con las 3 skins completas: **Tetris**, **Asteroids**, **Arkanoid**, **Snake**, **Frogger**.

## Notas por juego

- **Tetris** — skins: `classic` (default, nueva), `neon` y `retro` (rehecha 8-bit con bisel). `pastel` y `pixel` eliminadas (2026-11-15); un `tetris-skin` guardado con esos valores cae a `classic`. Verificadas con Playwright en modo oscuro; persistencia OK. Sin probar: cambio de skin a mitad de partida.
- **Asteroids** — `classic` (default), `neon`, `retro` implementadas (2026-11-15). Verificadas visualmente con Playwright en modo oscuro (las 3 skins se ven bien, el selector persiste en `localStorage` tras recargar). Sin probar: cambio de skin a mitad de partida.
- **Arkanoid** — `classic` (conserva sprites de `/spritesheet-breakout.png`), `neon` y `retro` (primitivas del canvas) implementadas (2026-11-15). Verificadas con Playwright en modo oscuro; persistencia OK. Sin probar: cambio de skin a mitad de partida. Contraste a vigilar: bloque `gray` y pala en `classic` (dependen del spritesheet) y relleno tenue de bloques en `neon`.
- **Snake** — `classic`, `neon` y `retro` implementadas (2026-11-15). Verificadas con Playwright en modo oscuro (en pausa); persistencia OK. Sin probar: cambio de skin con la partida en marcha. Limitación: con la partida terminada, cambiar de skin no repinta el canvas.
- **Frogger** — `classic` (default, reproduce los colores originales con texto `#e6e9ff`), `neon` (fondo casi negro, entidades con relleno tenue + contorno con glow) y `retro` (paleta plana, bloques con bisel de 2 px, ruedas/tortugas/rana cuadradas) implementadas (2026-11-15). Solo comprobado con `tsc` y `eslint`; sin verificación visual con Playwright ni prueba de cambio de skin a mitad de partida. `skinRef` evita reiniciar el loop.

## Convenciones

- Prop `skinKey?: string` + `SKINS: Record<string, Skin>` con fallback a `classic`.
- Persistencia en `localStorage` con clave `<game-id>-skin`.
- Patrón de referencia: `components/games/TetrisGame.tsx` y `app/games/tetris/play/page.tsx`.
- Agente responsable: `skin-designer` (`.claude/agents/skin-designer.md`).

## Orden propuesto

1. ~~Tetris~~ (hecho)
2. ~~Snake~~ (hecho)
3. ~~Asteroids~~ (hecho)
4. ~~Arkanoid~~ (hecho)
