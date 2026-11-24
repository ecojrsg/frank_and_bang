# AGENTS.md — Normativa y Ley del Repositorio Frank and Bang

Este archivo establece las reglas obligatorias que **todo agente de IA y desarrollador** debe cumplir sin excepción al trabajar en el repositorio **Frank and Bang** (*Proyecto final — FrankenTillería*).

---

## 1. Ley Obligatoria de Registro de Sesiones (`docs/entregable final/sesiones/`)

> **REGLA CRÍTICA:** Toda conversación o sesión de trabajo que se realice para este proyecto **DEBE** tener su propio archivo Markdown dentro de la carpeta `docs/entregable final/sesiones/`.

- Cada nueva sesión debe crear (si no existe) un archivo `.md` descriptivo dentro de `docs/entregable final/sesiones/` (por ejemplo, `Frank Bang MVP Plan.md` para la sesión de planeación e implementación del MVP).
- Al avanzar, cambiar decisiones de diseño o concluir hitos dentro de la sesión, el agente **DEBE actualizar ese archivo `.md`** registrando:
  - Fecha y objetivo de la sesión.
  - Resumen estructurado de las preguntas, respuestas y acuerdos clave (incluyendo refinamientos iterativos).
  - Decisiones arquitectónicas tomadas o modificadas.
  - Archivos creados/modificados y resultados de verificación.
- Ninguna sesión de desarrollo se considera cerrada hasta que su bitácora en `docs/entregable final/sesiones/` esté al día.

---

## 2. Metodología de Desarrollo: Design-First

Este proyecto sigue estrictamente **Design-First**:

1. **Diseñar antes de codificar:** Antes de agregar tablas, endpoints, eventos Realtime o módulos de dominio, se actualizan primero los contratos, diagramas Mermaid y especificaciones en `docs/entregable final/02_arquitectura_y_diagramas.md`.
2. **Separación estricta de capas:**
   - `src/domain/`: lógica pura de negocio y física (sin imports de React, Next.js ni Supabase).
   - `src/infrastructure/supabase/`: clientes SSR/Browser, repositorios de tablas y resolución de URLs del bucket de Storage.
   - `src/network/`: protocolo tipado Host-Autoritativo sobre Supabase Realtime.
   - `src/engine/`: renderizado HTML5 Canvas 2D y bucle de juego.
   - `src/components/` y `src/app/`: interfaz React/Next.js y Route Handlers.

---

## 3. Fuente Única de Verdad 100% en Supabase

- **Catálogo de piezas (`public.parts_catalog`):** Todas las partes del personaje (`head`, `torso`, `arms`, `legs`) y sus modificadores viven **exclusivamente en Supabase Postgres (`public.parts_catalog`)**. Queda prohibido usar archivos JSON locales o arreglos hardcodeados como catálogo en producción.
- **Bucket de assets (`parts-assets`):** Todos los archivos visuales (`.svg` o `.png`) tanto de las **partes del cuerpo** como de las **tarjetas del Gacha** viven en el bucket público de Supabase Storage **`parts-assets`**. La interfaz siempre resuelve imágenes desde dicho bucket (usando fallback geométrico limpio únicamente cuando `asset_path` y `card_asset_path` son `NULL`).
- **Seguridad Supabase:** Aplicar siempre las skills `.agents/skills/supabase/SKILL.md` y `.agents/skills/supabase-postgres-best-practices/SKILL.md`:
  - RLS habilitado en **todas** las tablas de `public` y políticas explícitas en `storage.objects`.
  - Usar `TO authenticated` + `(select auth.uid()) = user_id` (nunca `auth.role()`).
  - Políticas `UPDATE` con `USING` y `WITH CHECK`.
  - Índices explícitos en todas las claves foráneas.
  - Nunca exponer `service_role` en código cliente ni crear funciones `SECURITY DEFINER` en `public`.

---

## 4. Estándar de Código: Skill `hackjs`

Todo código JavaScript y TypeScript escrito o modificado en este repositorio debe cumplir `.agents/skills/hackjs/SKILL.md`:

- Confirmar el autor humano de la tarea y colocar el encabezado con autor y timestamps reales (`YYYY-MM-DD HH:MM:SS`).
- Identificadores, comentarios y JSDoc/TSDoc en **inglés**; textos visibles al usuario en la interfaz del juego y documentación académica en **español**.
- Funciones cortas, claras y con **una sola responsabilidad**, pensadas para que un estudiante de ingeniería de software las lea sin descifrar trucos innecesarios.
- Cero `any`; validar fronteras externas (BD, API, Realtime) con Zod.
- Pedir aprobación antes de añadir nuevas dependencias a `package.json`.

---

## 5. Pruebas Unitarias y Verificación

- Toda regla de negocio en `src/domain/` (mapeo de `parts_catalog`, cálculo de estadísticas, fórmula de daño `max(1, ATK - DEF)`, motor Gacha y repetidas, excavación de terreno destructible y física parabólica) debe estar cubierta por pruebas unitarias en **Vitest** (`tests/domain/`).
- Antes de reportar trabajo completado, ejecutar y confirmar en verde:
  - `pnpm test`
  - `pnpm exec tsc --noEmit`
  - `pnpm run lint`
  - `pnpm run build`

---

## 6. Agente Personalizado y Skills del Proyecto

- **Skills activas:** `hackjs`, `supabase`, `supabase-postgres-best-practices` (locales en `.agents/skills/` y registradas en `skills-lock.json`) y `anatomy` (generación de SVGs isométricos autónomos para el bucket `parts-assets`).
- **MCP activo:** Supabase MCP configurado en `.agents/mcp_config.json` (`project_ref=tgsoflrcoezgmoopnzdi`).
- **Agente personalizado:** `.agents/agents/design-balance-auditor.md` — invocarlo para auditar la tabla `public.parts_catalog`, consistencia del bucket `parts-assets`, políticas RLS, balance de combate y cumplimiento de `hackjs` y Design-First.
