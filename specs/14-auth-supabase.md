# SPEC — Autenticación: registro, login y sesión con Supabase Auth

> **Estado:** Implementado (4 criterios sin cerrar: 2 de BD sin verificar por SQL, lint global por errores previos y guardado en la página genérica)
> **Depende de:** 04-supabase-integration, 06-games-table-leaderboard-supabase
> **Fecha:** 2026-11-16
> **Objetivo:** Sustituir el login simulado de `/auth` por autenticación real con Supabase Auth (email + contraseña, Google y GitHub), con perfil de jugador (`username` único) y scores asociados al usuario autenticado.

---

## Scope

**In:**

- **Supabase Auth** como único sistema de identidad, con tres métodos: email + contraseña, Google OAuth y GitHub OAuth. Sin confirmación de email: el usuario entra inmediatamente tras registrarse.
- **Configuración manual previa** (fuera del código): crear la OAuth App en Google Cloud y en GitHub, activar ambos proveedores en el panel de Supabase con su Client ID/Secret, desactivar "Confirm email" y añadir las Redirect URLs (`http://localhost:3000/auth/callback` y la de producción).
- **Migración SQL** en `supabase/migrations/`:
  - Tabla `profiles` (`id` → `auth.users`, `username` único) con RLS: lectura pública, update solo del propio perfil.
  - Trigger `on auth.users insert` que crea el perfil automáticamente.
  - Política de INSERT de `scores` endurecida: `user_id` solo puede ser `null` o `auth.uid()`.
- **Pantalla `/auth`** (se mantiene la ruta y el estilo visual actual) con las pestañas Iniciar sesión / Crear cuenta:
  - Registro: usuario, email, contraseña.
  - Login: email + contraseña.
  - Botones Google y GitHub operativos.
  - Botón "Jugar como invitado" (cierra sesión si la hubiera y vuelve a `/`).
  - Estados de carga y mensajes de error (credenciales inválidas, email ya registrado, username en uso, contraseña débil).
- **Ruta `/auth/callback`** (`route.ts`) que intercambia el `code` de OAuth por la sesión y redirige a `/`.
- **Username automático en OAuth:** derivado del perfil del proveedor (nombre de GitHub, o parte local del email en Google), normalizado a mayúsculas, máx. 10 caracteres, con sufijo numérico si ya existe.
- **`UserContext`** pasa a leer la sesión de Supabase (`getSession` + `onAuthStateChange`), exponiendo `user`, `userId`, `loading` y `signOut` (se elimina `login`).
- **Cierre de sesión** desde el menú de usuario del `Nav` (`supabase.auth.signOut()`).
- **Guardado de scores con sesión:** las play-pages insertan `user_id` y usan el `username` del perfil (campo de nombre bloqueado). Sin sesión se mantiene el modo invitado: nombre libre y `user_id = null`.
- **Validaciones:** contraseña con el mínimo de Supabase (6 caracteres); username de 3–10 caracteres con solo letras, números y guion bajo.

**Fuera de alcance:**

- "Olvidé mi contraseña" y cambio de contraseña.
- Página de perfil/cuenta y edición del username.
- Confirmación de email y configuración de SMTP propio.
- Protección de rutas (`proxy.ts`): ninguna ruta exige sesión.
- Otros proveedores OAuth, magic link o 2FA.
- Validación de scores en servidor y medidas antitrampas más allá de la política de INSERT.
- Migración de los scores históricos de invitados a una cuenta.
- Roles, administración y baja de cuenta.
- Tests automatizados (no hay test runner configurado).

---

## Data model

### Migración SQL — `supabase/migrations/<timestamp>_auth_profiles.sql`

**Tabla `profiles`** (un perfil por usuario de `auth.users`):

```sql
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
```

No hay política de INSERT: los perfiles los crea solo el trigger. No hay política de DELETE: se borran en cascada con el usuario.

**Trigger de alta de perfil:**

```sql
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
```

**Política de INSERT de `scores`** (sustituye a `scores_insert_public`; segunda migración, paso 8):

```sql
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_guest_or_own" on public.scores
  for insert to anon, authenticated
  with check (score >= 0 and (user_id is null or user_id = auth.uid()));

alter table public.scores
  add constraint scores_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
```

### Tipos TypeScript — `lib/supabase/types.ts`

```ts
export interface ProfileRow {
  id: string;
  username: string;
  created_at: string;
}
```

`ScoreRow` no cambia (`user_id: string | null` ya existe).

### Contrato de `UserContext`

| Campo     | Antes                     | Después                                                                   |
| --------- | ------------------------- | ------------------------------------------------------------------------- |
| `user`    | `string \| null` (nombre) | `string \| null` = `profiles.username` de la sesión                       |
| `userId`  | no existía                | `string \| null` = `auth.uid()`; las play-pages lo guardan como `user_id` |
| `loading` | no existía                | `boolean`: `true` hasta resolver la sesión inicial                        |
| `login`   | `(name) => void`          | se elimina: el login lo hacen las acciones de Supabase en `/auth`         |
| `signOut` | borra `localStorage`      | `supabase.auth.signOut()`                                                 |

### Estado persistente

- Sesión: la gestiona `@supabase/ssr` (cookies). La key `av_user` de `localStorage` se deja de usar y se elimina al cargar.
- `av_player_name` se mantiene solo para invitados.

### Reglas del username

- Formato `^[A-Z0-9_]{3,10}$`, siempre en mayúsculas, único. Cabe en `scores.player_name` (máx. 20).
- Registro por email: la UI comprueba la disponibilidad con un `select` a `profiles` antes de llamar a `signUp` y muestra "usuario en uso". El sufijo numérico del trigger es solo la red de seguridad para OAuth y carreras.

---

## Implementation plan

0. **Configuración manual en Supabase y proveedores** (sin código; el usuario lo hace y confirma):
   - Panel Supabase → Authentication: desactivar "Confirm email".
   - Crear OAuth App en Google Cloud y en GitHub; activar ambos proveedores con Client ID/Secret.
   - Añadir Redirect URLs: `http://localhost:3000/auth/callback` y la de producción.
   - Consulta previa: `select count(*) from scores where user_id is not null` (debe ser 0 para la FK del paso 8).
   - Releer `node_modules/next/dist/docs/` (route handlers y cookies) antes de escribir código Next.js.

1. **Migración SQL** `supabase/migrations/<timestamp>_auth_profiles.sql`: `profiles`, RLS, trigger `handle_new_user`. Aplicar con el MCP de Supabase.
   _Estado: la app sigue igual; los perfiles solo se crean para usuarios nuevos._

2. **Tipos** en `lib/supabase/types.ts`: añadir `ProfileRow`.

3. **`UserContext`** (`app/context/UserContext.tsx`): leer la sesión con `getSession` + `onAuthStateChange`, cargar `username` desde `profiles`, exponer `{ user, userId, loading, signOut }`. Eliminar `login` y la key `av_user` (limpiarla de `localStorage` al montar).
   _Estado: sin sesión todo se comporta como invitado. `/auth` y las play-pages dejan de compilar si usan `login`; se arregla en el paso 4._

4. **Pantalla `/auth`** (`app/auth/page.tsx`), manteniendo el estilo actual:
   - Registro: validar username (`^[A-Z0-9_]{3,10}$`), comprobar disponibilidad en `profiles`, `signUp({ email, password, options: { data: { username } } })`.
   - Login: `signInWithPassword`.
   - Botones Google/GitHub: `signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })`.
   - "Jugar como invitado": `signOut` y `router.push('/')`.
   - Estados de carga y errores traducidos: credenciales inválidas, email ya registrado, usuario en uso, contraseña débil.
   - Si ya hay sesión, redirigir a `/`.
     _Estado: registro y login por email operativos._

5. **Ruta `/auth/callback`** (`app/auth/callback/route.ts`): `exchangeCodeForSession(code)` con el cliente de servidor y redirect a `/` (o a `/auth?error=...` si falla).
   _Estado: OAuth operativo._

6. **`Nav`** (`components/Nav.tsx`): mostrar `user` del contexto, "Cuenta" → cerrar sesión con `signOut` y estado `loading` sin parpadeo de "Iniciar Sesión".

7. **Play-pages** (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger` y `[id]/play`): con sesión, nombre = `user`, campo bloqueado e insert con `user_id: userId`; sin sesión, comportamiento actual (nombre libre desde `av_player_name`, `user_id: null`). Esperar a `loading = false` antes de abrir el modal de guardado.

8. **Endurecer RLS de `scores`** con una segunda migración: sustituir `scores_insert_public` por `scores_insert_guest_or_own` y añadir la FK `scores_user_id_fkey`. Aplicar solo cuando el paso 7 esté desplegado.
   _Estado: invitados y usuarios siguen guardando; un `user_id` ajeno se rechaza._

9. **Verificación manual** de los criterios de aceptación y actualización de `CLAUDE.md` (rutas, `UserContext`, tabla `profiles`, estado del spec).

---

## Acceptance criteria

**Base de datos**

- [x] 🔧 Existe la tabla `profiles` con RLS activada; `select` público y `update` solo del propio perfil.
- [x] 🔧 Al crear un usuario en `auth.users` se crea su fila en `profiles` con username válido (`^[A-Z0-9_]{3,10}$`).
- [ ] 🔧 Dos registros con el mismo nombre base (p. ej. dos emails `kai@…`) producen usernames distintos (`KAI` y `KAI1`). _(sin verificar: no se probó con dos cuentas de igual base)_
- [ ] 🔧 Insertar en `scores` con `user_id` de otro usuario es rechazado; con `user_id = null` o el propio, aceptado. _(sin verificar por SQL; la política existe en `pg_policies`)_
- [x] 🔧 Existe la FK `scores.user_id → auth.users` y no se perdió ninguna fila previa de `scores`.

**Registro y login con email**

- [x] Crear cuenta con usuario, email y contraseña válidos entra de inmediato (sin confirmar correo) y redirige a `/`.
- [x] El `Nav` muestra el username en mayúsculas tras registrarse.
- [x] Registrar un username ya existente muestra "usuario en uso" y no crea cuenta.
- [x] Registrar un email ya existente muestra un error legible.
- [x] Un username con menos de 3 o más de 10 caracteres, o con caracteres no permitidos, se rechaza antes de llamar a Supabase.
- [x] Contraseña de menos de 6 caracteres muestra "contraseña débil".
- [x] Login con credenciales correctas entra y redirige a `/`; con credenciales incorrectas muestra "credenciales inválidas" sin revelar si el email existe.
- [x] Durante el envío el botón queda deshabilitado con indicador de carga (sin doble envío).

**OAuth**

- [x] "Google" y "GitHub" redirigen al proveedor y, tras autorizar, vuelven a `/` con sesión iniciada.
- [x] Un usuario nuevo por OAuth recibe un username automático válido y único.
- [x] Un usuario OAuth que vuelve a entrar conserva el mismo perfil (no se duplica).
- [x] Si el usuario cancela en el proveedor o falla el callback, `/auth` muestra un error y no queda sesión.

**Sesión**

- [x] Recargar la página mantiene la sesión.
- [x] El `Nav` no muestra "Iniciar Sesión" un instante antes de resolver la sesión (usa `loading`).
- [x] "Cerrar sesión" en el `Nav` elimina la sesión y el `Nav` vuelve a "Iniciar Sesión".
- [x] Con sesión, `/auth` redirige a `/`.
- [x] "Jugar como invitado" cierra cualquier sesión activa y lleva a `/`.
- [x] La key `av_user` ya no existe en `localStorage` tras cargar la app.

**Scores**

- [ ] Con sesión, al terminar una partida en cada play-page (asteroids, tetris, arkanoid, snake, frogger y genérica) el nombre aparece bloqueado con el username y el score se guarda con `user_id`. _(verificado con sesión; la página genérica `/games/[id]/play` es una maqueta sin guardado en Supabase, solo aplica el nombre bloqueado)_
- [x] Sin sesión, el nombre es editable, se recuerda en `av_player_name` y el score se guarda con `user_id = null`.
- [x] El score guardado aparece en `/hall-of-fame` con el username.

**Calidad**

- [ ] `npm run lint` y `npx tsc --noEmit` sin errores. _(`tsc` y `build` limpios; `lint` mantiene 30 errores previos a esta spec, 6 `set-state-in-effect` en las play-pages)_
- [x] `/auth` sin scroll horizontal en 390×844 y 360×740, con áreas táctiles ≥ 44 px.
- [x] No quedan referencias a `login(` de `UserContext` ni a `av_user` en el código.
- [x] `CLAUDE.md` actualizado con el nuevo flujo de auth.

---

## Decisions

### Tomadas

| Decisión                                                                                              | Justificación                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth** como único sistema de identidad.                                                    | Ya se usa Supabase para datos (spec 04); evita un segundo proveedor y las cookies las gestiona `@supabase/ssr`, ya instalado.                                  |
| **Email + contraseña, Google y GitHub** en este mismo spec.                                           | Los botones sociales ya están en la maqueta de `/auth`. Se implementan al final del plan para que el email funcione antes.                                     |
| **Sin confirmación de email** (A).                                                                    | Entrada inmediata y sin depender de SMTP; el límite del SMTP por defecto de Supabase es muy bajo. Se puede activar más adelante sin cambiar el modelo de datos. |
| **Tabla `profiles` con `username` único**, creada por trigger.                                        | El ranking necesita nombres únicos y consultables; guardarlo solo en `user_metadata` no permite unicidad ni lecturas públicas. El trigger evita que el cliente cree perfiles arbitrarios. |
| **Username en mayúsculas, 3–10 caracteres, `[A-Z0-9_]`.**                                             | Coincide con la maqueta (`toUpperCase().slice(0, 10)`) y cabe en `scores.player_name` (máx. 20).                                                               |
| **Username automático con sufijo numérico en OAuth** (y como red de seguridad en el registro por email). | El usuario OAuth no elige nombre; pedirlo después añade una pantalla y un estado intermedio que no se justifica ahora.                                        |
| **Comprobar disponibilidad del username en la UI antes de `signUp`.**                                 | Un fallo en el trigger devuelve "Database error saving new user", un error ilegible.                                                                           |
| **`UserContext` conserva `user` y `signOut`, añade `userId` y `loading`, y elimina `login`.**         | Mantiene compatible a `Nav` y las play-pages; `login(name)` no tiene sentido con autenticación real. `loading` evita el parpadeo de "Iniciar Sesión".          |
| **Se mantiene la ruta `/auth`** con las pestañas actuales.                                            | `Nav` y la maqueta ya apuntan ahí; rutas separadas no aportan nada.                                                                                            |
| **Modo invitado se conserva** (nombre libre, `user_id = null`).                                       | Jugar sin cuenta sigue siendo parte del producto; por eso no hay protección de rutas ni `proxy.ts`.                                                            |
| **RLS de `scores` en una migración posterior** (paso 8).                                              | Endurecer antes de que las play-pages envíen `user_id` rompería el guardado de scores en producción.                                                           |
| **Política de INSERT: `user_id` nulo o igual a `auth.uid()`.**                                        | Evita suplantar a otro usuario con el mínimo cambio. Validar el score en servidor queda fuera.                                                                 |
| **FK `scores.user_id → auth.users` con `on delete set null`.**                                        | Conserva el ranking si se elimina una cuenta.                                                                                                                  |
| **Error de login genérico; error de registro específico.**                                            | Evita la enumeración de cuentas en el login; en el registro la UX necesita saber qué falló.                                                                    |

### Descartadas

| Alternativa                                                | Por qué no                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Confirmación de email obligatoria (B).                     | Añade pantalla de "revisa tu correo", ruta de confirmación y SMTP propio; se deja para un spec posterior.          |
| Magic link / otros proveedores OAuth / 2FA.                | Fuera de lo pedido; cada uno añade configuración y casos de error.                                                 |
| Pedir el username en un paso posterior al OAuth.           | Estado intermedio de "sesión sin perfil completo" que habría que proteger en toda la app.                          |
| Guardar el username solo en `user_metadata`.               | No permite unicidad ni consulta pública desde el ranking.                                                          |
| Rutas separadas `/login` y `/register`.                    | Duplica páginas y obliga a cambiar `Nav` y enlaces.                                                                |
| Proteger rutas con `proxy.ts`.                             | Ninguna ruta exige sesión; se añadirá cuando exista una página privada (perfil/cuenta).                            |
| Partir en dos specs (email vs. OAuth).                     | El OAuth reutiliza `profiles`, `UserContext` y callback; separarlo duplicaría la migración y las pruebas.          |
| Mantener `av_user` en `localStorage` como caché.           | Dos fuentes de verdad para la identidad; la sesión de Supabase es la única.                                        |

---

## Risks

| Riesgo                                                                                                                 | Impacto                                                                                | Mitigación                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configuración OAuth incorrecta** (Redirect URL que no coincide, secretos mal copiados, app de Google en modo "Testing"). | Google/GitHub fallan con `redirect_uri_mismatch` o el login queda limitado a usuarios de prueba. | El paso 0 es manual y se confirma antes de escribir código. Probar OAuth en `localhost` y en producción por separado.                                                      |
| **El trigger `handle_new_user` falla** (colisión por carrera, username inválido).                                      | `signUp` devuelve "Database error saving new user" y no se crea la cuenta.             | Bucle de sufijo numérico con username saneado y fallback `JUGADOR`. Verificar con los criterios de BD antes de tocar la UI.                                                |
| **Carrera en el registro:** dos personas eligen el mismo username entre la comprobación de la UI y el `signUp`.        | El segundo usuario recibe un username con sufijo en vez del elegido.                   | Aceptado: el username es único siempre; el caso es raro y no bloquea. La UI muestra el username final tras entrar.                                                         |
| **Endurecer el RLS de `scores` antes de desplegar las play-pages.**                                                    | Los scores dejan de guardarse en producción.                                           | Migración separada (paso 8), aplicada solo cuando el paso 7 esté desplegado.                                                                                               |
| **FK `scores.user_id` falla** si ya hay filas con `user_id` no nulo.                                                   | La migración del paso 8 se aborta.                                                     | Consulta de comprobación en el paso 0; si hay filas, limpiarlas o añadir la FK como `not valid`.                                                                           |
| **Sesión no sincronizada entre cliente y servidor.**                                                                   | La UI muestra un estado y el servidor otro.                                            | Usar `@supabase/ssr` en ambos lados, que guarda la sesión en cookies. Verificar el uso de `cookies()` en Next 16 en `node_modules/next/dist/docs/` antes de escribir el callback. |
| **Sesión que se resuelve tarde** (`getSession` asíncrono).                                                             | Parpadeo de "Iniciar Sesión" y play-pages que guardan como invitado una partida de un usuario con sesión. | `loading` en `UserContext`; las play-pages esperan a `loading = false` antes de abrir el modal de guardado.                                                                |
| **Sesión sin perfil** (el perfil aún no existe al cargar).                                                             | `user` sería `null` pese a haber sesión.                                               | El trigger corre en la misma transacción del alta, así que el perfil existe cuando hay sesión. Si faltara, `UserContext` trata la sesión sin perfil como invitado.          |
| **Scores falsificables:** cualquiera puede insertar el score que quiera.                                               | El ranking no es de fiar.                                                              | Fuera de alcance; esta política solo impide suplantar a otro usuario. Validar en servidor queda para otro spec.                                                            |
| **Cambio de interfaz de `UserContext`.**                                                                               | Ramas de código que aún usen `login` dejan de compilar.                                | `tsc` y la búsqueda de `login(` / `av_user` son criterios de aceptación.                                                                                                   |
| **Enumeración de cuentas en el registro** ("email ya registrado").                                                     | Permite comprobar si un email tiene cuenta.                                            | Aceptado por UX (ver Decisiones); se puede cambiar más adelante.                                                                                                           |
