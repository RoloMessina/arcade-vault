-- Spec 14: perfiles de jugador (username único) ligados a auth.users.
-- Los perfiles los crea solo el trigger handle_new_user; no hay política de INSERT.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select to anon, authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := upper(regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'username',   -- registro por email
      new.raw_user_meta_data ->> 'user_name',  -- GitHub
      split_part(new.email, '@', 1),           -- Google / fallback
      'JUGADOR'
    ), '[^A-Za-z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'JUGADOR'; end if;
  base := left(base, 10);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 10 - char_length(n::text)) || n::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
