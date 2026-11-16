-- Auditoría db #1: evita suplantar el nombre de otro jugador en el Hall of Fame.
-- Si el score trae user_id, player_name se fuerza al username del perfil.
-- Los invitados (user_id nulo) siguen con nombre libre.
-- SECURITY INVOKER: profiles tiene SELECT público, no hace falta privilegio extra.

create function public.scores_force_player_name() returns trigger
language plpgsql set search_path = public as $$
declare
  uname text;
begin
  if new.user_id is not null then
    select username into uname from public.profiles where id = new.user_id;
    if uname is null then
      raise exception 'user_id sin perfil: no se puede guardar el score';
    end if;
    new.player_name := uname;
  end if;
  return new;
end $$;

create trigger scores_force_player_name
  before insert on public.scores
  for each row execute function public.scores_force_player_name();

revoke execute on function public.scores_force_player_name() from public, anon, authenticated;
