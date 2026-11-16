-- Spec 14, paso 8: endurece el INSERT de scores.
-- user_id solo puede ser null (invitado) o el uid de la sesión; no se puede suplantar a otro usuario.

drop policy if exists "scores_insert_public" on public.scores;

create policy "scores_insert_guest_or_own" on public.scores
  for insert to anon, authenticated
  with check (score >= 0 and (user_id is null or user_id = auth.uid()));

alter table public.scores
  add constraint scores_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
