# SPEC 02 — Home (landing) de Arcade Vault según la plantilla

> **Estado:** Implementado
> **Depende de:** SPEC 01 (catálogo de 8 juegos, `Cover`, navbar con créditos, tokens CSS)
> **Fecha:** 2026-11-10
> **Objetivo:** Crear la landing de `home.jsx` en `/`, mover la biblioteca a `/biblioteca` y añadir "Inicio" a la navbar, sin tocar la lógica de juegos, puntuaciones ni sesión.

---

## Por qué existe esta spec

Hoy `/` es la biblioteca con un hero mínimo. La plantilla `references/templates/home-about/home.jsx` define una landing completa (hero, por qué, juegos, estadísticas, actividad, precios, CTA final) y `nav.jsx` añade el enlace "Inicio". Como en la SPEC 01, las plantillas son prototipos React + Babel con enrutado por hash: sirven de referencia visual, no de código a copiar.

Los archivos de referencia reales (`home.jsx`, `about.jsx`, `nav.jsx`, `styles.css`) están en `references/templates/home-about/`. Los `._*` de esa carpeta son basura de macOS (AppleDouble) y no se usan.

## Alcance

**Dentro:**

- Nueva portada en `/` con las 7 secciones de `home.jsx`: hero con siluetas flotantes, "¿Por qué Arcade Vault?", "Juegos disponibles ahora", franja de estadísticas, "Actividad en vivo", "Precios" con FAQ y CTA final.
- Mover la biblioteca actual de `/` a `/biblioteca`, con su hero y `GameLibrary` sin cambios de comportamiento.
- Navbar y drawer: añadir `Inicio` (`/`) antes de `Biblioteca` (`/biblioteca`). El orden queda `Inicio, Biblioteca, Salón de la Fama`.
- Actualizar los enlaces que hoy apuntan a `/` queriendo decir "biblioteca".
- Animación de aparición al hacer scroll (`.reveal` → `.in`) con `IntersectionObserver`.
- Portar a `app/globals.css` solo los estilos del home que falten.

**Fuera de alcance (para otras specs):**

- Página "Acerca de" (`about.jsx`), el formulario de contacto y el enlace "Acerca de" de la navbar. Va en una spec 03.
- Datos reales en el home: "Últimas puntuaciones", "Top jugadores · hoy" y las estadísticas son **texto fijo copiado de la plantilla**.
- Portadas CSS (`cover-bg`, `cover-bricks`…). Las mini-tarjetas usan el `Cover` con sprites existente.
- Cambios en `lib/games.ts`, `lib/store.ts`, `public/games/` o en la lógica de `GameLibrary`.
- Portar `styles.css` completo (~68 KB).
- Pasarela de pago o planes reales: "Precios" es solo informativo.

## Modelo de datos

El home no introduce datos persistentes ni cambia `Game`, `ScoreEntry` ni las claves de `localStorage`. Los datos fijos de la plantilla viven como constantes locales en `components/home/` (arrays `FEATURES`, `STATS`, `RECENT`, `TOP`, `FAQ`, textos de precio). Las mini-tarjetas leen `GAMES.slice(0, 6)` de `lib/games.ts`.

Textos y cifras se copian literalmente de `home.jsx`, salvo los nombres de juego de `RECENT`, que ya coinciden con los títulos del catálogo de la SPEC 01.

## Plan de implementación

Cada paso deja la app compilando y navegable. Antes de escribir código, leer la guía relevante en `node_modules/next/dist/docs/` (Next 16: `params` es `Promise`, `LayoutProps<"/">` es global).

1. **Mover la biblioteca.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero + `GameLibrary`). Dejar `app/page.tsx` temporalmente con un `redirect("/biblioteca")` o un placeholder. Prueba: `/biblioteca` se ve y se comporta igual que la antigua `/` (8 tarjetas, chips, búsqueda).
2. **Actualizar enlaces y navbar.** En `components/Navbar.tsx`, `LINKS` pasa a `Inicio` (`/`), `Biblioteca` (`/biblioteca`), `Salón de la Fama`; `isActive` hace `/` exacto y marca `Biblioteca` también en `/juego/*`. Cambiar a `/biblioteca` los enlaces de "volver a la biblioteca": `app/juego/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx` y `components/Player.tsx`. El logo y "Cerrar sesión" siguen yendo a `/`. Prueba: cada enlace aterriza donde dice su texto.
3. **Estilos del home.** Portar a `app/globals.css` solo lo que falte de `styles.css`: `.home-*`, `.silo`, `.section-head`, `.feature-card`, `.mini-card`/`.mini-rail`, `.home-stats`, `.activity-*`/`.ticker`/`.top-row`, `.pricing-*`/`.price-card`/`.faq-*`, `.home-final`, `.reveal`/`.reveal.in`, `.pulse`. Reutilizar `.btn`, `.btn-lg` y los tokens existentes (`--cyan`, `--magenta`, `--green`…); añadir `.btn-xl` si no existe. `@media (prefers-reduced-motion: reduce)` desactiva `.reveal`, `.pulse` y el flotado de siluetas.
4. **Componentes del home.** Crear en `components/home/`: `FloatingSilhouettes.tsx` (8 SVG decorativos, `aria-hidden`), `FeatureIcon.tsx` (4 iconos SVG), `RevealOnScroll.tsx` (cliente, aplica `IntersectionObserver` a `.reveal` y lo desconecta al desmontar) y `MiniCard.tsx` (usa `Cover` y un `Link` a `/juego/[id]`). Prueba: cada pieza se renderiza aislada en una página temporal.
5. **Página `/`.** Reescribir `app/page.tsx` como componente de servidor que compone las 7 secciones con los textos de `home.jsx`. CTAs: "Explorar juegos" y "Ver todos los juegos" → `/biblioteca`; "Crear cuenta" y "Empezar gratis" → `/acceso`; "Ver salón" → `/salon-de-la-fama`; "Insertar moneda" → `/biblioteca`. Prueba: la portada muestra las 7 secciones y los 6 primeros juegos del catálogo.
6. **Revisión responsive.** Ajustar a 375 px: cuadrículas de tarjetas, FAQ, tarjeta de precio y filas de actividad sin scroll horizontal. Prueba: recorrer `/` y `/biblioteca` a 375 px.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de TypeScript.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `/` muestra, en este orden: hero, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", franja de estadísticas, "ACTIVIDAD EN VIVO", "PRECIOS" y "¿LISTO PARA JUGAR?".
- [ ] El hero muestra el título en 3 líneas (`EL ARCADE` / `CLÁSICO ESTÁ` / `DE VUELTA`) y los botones "EXPLORAR JUEGOS" y "CREAR CUENTA".
- [ ] "¿POR QUÉ…?" tiene 4 tarjetas: Juegos clásicos, 100% gratis, Ladder boards, Siempre creciendo.
- [ ] "JUEGOS DISPONIBLES AHORA" muestra exactamente los 6 primeros juegos de `GAMES` y cada tarjeta lleva a `/juego/[id]` correcto.
- [ ] La franja de estadísticas muestra `12+`, `MILES` y `GLOBAL` con los textos de la plantilla.
- [ ] "ACTIVIDAD EN VIVO" muestra 7 filas de últimas puntuaciones y 5 de top jugadores, con las 3 primeras destacadas.
- [ ] "PRECIOS" muestra la tarjeta "JUGADOR VAULT · $0 / SIEMPRE" con 6 ventajas y 3 preguntas de FAQ.
- [ ] Los botones de CTA llevan a: `/biblioteca` ("Explorar juegos", "Ver todos los juegos", "Insertar moneda"), `/acceso` ("Crear cuenta", "Empezar gratis") y `/salon-de-la-fama` ("Ver salón").
- [ ] `/biblioteca` conserva 8 tarjetas, chips `Todos, Arcade, Puzzle, Shooter, Versus`, la búsqueda y el estado "NO HAY RESULTADOS".
- [ ] La navbar y el drawer muestran `Inicio, Biblioteca, Salón de la Fama` en ese orden, y `Créditos · 03` sigue visible.
- [ ] `Inicio` solo está activo en `/`; `Biblioteca` está activo en `/biblioteca` y en `/juego/[id]`.
- [ ] "Volver a la biblioteca" en `/salon-de-la-fama`, el detalle y el reproductor lleva a `/biblioteca`.
- [ ] El logo lleva a `/`.
- [ ] Las secciones con `.reveal` aparecen al hacer scroll; con `prefers-reduced-motion: reduce` aparecen sin animación y visibles.
- [ ] Las siluetas flotantes no interceptan clics (`pointer-events: none`) y están ocultas a lectores de pantalla.
- [ ] La navbar sigue oculta en `/juego/[id]/jugar`.
- [ ] Ninguna pantalla tiene scroll horizontal a 375 px de ancho.
- [ ] `/acceso`, `/juego/[id]`, `/juego/[id]/jugar` y `/salon-de-la-fama` funcionan igual que antes (guardar una puntuación con cuenta sigue apareciendo en el ranking).

## Decisiones

- **Sí:** home en `/` y biblioteca en `/biblioteca`. Replica el orden de `nav.jsx` (Inicio, Biblioteca, …) y hace de la landing la portada. Coste: actualizar los enlaces que hoy apuntan a `/`.
- **Sí:** solo home + navbar. `about.jsx` y el formulario de contacto tocan una ruta, estado de formulario y una animación de terminal; van en la spec 03 para que esta sea verificable por sí sola.
- **Sí:** datos de actividad, ranking y estadísticas como texto fijo de la plantilla. Es la decisión tomada; evita acoplar la landing a `buildBoard` y a `localStorage`.
- **Sí:** reutilizar `Cover` con sprites en las mini-tarjetas. Mismo criterio que la SPEC 01: no duplicar el sistema de portadas con los gradientes `cover-bg`.
- **Sí:** portar solo los estilos del home que faltan a `globals.css`. Respeta la regla del `CLAUDE.md` de que los estilos viven ahí, con Tailwind solo como apoyo.
- **Sí:** `app/page.tsx` como componente de servidor y solo `RevealOnScroll` como cliente. La plantilla usa estado de React únicamente para el observer.
- **Sí:** respetar `prefers-reduced-motion`. La plantilla no lo hace; es una mejora mínima de accesibilidad.
- **Sí:** el logo y "Cerrar sesión" llevan a `/` (home), como en la plantilla; el redirect tras iniciar sesión en `/acceso` también se queda en `/`.
- **No:** corregir "12+ JUEGOS" a 8 ni sincronizar el ranking del home con el Salón. Se acepta la incoherencia a cambio de simplicidad (ver riesgos).
- **No:** copiar `navigate({ name })` ni el enrutado por hash; se usan `Link` de Next.
- **No:** copiar el HTML standalone (`arcade-vault-standalone.html`, 1,4 MB) al repo. Los `.jsx` y `styles.css` bastan como referencia.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Quedan enlaces a `/` que debían ir a `/biblioteca` | Buscar con `Grep` los `href="/"` y `router.push("/")` antes de cerrar el paso 2; el criterio de aceptación de "volver a la biblioteca" los cubre. |
| El home muestra "12+ juegos", rankings y puntuaciones que no coinciden con el catálogo (8) ni con el Salón | Decisión aceptada. Si molesta, una spec posterior los conecta a `GAMES` y `buildBoard`. |
| Los estilos nuevos chocan con clases existentes (`.field`, `.panel`, `.btn`) o con los tokens | Prefijo `home-`/`.pricing-`/`.activity-` y reutilizar tokens. Revisar `/acceso` y `/salon-de-la-fama` después del paso 3. |
| El `IntersectionObserver` deja secciones invisibles (`.reveal` sin `.in`) si el JS falla o en el primer render | Las secciones arriba del pliegue se observan al montar; con `prefers-reduced-motion` y sin JS, `.reveal` no oculta contenido. |
| 8 siluetas animadas restan rendimiento en móvil | Animar solo `transform`/`opacity` y ocultar parte de ellas en pantallas estrechas. |

## Qué **no** está en esta spec

- Página "Acerca de", formulario de contacto y su enlace en la navbar.
- Datos reales (ranking, actividad, estadísticas) en el home.
- Portadas CSS de la plantilla.
- Cambios en juegos, puntuaciones, sesión o reproductor.
- Planes de pago reales.
- Tests automatizados (el repo no tiene configurados).

Cada uno, si llega, va en su propia spec.
