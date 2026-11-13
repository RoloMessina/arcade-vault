-- Migra games/scores al esquema del spec 06 (title/cat/cover/color, player_name).
-- No destructivo: las tablas anteriores se conservan como games_old / scores_old.

alter table public.scores rename to scores_old;
alter table public.games rename to games_old;

create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  "long" text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 20),
  score int not null check (score >= 0),
  user_id uuid,
  created_at timestamptz not null default now()
);

create index scores_new_game_score_idx on public.scores (game_id, score desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_all" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_all" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated with check (score >= 0);

insert into public.games (id, title, short, "long", cat, cover, color) values
('asteroids', 'ASTEROIDS', 'Pulveriza rocas en gravedad cero.',
 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Supera niveles y acumula puntos antes de que los asteroides te alcancen.',
 'SHOOTER', 'cover-rocas', 'yellow'),
('tetris', 'TETRIS', 'Apila tetrominos antes de que el techo te aplaste.',
 'Siete piezas, diez columnas, una sola regla: no dejes que el tablero llegue arriba. Gira y encaja tetrominos para completar líneas y ganar puntos; cada nivel te las acelera un poco más.',
 'PUZZLE', 'cover-tetro', 'cyan'),
('arkanoid', 'ARKANOID', 'Rompe todos los bloques antes de perder tus 3 vidas.',
 'Controla la paleta y rebota la pelota para destruir todos los bloques. Cinco niveles con patrones distintos y velocidad creciente ponen a prueba tus reflejos. Completa el nivel 5 sin agotar tus vidas para ganar.',
 'ARCADE', 'cover-bricks', 'cyan'),
('snake', 'SNAKE', 'Come frutas, crece y no te muerdas la cola.',
 'Guía a la serpiente por el tablero comiendo frutas que aparecen aleatoriamente. Cada fruta que comes hace crecer tu cuerpo y sube tu puntuación. La partida termina si chocas contra una pared o contra ti mismo.',
 'ARCADE', 'cover-snake', 'green');
