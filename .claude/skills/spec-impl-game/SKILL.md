---
name: spec-impl-game
description: Implementa un spec de juego aprobado (mismo flujo que /spec-impl) y al terminar lanza en secuencia los agentes skin-designer y luego mobile-porter sobre el juego nuevo.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementa un juego y lo remata con skins y móvil

Mismo flujo que `/spec-impl`, y al terminar la implementación lanza **en secuencia** (nunca en paralelo) dos agentes: primero `skin-designer`, después `mobile-porter`. Responde siempre en español.

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

---

## Instrucciones

El argumento recibido es: `$ARGUMENTS`

### Fases 1–4 — Implementación (idéntica a /spec-impl)

Lee `.agents/skills/spec-impl/SKILL.md` y aplica sus **Fases 1 a 4 sin cambios**: identificar el spec, validar que el estado signifique "Aprobado", crear/cambiar a la rama `spec-NN-slug`, mostrar el resumen e implementar paso a paso con pausas para revisar el diff. Todas sus reglas siguen vigentes (no improvisar ante ambigüedades, nada fuera del alcance del spec, esperar confirmación).

**Si el spec no está Aprobado, o falta el argumento, se detiene aquí: no se lanza ningún agente.**

### Fase 4.5 — Identificar el juego

Cuando se complete el último paso del plan, extrae del spec:

- `game-id`
- componente: `components/games/<Name>Game.tsx`
- play-page: `app/games/<game-id>/play/page.tsx`

Verifica que ambos archivos existen. Si no, detente y avisa al usuario.

### Fase 5 — skin-designer

Pide confirmación al usuario ("¿Lanzo skin-designer?"). Con el sí, lanza **un solo** `Agent` con `subagent_type: "skin-designer"`, en primer plano, con este prompt:

> Implementa las skins del juego `<game-id>` únicamente (componente `<ruta>`, play-page `<ruta>`): `classic` (default), `neon` y `retro`, las tres legibles en modo oscuro; selector en la play-page con `localStorage` `<game-id>-skin`, siguiendo el patrón de `TetrisGame.tsx`. Actualiza `references/templates/games-with-themes.md`. No toques otros juegos ni la lógica de juego.

Espera a que termine y muestra un resumen de lo que hizo. Si falló, detente y pregunta al usuario cómo seguir.

### Fase 6 — mobile-porter

**Solo después de que skin-designer haya terminado** (nunca en el mismo mensaje ni en segundo plano), pide confirmación y lanza `Agent` con `subagent_type: "mobile-porter"`, en primer plano:

> Audita y arregla el formato móvil del juego `<game-id>` (play-page `<ruta>`): sin scroll horizontal, canvas escalado, `TOUCH_BUTTONS` con `TouchControls`, áreas táctiles ≥ 44 px. skin-designer acaba de configurar las skins: no toques los objetos `SKINS` ni el `draw()`. Actualiza `references/templates/mobile-status.md`.

### Cierre

Muestra un resumen de lo que hizo cada agente y recuerda:

```
✅ Implementación + skins + móvil completados.

Siguiente paso: verificar los criterios de aceptación del spec uno a uno.
Si todos pasan, cambia el estado a "Implementado" y haz el commit final antes de mergear.
```

---

## Regla de oro

Los dos agentes tocan la play-page y el componente del mismo juego: **uno detrás de otro, jamás en paralelo**.
