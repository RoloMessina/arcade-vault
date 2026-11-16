-- Auditoría db #4 y #5: defensa en profundidad además de RLS.

-- #4: los clientes no necesitan UPDATE/DELETE/TRUNCATE en scores y games,
-- ni INSERT/DELETE/TRUNCATE en profiles (el INSERT lo hace el trigger handle_new_user).
revoke update, delete, truncate on public.scores, public.games from anon, authenticated;
revoke insert, delete, truncate on public.profiles from anon, authenticated;

-- #5: handle_new_user es SECURITY DEFINER y solo la invoca el trigger de auth.users.
-- PostgreSQL comprueba EXECUTE al crear el trigger, no al dispararlo, así que sigue funcionando.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
