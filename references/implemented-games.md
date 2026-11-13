# Juegos implementados

Fuente: tabla `games` de Supabase (consultada el 2026-11-13). Total: **8 juegos**.

| #   | ID              | Título        | Categoría | Archivo         | Vidas | Récord base | Score máx. |
| --- | --------------- | ------------- | --------- | --------------- | ----- | ----------- | ---------- |
| 1   | `serpentina`    | Serpentina    | Arcade    | `snake.html`    | 3     | 7.820       | 78.200     |
| 2   | `gloton`        | Glotón        | Arcade    | `demo.html`     | 3     | 96.400      | 964.000    |
| 3   | `invasores`     | Invasores     | Shooter   | `demo.html`     | 3     | 54.190      | 541.900    |
| 4   | `rocas`         | Rocas         | Shooter   | `asteroids.html`| 3     | 41.200      | 412.000    |
| 5   | `ranaria`       | Ranaria       | Arcade    | `demo.html`     | 3     | 18.900      | 189.000    |
| 6   | `duelo-pixel`   | Duelo Pixel   | Versus    | `demo.html`     | 1     | 24          | 240        |
| 7   | `caida`         | Caída         | Puzzle    | `tetris.html`   | 1     | 184.220     | 1.842.200  |
| 8   | `bloque-buster` | Bloque Buster | Arcade    | `arkanoid.html` | 3     | 28.450      | 284.500    |

## Por categoría

- **Arcade:** Serpentina, Glotón, Ranaria, Bloque Buster
- **Shooter:** Invasores, Rocas
- **Puzzle:** Caída
- **Versus:** Duelo Pixel

## Notas

- Los juegos con componente React propio en `components/games/` son: Serpentina (`SnakeGame`), Rocas (`AsteroidsGame`), Caída (`TetrisGame`) y Bloque Buster (`ArkanoidGame`).
- Glotón, Invasores, Ranaria y Duelo Pixel apuntan a `demo.html`, es decir, aún usan el reproductor demo genérico.
- Las columnas reales de la tabla (`titulo`, `categoria`, `archivo`, `vidas`, `record_base`, `score_max`) difieren de la interfaz `GameRow` de `lib/supabase/types.ts` (`title`, `cat`, `cover`, `color`...).
