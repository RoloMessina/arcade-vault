# SPEC 04 — Autenticación real con Supabase (sesión, perfiles y `/acceso`)

> **Estado:** Implementado
> **Depende de:** SPEC 01 (`/acceso`, `lib/store.ts`, navbar con sesión), SPEC 03 (patrón de `.env.example` y variables de entorno)
> **Fecha:** 2026-11-11
> **Objetivo:** Sustituir la sesión simulada de `localStorage` por Supabase Auth (correo + contraseña, Google y GitHub) con un `username` único por jugador en `public.profiles`, manteniendo el modo invitado local y las puntuaciones en `localStorage`.

---

## Por qué existe esta spec

"Implementar Supabase" abarca auth, base de datos de puntuaciones y RLS. Son varios dominios, así que se divide: esta spec cubre **solo la identidad** (cliente Supabase, sesión, perfiles y `/acceso`); la migración de puntuaciones y rankings va en una spec posterior. Así cada entrega queda funcional: la app sigue mostrando los mismos rankings, pero el login ya es real y deja lista la base (`profiles`, cookies de sesión, clientes de servidor) para guardar puntuaciones por usuario con RLS.

`lib/store.ts` ya marca los puntos de integración con comentarios `BACKEND`; `/acceso` ya tiene los campos y botones (correo/contraseña, Google, GitHub, invitado). El proyecto Supabase (`agusozjzzodhxgqnkuhd`) está vacío: no tiene tablas.

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`; clientes de navegador y de servidor en `lib/supabase/`.
- `proxy.ts` en la raíz (Next 16, sustituto de `middleware`) que refresca la sesión en cookies.
- Ruta `app/auth/callback/route.ts` que intercambia el `code` (confirmación de correo y OAuth) por sesión.
- Migración SQL versionada en `supabase/migrations/` y aplicada por MCP: tabla `public.profiles`, trigger al crear usuario, función `username_disponible` y RLS.
- `/acceso` conectado: registro con confirmación de correo, inicio de sesión con correo/contraseña, Google y GitHub, y errores traducidos al español.
- `username` único: lo elige el usuario al registrarse con correo; con Google/GitHub se genera automáticamente.
- `useUser()` devuelve el `username` del perfil para cuentas reales y el usuario invitado local para invitados; `logout()` cierra ambas sesiones.
- Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` documentadas en `.env.example`.
- Actualizar `CLAUDE.md` (arquitectura de estado y variables de entorno).

**Fuera de alcance (para otras specs):**

- Tabla `scores`, guardado y lectura de puntuaciones en Supabase, y cambios en `buildBoard`, `Leaderboard`, `Podium`, `HallOfFame`, `GameLibrary`, `GameStats` (siguen leyendo `localStorage`).
- Invitado como sesión anónima de Supabase: el invitado sigue siendo local, sin cuenta.
- Pantalla para elegir o editar el `username` después del registro.
- Recuperar contraseña, cambiar correo o contraseña, borrar cuenta.
- Magic link, otros proveedores OAuth, MFA.
- Rutas protegidas: ninguna página exige sesión; `proxy.ts` solo refresca cookies.
- SMTP propio (se usa el integrado de Supabase) y plantillas de correo personalizadas.
- Migrar sesiones simuladas existentes: las entradas `av:user` con `guest: false` se descartan.
- Pruebas automatizadas (el repo no tiene configuradas).
- Cambios en `lib/games.ts`, `public/games/`, `Player.tsx` (salvo que el cambio en `useUser` lo exija) y en el contacto con Resend.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_profiles_auth.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;
-- Lectura pública del username (lo usarán los rankings). Sin políticas de insert/update/delete:
-- el perfil lo crea solo el trigger.
create policy "profiles_select_all" on public.profiles for select using (true);
```

- **Trigger** `on_auth_user_created` (`after insert on auth.users`, función `security definer` con `set search_path = ''`): inserta el perfil. El `username` sale de `raw_user_meta_data->>'username'` (registro con correo, ya validado); si falta (OAuth), se deriva de `full_name`, `user_name` o de la parte local del correo, se normaliza (mayúsculas, solo `A-Z0-9_`, 3–20 caracteres, relleno `JUGADOR` si queda corto) y, si choca, se añade un sufijo numérico hasta ser único.
- **RPC** `public.username_disponible(nombre text) returns boolean` (`security definer`, `grant execute` a `anon` y `authenticated`): permite comprobar la disponibilidad antes de llamar a `signUp`. El trigger sigue garantizando la unicidad si hay una carrera.

Contratos en el cliente (sin cambios para los consumidores actuales):

```ts
// lib/store.ts
export type User = { name: string; guest: boolean };
// cuenta real → { name: profiles.username, guest: false }
// invitado    → { name: "INVITADO", guest: true }   (localStorage "av:user")
```

Reglas de `/acceso`:

| Campo                     | Regla                                                      |
| ------------------------- | ---------------------------------------------------------- |
| `usuario` (solo registro) | `trim()`, se pasa a mayúsculas, `/^[A-Z0-9_]{3,20}$/`      |
| `correo`                  | formato `/^\S+@\S+\.\S+$/`                                 |
| `clave`                   | mínimo 6 caracteres (mínimo de Supabase; hoy la UI pide 4) |

Variables de entorno (las dos son públicas por diseño; la clave publicable no concede más permisos que RLS):

```
NEXT_PUBLIC_SUPABASE_URL=https://agusozjzzodhxgqnkuhd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de escribir código, leer en `node_modules/next/dist/docs/` la guía de `proxy` (`01-app/03-api-reference/03-file-conventions/proxy.md`) y la de Route Handlers, y la guía de Supabase para Next.js con `@supabase/ssr` (`search_docs` del MCP).

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Añadir las dos variables a `.env.example` y pedir al usuario que las copie a `.env.local` (valores obtenidos con `get_project_url` y `get_publishable_keys`). Prueba: `npm run build` pasa.
2. **Migración.** Crear `supabase/migrations/<timestamp>_profiles_auth.sql` con tabla, índice, RLS, trigger y RPC; aplicarla con `apply_migration` y ejecutar `get_advisors` (security). Prueba: `list_tables` muestra `profiles` con RLS activa y el asesor no reporta políticas faltantes ni funciones sin `search_path`.
3. **Clientes Supabase.** Crear `lib/supabase/client.ts` (`createBrowserClient`), `lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`, `await`) y `lib/supabase/proxy.ts` (`updateSession`). Prueba: importar cada uno sin errores de tipos.
4. **`proxy.ts`.** Crear `proxy.ts` en la raíz que llama a `updateSession`, con `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes, y `games/` (los HTML del iframe). Prueba: las rutas actuales siguen cargando y `/games/snake.html` no pasa por el proxy.
5. **Callback.** Crear `app/auth/callback/route.ts` (GET): intercambia `code` con `exchangeCodeForSession` y redirige a `/`; si falla, redirige a `/acceso?error=auth`. Prueba: abrir la ruta sin `code` redirige a `/acceso?error=auth`.
6. **Sesión en el store.** En `lib/store.ts`, `useUser()` combina el invitado local y la sesión de Supabase (`getSession` al montar + `onAuthStateChange`, consulta de `profiles.username`), con snapshot de servidor `null`. `login()` queda solo para invitado; `logout()` llama a `supabase.auth.signOut()` y borra `av:user`. Se descarta cualquier `av:user` con `guest: false`. Prueba: sin sesión, la navbar muestra "Entrar"; con invitado, muestra INVITADO como antes.
7. **`/acceso` real.** Reemplazar los `BACKEND` de `app/acceso/page.tsx`: registro (`username_disponible` → `signUp` con `options.data.username` y `emailRedirectTo` a `/auth/callback`), pantalla «REVISA TU CORREO» tras registrarse, `signInWithPassword`, `signInWithOAuth({ provider })` para Google y GitHub, y mapeo de errores de Supabase a mensajes en español genéricos (sin revelar si un correo existe). Mantener el estilo y el botón de invitado. Prueba: cada camino muestra su estado; un `username` tomado muestra «ESE USUARIO YA EXISTE».
8. **Navbar y cierre de sesión.** Ajustar `components/Navbar.tsx` si cambia la forma de llamar a `logout` (ahora asíncrona) y mostrar el `username` real. Prueba: iniciar y cerrar sesión actualiza navbar y drawer sin recargar.
9. **Configuración manual y documentación.** Documentar en `CLAUDE.md` la capa Supabase y las variables, y dejar una lista de pasos del panel de Supabase para el usuario: URL del sitio y redirecciones permitidas (`http://localhost:3000/**`), confirmación de correo activada, proveedores Google y GitHub con sus credenciales. Prueba: con esos pasos hechos, el flujo completo de la revisión final funciona.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript y `npm run lint` no reporta errores nuevos.
- [ ] `public.profiles` existe con RLS activada, la única política es lectura pública y `get_advisors` (security) no reporta problemas nuevos.
- [ ] Registrarse con correo, contraseña y usuario muestra la pantalla «REVISA TU CORREO» y no inicia sesión hasta confirmar.
- [ ] Tras abrir el enlace de confirmación, el usuario vuelve a la app con sesión iniciada y la navbar muestra su `username` en mayúsculas.
- [ ] Existe una fila en `profiles` por cada usuario de `auth.users` y su `username` cumple `^[A-Z0-9_]{3,20}$`.
- [ ] Registrarse con un `username` ya tomado (en cualquier combinación de mayúsculas) se rechaza con «ESE USUARIO YA EXISTE» sin crear usuario.
- [ ] Un `username` de menos de 3 o más de 20 caracteres, o con símbolos, se rechaza antes de llamar a Supabase.
- [ ] Iniciar sesión con correo y contraseña correctos entra; con contraseña errónea muestra un mensaje genérico en español.
- [ ] Google y GitHub inician sesión, crean el perfil con un `username` válido y único generado automáticamente, y vuelven a `/`.
- [ ] Dos cuentas OAuth cuyo nombre normalizado coincide reciben `usernames` distintos (el segundo con sufijo).
- [ ] "Jugar como invitado" sigue funcionando sin crear usuario en Supabase (`auth.users` no cambia) y su marca sigue guardándose en `localStorage`.
- [ ] Cerrar sesión (cuenta o invitado) vuelve al estado sin sesión; recargar la página no la restaura.
- [ ] Recargar la página con una cuenta iniciada mantiene la sesión (cookies) y `/games/*.html` no pasa por `proxy.ts`.
- [ ] Una entrada `av:user` antigua con `guest: false` ya no cuenta como sesión.
- [ ] Puntuaciones, rankings, Salón de la Fama y reproductor funcionan igual que antes (siguen en `localStorage`).
- [ ] Ninguna clave secreta (`service_role`, contraseñas de BD) aparece en el repo, `.env.example` ni `.next/static`.
- [ ] `.env.example` existe y está versionado; `.env.local` no.
- [ ] `/acceso` no tiene scroll horizontal a 375 px de ancho.

## Decisiones

- **Sí:** dividir en dos specs (auth ahora, puntuaciones después). Son dominios independientes y cada uno es revisable por separado.
- **Sí:** `@supabase/ssr` con cookies y `proxy.ts`. La sesión llega al servidor, lo que necesita la spec de puntuaciones (RLS por `auth.uid()` y Server Components).
- **No:** `supabase-js` solo en cliente con `localStorage`. Más simple, pero obligaría a rehacer la capa de sesión después.
- **Sí:** tabla `profiles` con `username` único. Da unicidad real y permite hacer `join` en rankings; `user_metadata` no lo permite.
- **Sí:** `username` en mayúsculas `[A-Z0-9_]{3,20}`. Coincide con cómo se muestran hoy los nombres (`toUpperCase()` en `/acceso`) y con la estética de los rankings.
- **Sí:** `username` automático con Google/GitHub, con sufijo numérico si choca. Evita una pantalla intermedia; editarlo queda para otra spec.
- **Sí:** login por correo (no por `username`). Supabase Auth se basa en correo; iniciar sesión por `username` exigiría otra RPC y expone si un usuario existe.
- **Sí:** confirmación de correo activada. Es lo seguro por defecto; coste: límite bajo de correos del SMTP integrado y paso extra en desarrollo.
- **Sí:** comprobar `username_disponible` antes de `signUp` y mantener el trigger como garantía. Da un mensaje claro en lugar de un error de base de datos.
- **Sí:** contraseña mínima de 6 caracteres. Es el mínimo de Supabase; la UI actual (4) no pasaría.
- **Sí:** invitado local y puntuaciones en `localStorage` hasta la spec de puntuaciones. Mantiene esta spec acotada y la app estable.
- **No:** invitado como sesión anónima de Supabase. Amplía el alcance (activar auth anónima, limpieza de usuarios anónimos).
- **Sí:** SQL versionado en `supabase/migrations/` y aplicado por MCP. Reproducible y revisable en git.
- **Sí:** clave publicable `sb_publishable_...` en lugar de la clave `anon` legacy. Se puede rotar de forma independiente.
- **No:** guardar o leer `service_role` en la app. Nada de esta spec lo necesita.

## Riesgos identificados

| Riesgo                                                                                                      | Mitigación                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google/GitHub exigen credenciales que solo el usuario puede crear en sus consolas y en el panel de Supabase | Paso 9 lista los pasos manuales; el resto de la spec (correo, invitado) es verificable sin ellos.                                                 |
| El SMTP integrado de Supabase tiene un límite bajo de correos por hora y puede caer en spam                 | Aceptado para desarrollo; SMTP propio queda para otra spec. Se puede desactivar la confirmación temporalmente en el panel.                        |
| El trigger falla y bloquea el registro («Database error saving new user»)                                   | `username` siempre se normaliza y se resuelve el choque con sufijo; probar con nombres vacíos, largos y con símbolos (criterios de aceptación).   |
| Parpadeo de «Entrar» antes de resolver la sesión en el cliente                                              | Snapshot de servidor `null` (igual que hoy, evita errores de hidratación). Leer el usuario en el layout del servidor queda como mejora posterior. |
| `proxy.ts` intercepta los HTML de `public/games/` o recursos estáticos                                      | `matcher` explícito que los excluye; criterio de aceptación sobre `/games/*.html`.                                                                |
| Redirección de OAuth/confirmación a una URL no permitida                                                    | Lista de redirecciones configurada en el panel (paso 9) y fallo controlado a `/acceso?error=auth`.                                                |
| Enumeración de usuarios por mensajes de error                                                               | Mensajes genéricos en `/acceso`; `signUp` de Supabase ya no revela correos existentes con confirmación activada.                                  |
| Políticas RLS insuficientes al añadir `scores`                                                              | Fuera de alcance aquí; `profiles` solo expone `username` y `created_at`, sin datos sensibles.                                                     |

## Qué **no** está en esta spec

- Tabla `scores`, puntuaciones y rankings en Supabase.
- Invitados como usuarios anónimos de Supabase.
- Elegir o editar el `username` tras registrarse.
- Recuperación o cambio de contraseña, borrado de cuenta, MFA, magic link.
- Rutas protegidas por sesión.
- SMTP propio y plantillas de correo personalizadas.
- Pruebas automatizadas.

Cada uno, si llega, va en su propia spec.
