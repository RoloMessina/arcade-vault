# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

No hay tests configurados.

## Next.js no estándar

AGENTS.md avisa que esta versión de Next (16.x) tiene cambios incompatibles con lo que conoces. Antes de escribir código, lee la guía relevante en `node_modules/next/dist/docs/`. Ej.: `params` de las páginas es una `Promise` (`await params`), y `LayoutProps<"/">` es un tipo global.

## Skills

Usa fronted-design cuando vas a diseñar y construir interfaz de usuario.

## Idioma

Toda la UI y los textos están en español (ver `prompt-design.md`, la especificación visual y funcional). Estética: fondo `#0a0a0f`, neón cian/magenta/amarillo, fuentes Press Start 2P (`font-pixel`) y Courier Prime. Los estilos viven en clases personalizadas de `app/globals.css` (`.btn`, `.panel`, `.field`, `.chip`, `.crt-*`…), con Tailwind v4 solo como apoyo.

## Arquitectura

- **Rutas** (`app/`): `/` biblioteca, `/juego/[id]` detalle, `/juego/[id]/jugar` reproductor, `/acceso`, `/salon-de-la-fama`, `/acerca-de` (misión + formulario de contacto). `app/template.tsx` aplica la transición de página.
- **Datos** (`lib/games.ts`): catálogo `GAMES` (único origen de verdad de juegos, sprites pixel-art y colores), puntuaciones semilla deterministas y `buildBoard()` que las mezcla con las guardadas.
- **Estado** (`lib/store.ts`): vía `useSyncExternalStore` (snapshot de servidor `null` para evitar errores de hidratación). La **sesión** es real (Supabase Auth, ver abajo); las **puntuaciones** y la mejor marca de invitado siguen en `localStorage` (backend simulado, con comentarios `BACKEND` donde irá Supabase; pendiente de una spec de puntuaciones).
- **Invitados vs. cuenta**: `useUser()` devuelve `{ name, guest }`. Cuenta = sesión de Supabase con `name = profiles.username`; invitado = `av:user` en `localStorage` (`loginGuest()`), sin usuario en Supabase. Los invitados solo guardan su marca local (`recordGuestBest`); las puntuaciones con cuenta (`saveScore`) entran en los rankings. `logout()` es asíncrono y cierra ambas sesiones. Las entradas `av:user` antiguas con `guest: false` se descartan.
- **Supabase Auth** (SPEC 04): `@supabase/ssr` con cookies. Clientes en `lib/supabase/` (`client.ts` navegador, `server.ts` servidor con `await cookies()`, `proxy.ts` con `updateSession`). `proxy.ts` (raíz; en Next 16 sustituye a `middleware`) solo refresca la sesión, no protege rutas, y excluye `_next/static`, `_next/image`, imágenes y `games/`. `app/auth/callback/route.ts` cambia el `code` (confirmación de correo y OAuth) por sesión y redirige a una ruta fija. `/acceso` (`components/acceso/AccesoForm.tsx`) registra con correo + `username` (comprueba `username_disponible` antes), inicia sesión por correo, y usa Google/GitHub; con confirmación de correo activada. Base de datos: `public.profiles` (`id` → `auth.users`, `username` único `^[A-Z0-9_]{3,20}$`, RLS con lectura pública y sin escritura directa); un trigger `on_auth_user_created` crea el perfil (para OAuth genera el `username` y añade sufijo numérico si choca). El SQL está versionado en `supabase/migrations/` y se aplica con el MCP de Supabase (`apply_migration`). Variables públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`); nunca uses `service_role` en la app.
- **Configuración manual de Supabase** (panel, no está en el código): *Authentication → URL Configuration*: Site URL `http://localhost:3000` y Redirect URLs `http://localhost:3000/**` (añadir el dominio de producción al desplegar). *Authentication → Sign In / Providers*: Email con «Confirm email» activado; Google y GitHub con su Client ID/Secret, usando como callback de cada proveedor la URL que muestra el panel (`https://<ref>.supabase.co/auth/v1/callback`).
- **Navbar** se oculta en rutas que terminan en `/jugar`.
- **Contacto** (`/acerca-de`): el formulario (`components/about/ContactForm.tsx`, cliente, `useActionState`) llama a la Server Action `enviarContacto` de `app/acerca-de/actions.ts`, que valida en servidor y envía un correo de texto plano con el SDK `resend` (remitente `onboarding@resend.dev`, `replyTo` = correo del usuario). La terminal de éxito solo aparece si Resend confirma; cualquier fallo devuelve un error genérico y se registra con `console.error`. Variables de entorno solo de servidor (ver `.env.example`; copiar a `.env.local`): `RESEND_API_KEY` y `CONTACT_TO_EMAIL` (con el remitente de prueba debe ser el correo de la cuenta de Resend). Sin anti-spam más allá de la validación.
- **Juegos HTML** (`public/games/`): se cargan en un iframe con `sandbox="allow-scripts"` desde `components/Player.tsx`. Protocolo por `postMessage`: juego→portal `{type:"arcade:state", score, lives, level}` y `{type:"arcade:gameover", score}`; portal→juego `arcade:pause` / `arcade:resume`. Solo `snake.html` y `asteroids.html` (id `rocas`, portado de `references/started-games/02-asteroids`, SPEC 05) son juegos reales; el resto usa `demo.html` (minijuego de demostración). Los juegos leen `?vidas=` de la URL; el reinicio tras el game over lo hace el portal recargando el iframe, no el juego. El portal valida `e.source` contra el iframe.
