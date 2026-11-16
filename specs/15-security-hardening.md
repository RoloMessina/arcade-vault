# SPEC — Seguridad: aplicar el checklist de seguridad básico

> **Estado:** Implementado (1 criterio opcional sin probar: el 429 del rate limit)
> **Depende de:** 14-auth-supabase
> **Fecha:** 2026-11-16
> **Objetivo:** Aplicar las medidas del checklist de seguridad (RLS verificado, contraseña mínima de 8 caracteres, límite de registros por IP, headers HTTP en Next.js y funciones `SECURITY DEFINER` sin acceso público) para cerrar los avisos abiertos del linter de Supabase.

---

## Scope

**In:**

- **Headers de seguridad en Next.js** (`next.config.ts`), aplicados a todas las rutas (`/(.*)`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Contraseña mínima de 8 caracteres:**
  - Validación y mensajes en `app/auth/AuthForm.tsx` (hoy `< 6`).
  - Ajuste manual en Supabase: Auth → Sign In / Providers → Email → Minimum password length = 8.
- **Límite de registros por IP (manual en Supabase):** Auth → Rate Limits → sign-ups y sign-ins a 10 cada 5 minutos por IP.
- **Funciones `SECURITY DEFINER`:** migración que revoca `EXECUTE` a `public`, `anon` y `authenticated` en `public.username_disponible(text)` y `public.rls_auto_enable()`, sin borrarlas. Antes se inspeccionan en el SQL Editor (definición y uso por event triggers).
- **Verificación de RLS:** comprobar por SQL que `games`, `scores` y `profiles` tienen RLS activado, y dejarlo documentado. No hay cambios de código en este punto.
- **Documentación:** marcar `references/security/security-checklist.md` con lo hecho y lo bloqueado, y actualizar `CLAUDE.md`.

**Fuera de alcance:**

- **Leaked password protection:** solo disponible en el plan Pro de Supabase y el proyecto es Free. Se anota como bloqueado por el plan; el aviso `auth_leaked_password_protection` seguirá apareciendo en el linter.
- **CAPTCHA** (Turnstile / hCaptcha) en el registro.
- **Content-Security-Policy:** riesgo de romper Next, las fuentes de Google y los scripts inline; merece su propio spec con pruebas en todas las páginas.
- **Borrar** `username_disponible` o `rls_auto_enable`: se revoca el acceso, no se eliminan.
- **Confirmación de email**, recuperación de contraseña y política de complejidad (mayúsculas, números, símbolos).
- **Validación de scores en servidor** y medidas antitrampas del ranking.
- **Cambios en las políticas RLS existentes** de `games`, `scores` o `profiles`; solo se verifican.
- **Tests automatizados** (no hay test runner configurado).

---

## Data model

Sin tablas ni columnas nuevas. Cambios de permisos y configuración:

### Migración SQL — `supabase/migrations/<timestamp>_revoke_definer_functions.sql`

```sql
revoke execute on function public.username_disponible(text)
  from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
```

- `public` es el rol implícito (PUBLIC); `anon` y `authenticated` se listan aparte porque Supabase les concede `EXECUTE` de forma explícita por privilegios por defecto, y revocar solo a PUBLIC no los quitaría.
- `service_role` y el propietario de la función no se tocan: Supabase y los event triggers siguen pudiendo ejecutarlas.
- Si una de las dos funciones no existiera, la migración falla con un error claro; no se usa `if exists` porque las dos aparecen en el linter y deben existir.

### Consultas de inspección (solo lectura, antes de revocar)

```sql
-- Definición de ambas funciones
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('username_disponible', 'rls_auto_enable');

-- ¿Las usa algún event trigger?
select evtname, evtevent, evtfoid::regproc from pg_event_trigger;
```

### Consultas de verificación (después)

```sql
-- RLS activado en las tres tablas
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('games', 'scores', 'profiles');

-- Permisos de ejecución (deben ser false)
select
  has_function_privilege('anon', 'public.username_disponible(text)', 'execute') as anon_username,
  has_function_privilege('authenticated', 'public.username_disponible(text)', 'execute') as auth_username,
  has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') as anon_rls,
  has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') as auth_rls;
```

### Headers — constante en `next.config.ts`

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

Se aplica con `headers: async () => [{ source: '/(.*)', headers: securityHeaders }]`.

### Configuración en el panel de Supabase (no versionable)

| Ajuste                                   | Dónde                                | Antes                       | Después         |
| ---------------------------------------- | ------------------------------------ | --------------------------- | --------------- |
| Minimum password length                  | Auth → Sign In / Providers → Email   | 6                           | **8**           |
| Rate limit de sign-ups y sign-ins por IP | Auth → Rate Limits                   | 30 cada 5 min (por defecto) | **10 cada 5 min** |

### Código afectado

`app/auth/AuthForm.tsx`: la constante de longitud mínima de contraseña pasa de 6 a 8 y los dos mensajes de "mínimo 6 caracteres" pasan a "mínimo 8 caracteres".

---

## Implementation plan

0. **Inspección previa (solo lectura, manual en el SQL Editor):**
   - Ejecutar las dos consultas de inspección: definición de `username_disponible` y `rls_auto_enable`, y lista de event triggers (`pg_event_trigger`).
   - Confirmar con `grep` que ninguna de las dos aparece en el código (`app/`, `components/`, `lib/`).
   - Si alguna la usa el código o un event trigger que no sea de Supabase, parar y decidir antes de revocar.
     _Estado: nada cambia._

1. **Migración de permisos** `supabase/migrations/<timestamp>_revoke_definer_functions.sql` con los dos `revoke execute`. Aplicarla a mano en el SQL Editor (el MCP de Supabase no está autenticado), pegando solo el SQL, sin texto alrededor.
   _Estado: la app sigue igual; las funciones ya no se pueden llamar por `/rest/v1/rpc/`._

2. **Headers de seguridad** en `next.config.ts`:
   - Releer antes la documentación de `headers` en `node_modules/next/dist/docs/`.
   - Añadir la constante `securityHeaders` y `headers: async () => [...]`.
     _Estado: todas las rutas responden con los 5 headers._

3. **Contraseña mínima de 8 en el código** (`app/auth/AuthForm.tsx`): cambiar `< 6` por `< 8` y los dos mensajes a "mínimo 8 caracteres".
   _Estado: el cliente ya exige 8; Supabase aún acepta 6, así que no hay conflicto._

4. **Contraseña mínima de 8 en Supabase (manual):** Auth → Sign In / Providers → Email → Minimum password length = 8 → Save.
   _Estado: servidor y cliente alineados._

5. **Rate limit (manual):** Auth → Rate Limits → sign-ups y sign-ins por IP a 10 cada 5 minutos → Save.
   _Estado: el registro y el login siguen funcionando; solo se limita la ráfaga desde una misma IP._

6. **Verificar RLS y permisos por SQL:** ejecutar las consultas de verificación (RLS en `games`, `scores` y `profiles`, y `has_function_privilege` en `false`). Si algo no coincide, se corrige antes de seguir.

7. **Documentación:**
   - Marcar `references/security/security-checklist.md`: hecho, bloqueado por el plan (leaked password protection) y fuera de alcance (CSP, CAPTCHA).
   - Actualizar `CLAUDE.md`: fila del spec 15 en la tabla y una nota con los headers y la política de contraseñas.

8. **Verificación final** de los criterios de aceptación (build, `curl -I`, registro con 7 y 8 caracteres, rate limit, linter de Supabase) y cambio del estado del spec a `Implementado`.

---

## Acceptance criteria

**Funciones SECURITY DEFINER**

- [x] 🔧 Antes de revocar, la inspección confirma que ninguna de las dos funciones la usa el código ni un event trigger que no sea de Supabase.
- [x] 🔧 `has_function_privilege` devuelve `false` para `anon` y `authenticated` sobre `public.username_disponible(text)` y `public.rls_auto_enable()`.
- [x] 🔧 Los 4 avisos `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya no aparecen en el linter de Supabase (Advisors → Security).
- [x] La migración `<timestamp>_revoke_definer_functions.sql` existe en `supabase/migrations/` y su contenido coincide con lo aplicado.
- [x] El registro y el login siguen funcionando tras la revocación (el trigger `handle_new_user` no se ve afectado).

**RLS**

- [x] 🔧 `relrowsecurity = true` en `games`, `scores` y `profiles`.

**Headers**

- [x] `curl -I http://localhost:3000/` (tras `npm run build && npm start`) muestra los 5 headers con los valores del spec.
- [x] Los mismos 5 headers aparecen en `/auth` y en una play-page (`/games/snake/play`).
- [x] `/`, `/games`, `/auth`, `/hall-of-fame` y una play-page cargan y se ven igual que antes, sin errores nuevos en la consola del navegador.
- [x] La web no se puede incrustar en un `<iframe>` de otro origen (consecuencia de `X-Frame-Options: DENY`).

**Contraseña mínima**

- [x] 🔧 El panel de Supabase muestra Minimum password length = 8.
- [x] En `/auth` → CREAR CUENTA, una contraseña de 7 caracteres se rechaza en el cliente con "Contraseña débil: mínimo 8 caracteres." sin llamar a Supabase.
- [x] Una contraseña de 8 caracteres crea la cuenta. ⚠️
- [x] `grep` no encuentra ya "mínimo 6" en `app/auth/AuthForm.tsx`.

**Rate limit**

- [x] 🔧 El panel de Supabase muestra el límite de sign-ups y sign-ins en 10 cada 5 minutos por IP.
- [ ] _Opcional_ ⚠️: 11 registros seguidos desde la misma IP hacen que el 11.º falle con error 429. Crea hasta 10 cuentas de prueba reales que luego hay que borrar. _(no probado a propósito: crearía hasta 10 cuentas reales; el valor se verificó en el panel)_

**Documentación y calidad**

- [x] `references/security/security-checklist.md` está marcado: hecho, bloqueado por el plan (leaked password protection) y fuera de alcance (CSP, CAPTCHA).
- [x] `CLAUDE.md` incluye la fila del spec 15 en la tabla y la nota de headers y política de contraseñas.
- [x] `npx tsc --noEmit` y `npm run build` sin errores.

_Leyenda: 🔧 requiere SQL o el panel de Supabase; ⚠️ crea datos reales en producción._

---

## Decisions

### Tomadas

| Decisión                                                                                                         | Justificación                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Revocar `EXECUTE` a `public`, `anon` y `authenticated`** en `username_disponible` y `rls_auto_enable`, en una migración. | Cierra los 4 avisos del linter sin perder las funciones. `service_role` y el propietario conservan el acceso, así que Supabase y sus event triggers siguen funcionando. Queda versionado en el repo. |
| **Inspeccionar las funciones antes de revocar** (paso 0).                                                        | No están en ninguna migración del repo: alguien las creó directamente en la base. No hay que revocar a ciegas algo cuya definición no hemos visto.                                       |
| **Contraseña mínima de 8**, supera al 6 del spec 14.                                                             | Lo pide el checklist y es la recomendación del propio panel de Supabase. El spec 14 solo adoptó el mínimo por defecto.                                                                    |
| **Código de la contraseña antes del ajuste del panel.**                                                          | El mensaje ya dice "mínimo 8" cuando Supabase empieza a exigir 8, y en medio no hay un estado roto.                                                                                       |
| **Rate limit de 10 cada 5 minutos por IP.**                                                                      | Frena bots sin bloquear a varios usuarios legítimos tras la misma red. Es un ajuste de panel, sin código.                                                                                  |
| **Headers: los 3 del checklist + HSTS + Permissions-Policy.**                                                    | Bajo riesgo de romper la web. HSTS fuerza HTTPS y Permissions-Policy desactiva cámara, micrófono y geolocalización, que el sitio no usa.                                                  |
| **Headers en `next.config.ts`** con `source: '/(.*)'`.                                                           | Es el mecanismo del propio Next y no requiere `proxy.ts`, que el spec 14 descartó.                                                                                                        |
| **RLS solo se verifica, no se cambia.**                                                                          | Ya está activo en `games`, `scores` y `profiles` (migraciones de los specs 06 y 14). Basta con comprobarlo por SQL y dejarlo documentado.                                                 |
| **Los ajustes de panel (contraseña, rate limit) se hacen a mano** y se anotan en el spec.                        | No hay forma de versionarlos con el repo y el MCP de Supabase no está autenticado.                                                                                                        |
| **Documentar en `references/security/security-checklist.md`** lo hecho, lo bloqueado y lo descartado.            | Es el archivo de origen del spec; sirve de registro visible de qué se cubrió.                                                                                                             |

### Descartadas

| Alternativa                                                                        | Por qué no                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activar leaked password protection (subir a Pro).                                  | Solo existe en el plan Pro y el proyecto es Free. Se documenta como bloqueado; el aviso del linter seguirá.                                                               |
| Comprobar contraseñas filtradas desde el cliente (HaveIBeenPwned con k-anonymity). | Añade código y una dependencia externa a cambio de una protección que Supabase ofrece de serie en Pro.                                                                    |
| Borrar `username_disponible` y `rls_auto_enable`.                                  | Sin su definición original no se puede deshacer. Revocar el acceso logra el mismo efecto de seguridad y es reversible.                                                    |
| Dejar las funciones como están y documentarlas.                                    | Son llamables por cualquiera vía `/rest/v1/rpc/`, y el linter las marca como riesgo.                                                                                      |
| `CAPTCHA` en el registro (Turnstile / hCaptcha).                                   | Requiere cuenta con el proveedor, claves y cambios en `AuthForm`: es un spec aparte.                                                                                      |
| Rate limit de 5 cada 5 minutos.                                                    | Demasiado estricto: varios usuarios legítimos tras la misma IP podrían quedar bloqueados.                                                                                 |
| Mantener el límite por defecto (30 cada 5 minutos).                                | No cumple el punto "limitar signups por IP (anti-bot)" del checklist.                                                                                                     |
| `Content-Security-Policy`.                                                         | Es el header más útil pero el más delicado con Next, las fuentes de Google y los scripts inline. Pide pruebas en todas las páginas y puede romper la web; merece su propio spec. |
| Solo los 3 headers del checklist.                                                  | HSTS y Permissions-Policy cuestan una línea cada uno y no tienen riesgo de regresión.                                                                                     |
| Exigir complejidad de contraseña (mayúsculas, números, símbolos).                  | No está en el checklist; las políticas de complejidad suelen frustrar al usuario sin mejorar mucho la seguridad frente a la longitud.                                     |

---

## Risks

| Riesgo                                                                                                                    | Impacto                                                                                                                      | Mitigación                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Revocar una función que algo usa** (un event trigger de Supabase, una integración o código que no vemos).               | Algo deja de funcionar tras la revocación, p. ej. la activación automática de RLS en tablas nuevas.                           | Paso 0: inspeccionar definición y event triggers antes de revocar. El `revoke` es reversible con un `grant execute`. `service_role` y el propietario conservan el acceso.        |
| **`rls_auto_enable` es un helper del propio Supabase** y quizá la plataforma lo vuelve a crear o a conceder.             | El aviso del linter reaparece tras una actualización.                                                                         | Se documenta en el spec. Si reaparece, se repite el `revoke`; no es un fallo de la app.                                                                                            |
| **Pegado cortado en el SQL Editor** (ya pasó con el spec 14).                                                             | La migración se aplica a medias o falla con errores de sintaxis.                                                              | Pegar solo el SQL, en bloques cortos, y comprobar con `has_function_privilege` que el resultado es el esperado.                                                                    |
| **Los headers rompen algo en producción.** `X-Frame-Options: DENY` impide cualquier iframe y HSTS fuerza HTTPS.           | Una página embebida deja de mostrarse; HSTS puede bloquear acceso por HTTP al dominio y a sus subdominios durante 2 años.     | La web no se incrusta en ningún iframe propio. Revisar antes de desplegar que el dominio y los subdominios soportan HTTPS. `includeSubDomains` se mantiene solo si hay HTTPS en todos. |
| **HSTS no es reversible a corto plazo** (`max-age` de 2 años).                                                           | Si se despliega mal, los navegadores que lo vieron lo recuerdan.                                                              | Se aplica solo en producción con HTTPS ya funcionando. Si hay dudas, se empieza con un `max-age` bajo.                                                                             |
| **Desalineación entre el cliente y el panel** de la contraseña mínima.                                                    | El cliente acepta 8 pero Supabase rechaza o al revés: mensajes confusos o registros bloqueados.                               | El código va primero y el panel después (pasos 3 y 4). El error `weak_password` de Supabase ya se traduce a un mensaje legible en `AuthForm`.                                      |
| **Usuarios con contraseña de 6 o 7 caracteres ya registrados.**                                                           | Ninguno: el mínimo solo se aplica al crear o cambiar contraseña, no al iniciar sesión.                                        | Se anota en el spec. No hay que migrar nada.                                                                                                                                        |
| **Rate limit demasiado estricto.**                                                                                        | Varios usuarios legítimos tras la misma IP (aula, oficina) reciben 429 al registrarse o al entrar.                            | 10 cada 5 minutos es el valor elegido; se puede subir en el panel sin tocar código. El límite aplica también al login, no solo al registro.                                        |
| **La prueba del rate limit crea cuentas reales** en producción.                                                           | Hasta 10 cuentas de prueba en `auth.users` y `profiles`.                                                                      | Es un criterio opcional. Si se hace, se borran después desde el panel de Auth.                                                                                                     |
| **Leaked password protection sigue sin activarse.**                                                                       | Se pueden registrar contraseñas filtradas conocidas.                                                                          | Aceptado: solo disponible en Pro. El aviso del linter permanece y queda documentado.                                                                                                |
| **Panel de Supabase cambiado a mano sin dejar rastro.**                                                                   | Otro desarrollador no sabe que el mínimo es 8 ni el rate limit.                                                               | La tabla de configuración del spec y `CLAUDE.md` lo documentan.                                                                                                                     |
