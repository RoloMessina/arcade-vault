# Juegos con skins

Referencia del estado de skins por juego. Regla del proyecto: todo juego debe tener al menos 3 skins — `classic` (default), `neon` y `retro` — y las tres deben verse bien en modo oscuro.

Última auditoría: 2026-11-15 (lectura de código; Asteroids verificado visualmente con Playwright).

## Estado

| Juego     | classic (default) | neon | retro | Selector + localStorage         | Dark OK | Cumple |
| --------- | ----------------- | ---- | ----- | ------------------------------- | ------- | ------ |
| Tetris    | No                | Sí   | Sí    | Sí (`tetris-skin`)              | Parcial | No     |
| Asteroids | Sí                | Sí   | Sí    | Sí (`asteroids-skin`)           | Sí      | Sí     |
| Arkanoid  | No                | No   | No    | No                              | Parcial | No     |
| Snake     | No                | No   | No    | No                              | Parcial | No     |

Juegos con las 3 skins completas: **Asteroids**.

## Notas por juego

- **Tetris** — skins actuales: `retro` (default, incumple), `neon`, `pastel`, `pixel`. Falta `classic`. `pastel` usa fondo claro (rompe dark). Pendiente decidir qué hacer con `pastel` y `pixel`.
- **Asteroids** — `classic` (default), `neon`, `retro` implementadas (2026-11-15). Verificadas visualmente con Playwright en modo oscuro (las 3 skins se ven bien, el selector persiste en `localStorage` tras recargar). Sin probar: cambio de skin a mitad de partida.
- **Arkanoid** — sin skins; usa spritesheet `/spritesheet-breakout.png`. Propuesta: `classic` conserva sprites; `neon` y `retro` con primitivas del canvas.
- **Snake** — sin skins; colores centralizados en `draw()`. El más sencillo.

## Convenciones

- Prop `skinKey?: string` + `SKINS: Record<string, Skin>` con fallback a `classic`.
- Persistencia en `localStorage` con clave `<game-id>-skin`.
- Patrón de referencia: `components/games/TetrisGame.tsx` y `app/games/tetris/play/page.tsx`.
- Agente responsable: `skin-designer` (`.claude/agents/skin-designer.md`).

## Orden propuesto

1. Tetris (añadir `classic`, cambiar default)
2. Snake
3. ~~Asteroids~~ (hecho)
4. Arkanoid
