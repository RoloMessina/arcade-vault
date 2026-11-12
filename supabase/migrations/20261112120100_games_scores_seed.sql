-- SPEC 06 — Semillas: los 8 juegos de GAMES y las 10 puntuaciones por juego de seedScores().

insert into public.games (id, titulo, categoria, archivo, vidas, record_base, score_max) values
  ('bloque-buster', 'Bloque Buster', 'Arcade',  'demo.html',      3,  28450,  284500),
  ('caida',         'Caída',         'Puzzle',  'demo.html',      1, 184220, 1842200),
  ('serpentina',    'Serpentina',    'Arcade',  'snake.html',     3,   7820,   78200),
  ('gloton',        'Glotón',        'Arcade',  'demo.html',      3,  96400,  964000),
  ('invasores',     'Invasores',     'Shooter', 'demo.html',      3,  54190,  541900),
  ('rocas',         'Rocas',         'Shooter', 'asteroids.html', 3,  41200,  412000),
  ('ranaria',       'Ranaria',       'Arcade',  'demo.html',      3,  18900,  189000),
  ('duelo-pixel',   'Duelo Pixel',   'Versus',  'demo.html',      1,     24,     240);

-- Misma fórmula que seedScores() en lib/games.ts:
--   paso = record_base < 100 ? 1 : 10
--   score = Math.round(record_base * (1 - i*0.085 - ((i*7 + length(id)) % 5)*0.012) / paso) * paso
--   fecha = 2026-10-(28 - 2i)
-- floor(x + 0.5) imita Math.round (round() de float8 en Postgres redondea al par).
insert into public.scores (game_id, user_id, nombre, score, es_semilla, created_at)
select
  g.id,
  null,
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
cross join generate_series(0, 9) as i;
