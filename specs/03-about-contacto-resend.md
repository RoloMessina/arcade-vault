# SPEC 03 — Página "Acerca de" y envío de contacto con Resend

> **Estado:** Implementado
> **Depende de:** SPEC 02 (navbar con `Inicio/Biblioteca/Salón`, `RevealOnScroll`, `.btn-xl`, tokens CSS)
> **Fecha:** 2026-11-10
> **Objetivo:** Crear la página `/acerca-de` según `about.jsx` (misión, tres destacados y formulario "Contáctanos") y enviar el mensaje por correo con Resend mediante una Server Action, mostrando la terminal de éxito solo cuando Resend confirme el envío.

---

## Por qué existe esta spec

La SPEC 02 dejó fuera `about.jsx`, el formulario de contacto y el enlace de la navbar hacia esta página. En la plantilla (`references/templates/home-about/about.jsx`) el envío es simulado: `onSubmit` solo guarda el nombre y muestra la terminal. Aquí el envío es real: el mensaje llega por correo con [Resend](https://resend.com). La plantilla es un prototipo React + Babel; sirve de referencia visual y de textos, no de código a copiar. Los `._*` de la carpeta son basura de macOS y no se usan.

## Alcance

**Dentro:**

- Nueva ruta `/acerca-de` con las dos secciones de `about.jsx`: hero "ACERCA DE ARCADE VAULT" (kicker, título, misión y 3 destacados con icono SVG) y "CONTÁCTANOS" (intro con 3 avisos + formulario), separadas por la banda divisoria animada.
- Enlace `Sobre nosotros` (`/acerca-de`) en la navbar de escritorio y en el drawer móvil, como cuarto elemento: `Inicio, Biblioteca, Salón de la Fama, Sobre nosotros`.
- Formulario con Nombre, Correo electrónico y Mensaje; animación `shake` si falta algún campo; terminal "VAULT-OS // TERMINAL" al enviar con éxito, con "ENVIAR OTRO MENSAJE".
- Server Action `enviarContacto` que valida en servidor y envía el correo con el SDK `resend`.
- Estado de error propio (la plantilla solo tiene el caso de éxito): mensaje en el formulario que conserva lo escrito.
- Variables de entorno `RESEND_API_KEY` y `CONTACT_TO_EMAIL`, documentadas en un `.env.example`.
- Portar a `app/globals.css` solo los estilos de `about` que falten: `.about-*`, `.highlight*`, `.about-divider`, `.contact-*`, `.terminal-success`/`.term-*`, `.shake`, `.tip-led`.

**Fuera de alcance (para otras specs):**

- Dominio propio verificado en Resend y remitente personalizado (se usa `onboarding@resend.dev`).
- Honeypot, rate limit por IP, CAPTCHA o cualquier otra protección anti-spam más allá de la validación en servidor.
- Guardar los mensajes en base de datos o `localStorage`, bandeja de entrada o panel de administración.
- Correo de confirmación al remitente (solo se envía un correo al equipo).
- Plantillas HTML de correo con React Email; el cuerpo es texto plano.
- Pruebas automatizadas (el repo no tiene configuradas).
- Cambios en `lib/games.ts`, `lib/store.ts`, `public/games/` o en el home.

## Modelo de datos

No hay datos persistentes. Solo contratos nuevos de la Server Action:

```ts
// app/acerca-de/actions.ts
export type ContactoState =
  | { ok: null }                                        // estado inicial
  | { ok: true; nombre: string }                        // enviado, Resend confirmó
  | { ok: false; error: string; valores: ContactoValores; campos?: (keyof ContactoValores)[] };

export type ContactoValores = { nombre: string; correo: string; mensaje: string };
```

Reglas de validación (servidor):

| Campo | Regla |
| --- | --- |
| `nombre` | `trim()` no vacío, máx. 80 caracteres |
| `correo` | `trim()` con formato de correo (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), máx. 254 caracteres |
| `mensaje` | `trim()` no vacío, máx. 2000 caracteres |

Correo enviado con `resend.emails.send`:

- `from`: `Arcade Vault <onboarding@resend.dev>`
- `to`: `process.env.CONTACT_TO_EMAIL`
- `replyTo`: el correo del remitente
- `subject`: `Contacto Arcade Vault — {nombre}`
- `text`: nombre, correo y mensaje en líneas separadas

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

```
RESEND_API_KEY=re_xxxxxxxx
CONTACT_TO_EMAIL=rolomessina1971@gmail.com
```

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de escribir código, leer en `node_modules/next/dist/docs/` las guías de Server Actions / formularios (Next 16) y de variables de entorno.

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con las dos variables (el `.gitignore` ya ignora `.env*`, así que añadir la excepción `!.env.example`). Pedir al usuario que cree `.env.local` con valores reales. Prueba: `npm run build` sigue pasando sin la clave.
2. **Estilos.** Portar a `app/globals.css` lo que falte de `styles.css` (líneas ~1071-1160 de la referencia): bloques de `about`, `highlight`, `about-divider`, `contact-*`, `terminal-success`, `@keyframes shake`. Reutilizar `.btn`, `.btn-xl`, `.field` y tokens existentes; revisar que `.kicker` y `.neon-*` (hoy acotados a `.home`) funcionen en `.about` ampliando el selector o añadiendo equivalentes `.about …`. Añadir `prefers-reduced-motion` para el parpadeo del cursor y los píxeles del divisor. Prueba: `/` y `/acceso` no cambian de aspecto.
3. **Server Action.** Crear `app/acerca-de/actions.ts` (`"use server"`) con `enviarContacto(prev, formData)`: valida según la tabla, comprueba que `RESEND_API_KEY` y `CONTACT_TO_EMAIL` existan, llama a Resend y mapea cualquier fallo (clave ausente, `error` de Resend, excepción) a `{ ok: false, error }` con el texto `NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO MÁS TARDE.` sin filtrar detalles internos. Registrar el error real con `console.error`. Prueba: invocarla desde el formulario del paso 5.
4. **Componentes de página.** Crear `components/about/HighlightIcon.tsx` (3 SVG: HEART, BROWSER, PLANT, 16×16, `currentColor`) y `components/about/ContactForm.tsx` (cliente, `useActionState` + `useFormStatus`/`pending`): estados formulario, enviando (botón deshabilitado `ENVIANDO…`), error y terminal de éxito con `{nombre.toUpperCase()}` y botón "ENVIAR OTRO MENSAJE". Si el cliente detecta un campo vacío, bloquea el envío y aplica `shake` 400 ms (igual que la plantilla); la validación del servidor es la definitiva. Prueba: cada estado se ve al forzarlo.
5. **Página `/acerca-de`.** Crear `app/acerca-de/page.tsx` (servidor) con `RevealOnScroll`, la sección hero, el divisor (`aria-hidden`) y la sección de contacto con textos literales de `about.jsx`, incluidos los destacados: `HECHO CON ❤️ PARA JUGADORES` (magenta), `JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR` (cian), `PROYECTO EN CONSTANTE CRECIMIENTO` (verde), y los avisos `RESPUESTA EN 24-48H`, `SUGERENCIAS BIENVENIDAS`, `SIN SPAM, JAMÁS`. Exportar `metadata` con título en español. Prueba: la página se ve como la plantilla.
6. **Navbar.** En `components/Navbar.tsx` añadir `{ href: "/acerca-de", label: "Sobre nosotros" }` a `LINKS` (cubre escritorio y drawer) y marcarlo activo solo en `/acerca-de`. Prueba: el enlace aparece en ambos menús y lleva a la página.
7. **Revisión final.** Probar el envío real con claves válidas (llega el correo con `replyTo` correcto), el fallo (clave inválida) y 375 px de ancho. Documentar en `CLAUDE.md` la ruta `/acerca-de`, la Server Action y las variables de entorno.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript, también sin `.env.local`.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `/acerca-de` muestra, en orden: kicker `▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión, 3 destacados, banda divisoria, kicker `▸ CONTACTO`, título `CONTÁCTANOS`, subtítulo, 3 avisos y el formulario.
- [ ] Los 3 destacados llevan los textos y colores (magenta, cian, verde) de `about.jsx`, cada uno con su icono.
- [ ] La navbar y el drawer muestran `Inicio, Biblioteca, Salón de la Fama, Sobre nosotros` en ese orden; `Sobre nosotros` solo está activo en `/acerca-de`; `Créditos · 03` sigue visible.
- [ ] El formulario tiene Nombre (`px_kai`), Correo electrónico (`jugador@vault.gg`) y Mensaje (`Cuéntanos qué tienes en mente…`) y el botón `▶ ENVIAR MENSAJE`.
- [ ] Enviar con algún campo vacío no llama a Resend y hace temblar el formulario ~400 ms.
- [ ] Un correo sin formato válido, un nombre > 80 caracteres o un mensaje > 2000 caracteres se rechazan en el servidor con mensaje de error y sin enviar correo.
- [ ] Con claves válidas, enviar un mensaje correcto entrega un correo a `CONTACT_TO_EMAIL` con asunto `Contacto Arcade Vault — {nombre}`, cuerpo con nombre, correo y mensaje, y `replyTo` igual al correo del remitente.
- [ ] Solo cuando Resend confirma el envío se muestra la terminal con `> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE EN MAYÚSCULAS}.`
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los campos vacíos.
- [ ] Sin `RESEND_API_KEY`, con clave inválida o con Resend caído, se muestra `NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO MÁS TARDE.`, se conservan los valores escritos y se puede reintentar; no aparece la terminal de éxito.
- [ ] Mientras se envía, el botón queda deshabilitado y evita envíos duplicados.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente ni en la respuesta de red (comprobable buscando `re_` en `.next/static`).
- [ ] `.env.example` existe y está versionado; `.env.local` no.
- [ ] Las secciones con `.reveal` aparecen al hacer scroll; con `prefers-reduced-motion: reduce` quedan visibles sin animación.
- [ ] Ninguna pantalla tiene scroll horizontal a 375 px de ancho; el formulario se apila bajo la intro por debajo de 900 px.
- [ ] `/`, `/biblioteca`, `/acceso`, `/salon-de-la-fama` y `/juego/[id]` funcionan y se ven igual que antes.

## Decisiones

- **Sí:** Server Action en lugar de Route Handler. Evita un endpoint público que mantener, la clave nunca sale del servidor y encaja con `useActionState` de React 19. Coste: más difícil de probar con `curl`.
- **Sí:** ruta `/acerca-de`. Mantiene el idioma español de `/salon-de-la-fama` y `/acceso`.
- **Sí:** el enlace de la navbar y del drawer se titula "Sobre nosotros" (la plantilla dice "Acerca de"), pero apunta a `/acerca-de` y el título de la página sigue siendo `ACERCA DE ARCADE VAULT`, como en `about.jsx`. Un solo enlace, sin duplicados.
- **Sí:** remitente `onboarding@resend.dev` y destinatario en `CONTACT_TO_EMAIL`. Sin dominio verificado, Resend solo entrega a la cuenta propietaria; basta para desarrollo y demo. Cambiar el remitente más adelante es tocar una línea.
- **Sí:** validación en servidor como única barrera. La plantilla ya valida en el cliente; el servidor es la validación real. No se añade honeypot ni rate limit: se acepta el riesgo de spam (ver riesgos).
- **Sí:** estado de error dentro del formulario, conservando lo escrito. La plantilla no define el fallo y mostrar éxito sin confirmación de Resend sería engañoso.
- **Sí:** el éxito solo se muestra tras confirmación de Resend, a diferencia del prototipo, que lo simula.
- **Sí:** `replyTo` con el correo del remitente, para responder directo desde la bandeja del equipo.
- **Sí:** cuerpo de correo en texto plano. Evita dependencias extra (React Email) para un buzón interno.
- **Sí:** reutilizar `RevealOnScroll`, `.btn`, `.btn-xl` y `.field` de la SPEC 02/01 y portar solo los estilos que faltan, como en las specs anteriores.
- **Sí:** SDK oficial `resend` en lugar de `fetch` a la API REST. Menos código y tipos incluidos.
- **No:** copiar el `navigate({ name })` ni `window.About` de la plantilla; se usa una ruta de Next.
- **No:** correo de confirmación al remitente ni almacenamiento de mensajes; amplían el alcance y la privacidad.
- **No:** copiar el `arcade-vault-standalone.html` ni los `._*`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Spam o abuso del formulario, sin honeypot ni rate limit | Decisión aceptada. Límites de longitud en servidor y cuota gratuita de Resend como techo. Si hay abuso, una spec posterior añade honeypot o rate limit. |
| `onboarding@resend.dev` solo entrega a la cuenta de Resend; un `CONTACT_TO_EMAIL` distinto fallará | Usar el correo de la cuenta (`rolomessina1971@gmail.com`) o verificar un dominio. El error se registra con `console.error` para diagnosticarlo. |
| Falta `RESEND_API_KEY` en el entorno de despliegue | La acción lo detecta y devuelve el error genérico en lugar de lanzar; `build` no depende de la clave. |
| La clave se filtra al cliente o al repositorio | Sin prefijo `NEXT_PUBLIC_`, solo se lee en el archivo `"use server"`; `.env*` ignorado por git y criterio de aceptación de búsqueda en `.next/static`. |
| Inyección de cabeceras o contenido en el correo | El texto va en `text` (no HTML), los campos se recortan y limitan, y `replyTo` solo se acepta si pasa la validación de formato. |
| Los estilos de `about` chocan con `.kicker`/`.neon-*` acotados a `.home` o con `.field` | Prefijos `about-`/`contact-` y revisar `/`, `/acceso` tras el paso 2. |
| Doble envío por doble clic o reintento | Botón deshabilitado mientras `pending`. |

## Qué **no** está en esta spec

- Dominio propio y remitente personalizado en Resend.
- Anti-spam (honeypot, rate limit, CAPTCHA).
- Persistencia, panel o bandeja de mensajes.
- Correo de confirmación al usuario o plantillas HTML de correo.
- Cambios en el home, juegos, puntuaciones, sesión o reproductor.
- Tests automatizados (el repo no tiene configurados).

Cada uno, si llega, va en su propia spec.
