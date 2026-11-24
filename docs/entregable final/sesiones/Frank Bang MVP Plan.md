# Sesión de Trabajo: Frank Bang MVP Plan

- **Proyecto:** Frank and Bang (*Proyecto final — FrankenTillería*)
- **Fecha de sesión:** 2026-11-23
- **Responsable de código en esta sesión:** Jonathan Serna (equipo de 4 integrantes)
- **Metodología:** Design-First + Elicitación Socrática (`/grill-me`) + Planificación (`/plan`)

---

## 1. Requerimiento Inicial del Usuario

El usuario solicitó diseñar y construir el MVP de **Frank and Bang** alineado con el documento académico *Proyecto final — FrankenTillería* (Dr. Miguel Jara Maldonado):

- Juego de estrategia por turnos y artillería 2D tipo *Worms Armageddon*.
- **Pantalla de Login/Registro** con Supabase.
- **Menú principal** con dos pilares: **Jugar** (multijugador por código de sala donde quien crea la sesión actúa como servidor del juego) y **Personalizar personaje** (Laboratorio de Víctor + sistema **Gacha estilo Pokémon TCG** como núcleo adictivo).
- Personaje ensamblado en 4 partes (`Cabeza`, `Torso`, `Brazos`, `Piernas`) con estadísticas base: Vida `100`, Ataque `20`, Defensa `5` (`daño = max(1, ATK - DEF)`), y 3 rarezas (`Normal`: 1–2 pts, `Rara`: 2–3 pts, `Única`: 3–4 pts).
- Uso de la skill `anatomy` para ilustrar variantes diferenciadas de **Brazos y Piernas**, y combate 2D minimalista (personajes tipo bolitas y palitos, 1 arma tipo granada con destrucción de terreno).
- Documentación académica completa en `docs/entregable final/`.

---

## 2. Entrevista Socrática (`/grill-me`) y Decisiones Congeladas

| # | Rama del Árbol de Diseño | Decisión Acordada | Justificación |
|---|---|---|---|
| 1 | **Arquitectura y Stack** | **100% Web con Next.js (App Router + TypeScript + Tailwind CSS)** | Facilita front + API routes en un solo repo, integra Supabase SSR/Realtime y permite jugar desde cualquier navegador sin instalaciones. |
| 2 | **Multijugador Host-Servidor** | **Host Autoritativo sobre Supabase Realtime (Broadcast + Presence)** | El jugador 1 crea sala con código de 6 caracteres y calcula física, cráteres, daño y turnos; el jugador 2 se une desde otra computadora sin problemas de firewall o Wi-Fi universitario. |
| 3 | **Economía Gacha y Habilidades** | **Kit inicial (4 piezas) + 3 sobres gratis + monedas por repetidas/partidas + rasgo pasivo ligero en piezas Únicas** | Experiencia TCG adictiva desde el inicio (70% Normal / 24% Rara / 6% Única), partidas de ~2–3 minutos y cumplimiento de la rúbrica de habilidades especiales. |
| 4 | **Skills (`hackthon` → `hackjs`), `anatomy` y Agente Personalizado** | **Convertir `hackthon` en `hackjs` (JS/TS), eliminar `hackthon`, usar `anatomy` para SVGs de Brazos/Piernas y crear `design-balance-auditor`** | Evita código Python innecesario y logra que cada skill y agente tenga una justificación real al 100%. |
| 5 | **Login con Supabase Auth** | **Email + Contraseña + Nombre de jugador** (recomendando desactivar confirmación de correo en demo) | Registro en segundos durante la evaluación entre compañeros, con persistencia segura mediante RLS. |
| 6 | **Autor y Equipo** | **Equipo de 4 integrantes; autor en headers de esta sesión: `Jonathan Serna`** | Cumple regla de autor confirmado de `hackjs` y estructura el reporte para 4 miembros. |

---

## 3. Refinamientos Iterativos del Plan (Design-First)

### Iteración 1 — Catálogo 100% en Supabase y Regla de Sesiones
El usuario revisó la primera propuesta de `implementation_plan.md` y solicitó tres ajustes fundamentales:
1. **Eliminar `data/parts.json`:** Todo el catálogo de partes reside directamente en la tabla **`public.parts_catalog`** de Supabase Postgres, especificando claramente columnas, restricciones y cómo dar de alta nuevas piezas en BD.
2. **Reenfocar `design-balance-auditor`:** El agente personalizado audita directamente la tabla **`public.parts_catalog`** (y el bucket de Storage), en lugar de un JSON local.
3. **Ley de registro de sesiones en `AGENTS.md`:** Toda sesión de chat del proyecto debe tener su propio archivo Markdown dentro de `docs/entregable final/sesiones/` (comenzando por `Frank Bang MVP Plan.md`) y mantenerse actualizada.

### Iteración 2 — Bucket Unificado `parts-assets` en Supabase Storage
El usuario propuso y validó guardar todos los visuales (PNG o SVG) en un bucket de Supabase Storage:
- Se creó el diseño del bucket público **`parts-assets`** (`parts/<slot>/...` y `cards/...`), referenciado por `asset_path` y `card_asset_path` en `public.parts_catalog`.
- Al abrir un sobre del Gacha, el backend consulta `public.user_inventory` para determinar si el jugador ya posee la tarjeta (`isNew` vs repetida con monedas), y en ambos casos el cliente carga el aspecto visual tanto de la **tarjeta** como de la **parte del cuerpo** directamente desde **`parts-assets`** (con fallback geométrico automático si el campo es `NULL`).
- Los 6 SVGs isométricos de **Brazos y Piernas** + `card_back.svg` se generan con `anatomy` (`figureSvg({ standalone: "dark" })`) listos para subirse al bucket.

---

## 4. Aprobación y Estado de Ejecución

- **Plan aprobado por el usuario:** 2026-11-23 20:46:42.
- **Fase 1 (Gobernanza Agéntica):** Completada — `.agents/skills/hackjs/SKILL.md` creada (autor `Jonathan Serna`), `.agents/skills/hackthon/` eliminada, `skills-lock.json` actualizado con hash SHA-256 (`f77b0c35...`), `AGENTS.md` y `.agents/agents/design-balance-auditor.md` creados.
- **Fase 2 (Documentación Design-First):** Completada — `01_metodologia_design_first.md`, `02_arquitectura_y_diagramas.md`, `03_herramientas_mcp_skills_agentes.md`, `04_reporte_final.md` y esta bitácora de sesión.
- **Fase 3 (Next.js + Supabase + `anatomy`):** Completada — migración SQL `supabase/migrations/20261123000001_init_frank_and_bang.sql` (5 tablas, constraints `CHECK` por rareza, índices FK, RLS en todas las tablas, bucket público `parts-assets`, seed de 12 piezas), `scripts/generate-part-svgs.mjs` (7 SVGs isométricos generados en `assets/parts-assets/`) y `scripts/upload-part-assets.mjs`.
- **Fase 4 (Dominio Puro + Vitest):** Completada — `src/domain/` (`types.ts`, `partMapper.ts`, `statsCalculator.ts`, `gachaEngine.ts`, `combatEngine.ts`, `terrainEngine.ts`, `physicsEngine.ts`, `gameRoomHost.ts`) y suite de pruebas unitarias `tests/domain/domain.test.ts`.
- **Fase 5 (Infraestructura, Auth, API, Gacha TCG y Laboratorio):** Completada — `src/infrastructure/supabase/`, `src/middleware.ts`, 8 Route Handlers en `src/app/api/`, componentes `PartArtwork.tsx` y `TcgPartCard.tsx` conectados al bucket `parts-assets`, y pantallas `/login`, `/menu`, `/gacha` y `/lab`.
- **Fase 6 (Arena 2D Worms y Multijugador Host-Autoritativo):** Completada — `src/network/realtimeProtocol.ts`, `src/engine/ArenaCanvas.tsx` y `src/app/arena/[code]/page.tsx`.

## 5. Resultados de Verificación Final (2026-11-23)

- `node scripts/generate-part-svgs.mjs`: **OK** (7 archivos SVG isométricos generados en `assets/parts-assets/`).
- `pnpm test` (`vitest run`): **9/9 pruebas unitarias en verde** (`tests/domain/domain.test.ts`).
- `pnpm exec tsc --noEmit`: **0 errores de tipos**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación de producción exitosa** (14/14 rutas generadas).

## 6. Despliegue en Vivo en Supabase (`tgsoflrcoezgmoopnzdi`)

- `supabase link --project-ref tgsoflrcoezgmoopnzdi --yes`: **OK** (proyecto `frank_and_bang` enlazado).
- `supabase db push --yes`: **OK** (`20261123000001_init_frank_and_bang.sql` aplicada — 5 tablas, políticas RLS, bucket público `parts-assets` y 12 piezas seed).
- `node --env-file=.env.local scripts/upload-part-assets.mjs`: **OK** (7/7 SVGs isométricos de `anatomy` subidos al bucket `parts-assets`).
- Servidor de desarrollo `pnpm dev` levantado en `http://localhost:3000`.


