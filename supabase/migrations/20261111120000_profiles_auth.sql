-- SPEC 04 — Perfiles de jugador ligados a Supabase Auth.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Lectura pública del username (lo usarán los rankings).
-- Sin políticas de insert/update/delete: el perfil lo crea solo el trigger.
create policy "profiles_select_all"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Crea el perfil al registrarse un usuario (correo u OAuth).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fuente text;
  base text;
  candidato text;
  sufijo int := 0;
begin
  fuente := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  base := left(upper(regexp_replace(fuente, '[^A-Za-z0-9_]', '', 'g')), 20);
  if length(base) < 3 then
    base := 'JUGADOR';
  end if;

  candidato := base;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, candidato);
      return new;
    exception when unique_violation then
      -- Si el choque es por el id, no hay nada que hacer.
      if exists (select 1 from public.profiles where id = new.id) then
        return new;
      end if;
      sufijo := sufijo + 1;
      candidato := left(base, 20 - length(sufijo::text)) || sufijo::text;
    end;
  end loop;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprobación previa al registro con correo.
create function public.username_disponible(nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select upper(nombre) ~ '^[A-Z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where username = upper(nombre));
$$;

revoke execute on function public.username_disponible(text) from public;
grant execute on function public.username_disponible(text) to anon, authenticated;
