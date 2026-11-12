-- SPEC 06 — Tablas games y scores, vista leaderboard y RLS (sin semillas).

create table public.games (
  id text primary key,
  titulo text not null,
  categoria text not null,
  archivo text not null,
  vidas int not null check (vidas > 0),
  record_base int not null check (record_base > 0),
  score_max int not null check (score_max >= record_base)
);

alter table public.games enable row level security;

-- Lectura pública; sin políticas de escritura.
create policy "games_select_all"
  on public.games
  for select
  to anon, authenticated
  using (true);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  nombre text not null,
  score int not null check (score >= 0),
  es_semilla boolean not null default false,
  created_at timestamptz not null default now(),
  check ((es_semilla and user_id is null) or (not es_semilla and user_id is not null))
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_id_idx on public.scores (user_id);

alter table public.scores enable row level security;

create policy "scores_select_all"
  on public.scores
  for select
  to anon, authenticated
  using (true);

-- Solo el propio usuario inserta, y nunca como semilla. Sin update ni delete.
create policy "scores_insert_own"
  on public.scores
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and es_semilla = false);

-- El nombre de una fila real sale siempre de profiles.username.
create function public.scores_set_nombre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    select username into new.nombre from public.profiles where id = new.user_id;
    if new.nombre is null then
      raise exception 'perfil no encontrado para %', new.user_id;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.scores_set_nombre() from public, anon, authenticated;

create trigger scores_set_nombre
  before insert on public.scores
  for each row execute function public.scores_set_nombre();

-- Mejor puntuación por jugador y juego. Hereda la RLS de scores.
create view public.leaderboard
with (security_invoker = true)
as
select distinct on (game_id, coalesce(user_id::text, nombre))
  game_id,
  nombre,
  score,
  created_at::date as fecha,
  es_semilla
from public.scores
order by game_id, coalesce(user_id::text, nombre), score desc, created_at asc;

grant select on public.leaderboard to anon, authenticated;
