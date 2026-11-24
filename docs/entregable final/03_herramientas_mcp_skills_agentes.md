# 03. Herramientas del Curso: MCP, Skills, AGENTS.md, Agente Personalizado y Pruebas

Este documento justifica el uso pertinente de cada concepto evaluado en la rúbrica de **Programación Asistida por Inteligencia Artificial** (3/3 puntos en *Aplicar el conocimiento*).

---

## 1. Matriz de Cumplimiento de la Rúbrica

| Concepto del Curso | Implementación en Frank and Bang | Justificación Técnica (por qué es indispensable) |
|---|---|---|
| **Metodología de desarrollo** | **Design-First** (`implementation_plan.md`, `01_metodologia_design_first.md`, `02_arquitectura_y_diagramas.md`) | Congela UML, esquema `public.parts_catalog`, bucket `parts-assets` y protocolo Realtime antes de codificar, evitando retrabajo y acoplamiento. |
| **Prompting (técnicas)** | Socrático (`/grill-me`), Spec-Driven (`/plan`), Restricciones por Skills y Roles (Auditor) | Guía sistemáticamente a la IA para que el humano dirija la arquitectura y el código no parezca generado al azar. |
| **MCP (Model Context Protocol)** | **Supabase MCP** configurado en `.agents/mcp_config.json` (`project_ref=tgsoflrcoezgmoopnzdi`) | Permite consultar documentación oficial de Supabase, inspeccionar el esquema Postgres, aplicar/verificar migraciones y auditar advisors de seguridad directamente contra el proyecto real. |
| **Skills** | `hackjs` (creada/adaptada), `supabase`, `supabase-postgres-best-practices` (en `skills-lock.json`) y `anatomy` | Cada skill resuelve un riesgo real: calidad/legibilidad JS/TS (`hackjs`), seguridad RLS y Storage (`supabase` + `postgres`), e ilustraciones SVG isométricas técnicas de Brazos y Piernas (`anatomy`). |
| **`AGENTS.md`** | Archivo normativo en la raíz `AGENTS.md` | Actúa como constitución del repositorio: impone Design-First, fuente única en `public.parts_catalog` + `parts-assets`, estándar `hackjs`, RLS obligatorio y **la ley de registrar cada sesión de chat en `docs/entregable final/sesiones/`**. |
| **Agente personalizado** | `.agents/agents/design-balance-auditor.md` | Audita de forma independiente la tabla `public.parts_catalog` (rangos por rareza, starters, hits-to-KO), la consistencia con `parts-assets`, políticas RLS y apego a `hackjs`. |
| **Refinamiento iterativo** | Documentado en `docs/entregable final/sesiones/Frank Bang MVP Plan.md` | Muestra evolución real guiada por el usuario: cambio a Next.js, creación de `hackjs`, eliminación de JSON en favor de `public.parts_catalog` y unificación de visuales en el bucket `parts-assets`. |
| **Pruebas unitarias** | Suite **Vitest** en `tests/domain/` | Verifica de forma determinista el mapeo de `parts_catalog` + URLs de `parts-assets`, cálculo de stats (`100/20/5/100`), fórmula de daño (`20 - 5 = 15`), probabilidades del Gacha, excavación de cráteres y física parabólica. |

---

## 2. Detalle de Skills y Cómo se Aplican

### A. Skill Propia: `hackjs` (`.agents/skills/hackjs/SKILL.md`)
Adaptada a partir de `hackthon` específicamente para el ecosistema **JavaScript y TypeScript** del proyecto y registrada con hash SHA-256 en `skills-lock.json`:
- Exige confirmar explícitamente el autor humano (`Jonathan Serna`) y colocar encabezados con timestamps reales (`YYYY-MM-DD HH:MM:SS`) en cada archivo `.ts`/`.tsx`/`.mjs` escrito a mano.
- Impone identificadores, comentarios y JSDoc/TSDoc en **inglés**, mientras los textos visibles al jugador se mantienen en **español**.
- Obliga a escribir funciones cortas con **una sola responsabilidad**, sin `any`, sin sobre-ingeniería y fáciles de entender por estudiantes de ingeniería de software.

### B. Skills de Base de Datos: `supabase` y `supabase-postgres-best-practices`
Aplicadas en `supabase/migrations/20261123000001_init_frank_and_bang.sql` y en `src/infrastructure/supabase/`:
- RLS habilitado en las 5 tablas públicas (`profiles`, `parts_catalog`, `user_inventory`, `user_loadouts`, `game_rooms`).
- Políticas con `TO authenticated` y `(select auth.uid()) = user_id` (evitando `auth.role()` deprecado y previniendo BOLA/IDOR).
- `USING` + `WITH CHECK` en todas las políticas `UPDATE`.
- Índices explícitos en todas las claves foráneas e índice parcial sobre `parts_catalog(slot, rarity) WHERE is_active = true`.
- Bucket público de lectura **`parts-assets`** con políticas en `storage.objects` y sin exponer `service_role` al navegador.

### C. Skill Visual: `anatomy`
Aplicada mediante el script reproducible `scripts/generate-part-svgs.mjs` usando el motor `kit/iso-kit.mjs` de `anatomy` en modo SVG autónomo (`figureSvg({ standalone: "dark" })`):
- Genera las 3 variantes isométricas de **Brazos** (`arms_copper_hook.svg`, `arms_pneumatic_piston.svg`, `arms_tesla_catapult.svg`), las 3 variantes isométricas de **Piernas** (`legs_peg_struts.svg`, `legs_coil_springs.svg`, `legs_hydraulic_walkers.svg`) y el reverso oficial de carta (`card_back.svg`).
- Los archivos generados se suben al bucket **`parts-assets`** de Supabase Storage para consumirse tanto en el Laboratorio de Víctor como en las tarjetas del Gacha.

---

## 3. Agente Personalizado: `design-balance-auditor`

Definido en `.agents/agents/design-balance-auditor.md`, se invoca cada vez que el equipo inserta o ajusta filas en `public.parts_catalog` o sube nuevos PNG/SVG al bucket `parts-assets`:
1. Comprueba matemáticamente que ninguna combinación rompa la ventana de **4 a 12 impactos para ganar** (~2–3 minutos por partida).
2. Verifica que haya exactamente 1 pieza `is_starter = true` de rareza `normal` por cada slot (`head`, `torso`, `arms`, `legs`).
3. Valida rutas de `asset_path` / `card_asset_path` hacia `parts-assets`, políticas RLS e índices de Postgres.
4. Audita el aislamiento de `src/domain/` y el cumplimiento de `hackjs`.
