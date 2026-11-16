-- Spec 15: cierra los avisos del linter de Supabase sobre funciones SECURITY DEFINER
-- ejecutables por anon / authenticated vía /rest/v1/rpc/. No se borran las funciones.
-- service_role y el propietario conservan el acceso; el event trigger ensure_rls
-- sigue funcionando (el permiso EXECUTE de una función de trigger se comprueba al crearlo).

revoke execute on function public.username_disponible(text)
  from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
