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

## 6. Despliegue en Vivo en Supabase (`tgsoflrcoezgmoopnzdi`) y GitHub

- **Repositorio GitHub creado y subido:** `https://github.com/ecojrsg/frank_and_bang` (commit inicial `f07d138` sobre rama `main`).
- `supabase link --project-ref tgsoflrcoezgmoopnzdi --yes`: **OK** (proyecto `frank_and_bang` enlazado).
- `supabase db push --yes`: **OK** (`20261123000001_init_frank_and_bang.sql` y `20261123000002_head_torso_assets.sql` aplicadas).
- `node --env-file=.env.local scripts/upload-part-assets.mjs`: **OK** (13/13 SVGs isométricos de `anatomy` subidos al bucket `parts-assets`: 12 piezas + `card_back.svg`).
- Servidor de desarrollo `pnpm dev` levantado en `http://localhost:3000`.

---

## 7. Iteración 2 — Pantalla Completa, Cámara Dinámica, Criatura Ensamblada, Audio y Efectos `/anatomy`

### Acuerdos (`/grill-me` + `/plan`)
1. **Criatura ensamblada compartida:** Renderizador modular 2D (`src/engine/creatureRenderer.ts`) compartido entre Laboratorio (`/lab`), Menú (`/menu`), Lobby y Arena (`/arena/[code]`), con silueta/detalles propios para las 12 piezas y fallback por slot/rareza. Además se completaron los 6 SVGs isométricos faltantes de Cabezas y Torsos con `anatomy` (12/12 en `parts-assets`).
2. **Pantalla completa y mapa grande:** Arena inmersiva `100vw × 100vh` (`fixed inset-0`), mundo destructible de **`2200 × 900`**, spawns separados (`x=396` vs `x=1804`), cámara cinematográfica (`src/domain/cameraEngine.ts`) que sigue al atacante y a la granada, tiembla en impactos (`impact_hold`), más arrastre libre con mouse y minimapa táctico interactivo.
3. **Audio procedural y VFX `/anatomy`:** Sintetizador Web Audio API sin dependencias externas (`src/engine/soundEngine.ts`), partículas con envolventes de fuego/humo/chispas (`src/engine/vfxEngine.ts`) y dial isométrico vivo de ángulo/potencia (`src/components/arena/ArtilleryDialGauge.tsx`).

### Archivos Creados / Actualizados en Iteración 2
- `supabase/migrations/20261123000002_head_torso_assets.sql` y `scripts/generate-part-svgs.mjs` (13/13 SVGs).
- `src/domain/cameraEngine.ts`, `src/domain/types.ts`, `src/domain/terrainEngine.ts`, `src/domain/combatEngine.ts`, `src/domain/physicsEngine.ts`, `src/domain/gameRoomHost.ts` y `tests/domain/domain.test.ts`.
- `src/engine/creatureRenderer.ts`, `src/engine/soundEngine.ts`, `src/engine/vfxEngine.ts`, `src/engine/ArenaCanvas.tsx`.
- `src/components/lab/CreaturePreviewPanel.tsx`, `src/components/arena/ArtilleryDialGauge.tsx`, `src/network/realtimeProtocol.ts`.
- `src/app/lab/page.tsx`, `src/app/menu/page.tsx`, `src/app/gacha/page.tsx`, `src/app/arena/[code]/page.tsx`.
- `docs/entregable final/02_arquitectura_y_diagramas.md` y `docs/entregable final/04_reporte_final.md`.

### Resultados de Verificación — Iteración 2 (2026-11-23)
- `node scripts/generate-part-svgs.mjs`: **OK** (13/13 SVGs generados en `assets/parts-assets/`).
- `supabase db push --yes` + `upload-part-assets.mjs`: **OK** (12/12 filas con `asset_path` y 13/13 SVGs en bucket `parts-assets`, verificado HTTP `200`).
- `pnpm test` (`vitest run`): **10/10 pruebas unitarias en verde** (incluye `cameraEngine`, mapa `2200×900` y `CreatureAppearance`).
- `pnpm exec tsc --noEmit`: **0 errores**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación de producción exitosa** (14/14 rutas).

---

## 8. Iteración 3 — Salto (`Shift`), Salas hasta 4 Jugadores (1v1 / 2v2) y Equipos Personalizables

### Requerimientos Implementados
1. **Salto de Criaturas (`Shift` + botón en pantalla):**
   - Comando `{ type: "jump" }` en `src/domain/gameRoomHost.ts` compatible tanto con teclado `WASD` como con flechas (`Shift` sin repetición al mantener presionado), con física de gravedad compartida (`vx`, `vy`, `grounded`), caída natural dentro de cráteres y sonido `playJump()`.
2. **Multijugador hasta 4 Jugadores (1 vs 1 o 2 vs 2):**
   - Migración `supabase/migrations/20261123000003_four_player_teams.sql` (`player_ids uuid[]`, `max_players = 4`, `winner_team_id`, índice GIN y políticas RLS actualizadas) aplicada a Supabase.
   - Reglas en `src/domain/teamLobby.ts` (`validateMatchStart`): **2 jugadores** habilita 1 vs 1; **3 jugadores** bloquea el inicio y espera al 4.º jugador; **4 jugadores** habilita 2 vs 2 con turnos alternados por equipo (`T1-P1 → T2-P1 → T1-P2 → T2-P2`).
3. **Equipos Personalizables con Colores Exclusivos:**
   - En `/arena/[code]`, cada equipo puede editar su nombre y elegir su color (`Rojo`, `Azul`, `Verde`, `Dorado`, `Morado`, `Rosa`) con bloqueo mutuo (un color seleccionado por un equipo queda inhabilitado para el otro), reflejado en el lobby, los personajes del Canvas, el minimapa, el HUD superior y la pantalla de victoria.

### Resultados de Verificación — Iteración 3 (2026-11-23)
- `supabase db push --yes`: **OK** (`20261123000003_four_player_teams.sql` aplicada).
- `pnpm test` (`vitest run`): **12/12 pruebas unitarias en verde** (incluye `teamLobby`, salto y turnos 2 vs 2).
- `pnpm exec tsc --noEmit`: **0 errores**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación limpia (14/14 rutas)**.

---

## 9. Iteración 4 — Terreno/Spawns Aleatorios, Zoom Responsivo 2K Ultrawide y Mapa 4P Ampliado

### Cambios Realizados
1. **Generación Aleatoria y Mapa 4 Jugadores (`src/domain/terrainEngine.ts` + `gameRoomHost.ts`):**
   - Dimensiones dinámicas por cantidad de jugadores: `2600 × 1050` para 2 jugadores y **`4200 × 1050`** para 4 jugadores.
   - Relieve aleatorio combinando 4 armónicos y 2–3 picos/valles gaussianos por partida, más posiciones de aparición aleatorias con distancia mínima garantizada (`>= 1150 px` en 2P, `>= 1050 px` en 4P) y semilla mezclada al iniciar combate en `/arena/[code]`.
2. **Zoom Responsivo 2K / Ultrawide (`src/domain/cameraEngine.ts` + `ArenaCanvas.tsx`):**
   - `computeResponsiveZoom` y `getEffectiveViewport` garantizan un encuadre máximo de `1120 × 620` unidades del mundo independientemente de la resolución del monitor (incluyendo `2560×1080` y `3440×1440`), evitando que el mapa se corte y encuadrando únicamente al tirador activo.

### Resultados de Verificación — Iteración 4 (2026-11-23)
- `pnpm test` (`vitest run`): **14/14 pruebas unitarias en verde** (incluye validación de 20 semillas aleatorias de spawns 2P/4P y zoom responsivo en 5 resoluciones 720p–2K ultrawide).
- `pnpm exec tsc --noEmit`: **0 errores**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación limpia (`14/14` rutas)**.

---

## 10. Iteración 5 — Zoom Out/In con Rueda del Ratón Acotado al Mapa

### Cambios Realizados
- **`src/domain/cameraEngine.ts`:** `applyCameraZoomDelta`, `computeMinZoomFactor` (`max(screenW / worldW, screenH / worldH)` para nunca cortar los bordes del mapa) e interpolación suave de `zoomFactor` → `targetZoomFactor` en `stepCamera`, con restablecimiento automático al cambiar de turno o pulsar **Centrar**.
- **`src/engine/ArenaCanvas.tsx` y `src/app/arena/[code]/page.tsx`:** listener no pasivo de rueda del ratón (`wheel`) sobre el Canvas + indicador interactivo `Zoom XX% · Restablecer` junto al minimapa.

### Resultados de Verificación — Iteración 5 (2026-11-23)
- `pnpm test` (`vitest run`): **15/15 pruebas unitarias en verde** (incluye validación de zoom out/in acotado al mapa en 3440×1440 ultrawide 2K y restablecimiento al cambiar turno).
- `pnpm exec tsc --noEmit`: **0 errores**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación limpia (`14/14` rutas)**.

---

## 11. Iteración 6 — Rediseño Estético Bio-Industrial (Grafito + Verde Radioactivo + Cobre Cyberpunk) y Popout TCG con `/anatomy` + `motion`

### Decisiones de Diseño (`DESIGN.md` & Sistema Técnico de Planos)
- **Paleta Bio-Industrial + Cyberpunk Cobre (sin negro puro `#000000`):**
  - Fondos grafito carbón `#141418` (`--bg-canvas`), `#16161B` (`--bg-sheet` para desvanecimiento de bordes), celdas punteadas `#15151A` (`.blueprint-dots`), y placas mecanizadas `#1B1C22` / `#22242C`.
  - Acentos **Verde Radioactivo Experimental** (`#52FF2E` / `#32C81E`) combinados con **Cobre Cyberpunk / Bronce** (`#D47E3F` / `#EB9C5C`) y texto de alto contraste (`#ECEAE4` / `#B0AEA6` / `#8E8D86`).
  - **Geometría de hoja técnica:** `0px` de radio (`rounded-none`), cero cajas anidadas, divisores de `1px` que se difuminan hacia `#16161B` en los 4 bordes (`.sheet-rule-h`, `.sheet-rule-v`, `.sheet-cell-edge-*`), tipografía industrial `Chakra Petch` + `Barlow` + `JetBrains Mono`.
- **Hoja Técnica de 5 Columnas con Mecanismos Isométricos (`/anatomy`):**
  - **`src/components/iso/isoGeometry.ts`:** librería tipada TypeScript pura de proyección isométrica, extrusión en 4 tonos grafito (`#181920`, `#1E2028`, `#252731`, `#2E313D`), biseles, escalas Vernier y diales radiales.
  - **`src/components/blueprint/BlueprintFigureCell.tsx` y `src/components/blueprint/BlueprintSheetSection.tsx`:** hoja técnica de 5 columnas con celdas punteadas (`FIG_01..FIG_04`), mecanismos físicos isométricos sólidos con una única pieza focal iluminada (`#52FF2E` o `#D47E3F`), interacción hover/clic y pausa automática fuera de pantalla mediante `IntersectionObserver`.
- **Popout Detallado de Apertura de Sobres TCG (`motion` v14.14.0 + `/anatomy`):**
  - Dependencia aprobada e instalada: **`motion`** (`motion/react`).
  - **`src/components/gacha/AnatomyBoosterPackSvg.tsx`:** sobre bio-industrial isométrico sólido en grafito/cobre con banda selladora radioactiva `#52FF2E` y animación de desgarro al pulsar o deslizar.
  - **`src/components/gacha/PackOpeningModal.tsx`:** modal popout inmersivo en 3 fases: (1) sobre sellado isométrico, (2) mazo apilado interactivo donde cada carta se voltea en 3D y se desliza hacia izquierda o derecha con física `motion` (`useMotionValue`, `useTransform`, `AnimatePresence`), y (3) bandeja de resumen con saldo de FrankenCoins por repetidas.
- **Preservación Estricta de Lógica y Arena:**
  - Cero cambios en `src/domain/`, `src/app/api/`, `src/network/` o mecánica de combate.
  - En **`src/engine/ArenaCanvas.tsx`**, **`src/components/arena/ArtilleryDialGauge.tsx`** y la vista activa de **`src/app/arena/[code]/page.tsx`** solo se actualizó la colorimetría (cielo smog grafito-cobre, corteza `#52FF2E`, arcos de puntería cobre `#EB9C5C`, minimapa y HUD carbón/cobre/verde) manteniendo intactos controles, cámara y zoom.

### Resultados de Verificación — Iteración 6 (2026-11-23)
- `pnpm test` (`vitest run`): **15/15 pruebas unitarias en verde**.
- `pnpm exec tsc --noEmit`: **0 errores**.
- `pnpm run lint`: **0 errores, 0 advertencias**.
- `pnpm run build`: **Compilación de producción limpia (`14/14` rutas)**.

---

## 12. Documentación Operativa (`README.md`)
- Se creó **`README.md`** en la raíz del repositorio con la guía paso a paso para clonar el proyecto, configurar `.env.local`, aplicar las 3 migraciones SQL en Supabase (vía CLI o SQL Editor), generar/subir los 13 SVGs al bucket `parts-assets`, configurar Auth/Realtime y lanzar el servidor de juego en desarrollo, LAN (`-H 0.0.0.0`) y producción.

---

## 13. Inicio de la aplicación — 2026-11-24

- **Objetivo:** Ejecutar localmente el proyecto solicitado por el usuario.
- **Entorno:** Node.js no estaba instalado ni disponible en `PATH` al iniciar la sesión.
- **Acciones realizadas:**
  - Se instaló Node.js LTS mediante `winget`.
  - Se instaló `pnpm` 10 globalmente.
  - Se restauraron las 387 dependencias con `pnpm install`.
  - Se inició `pnpm dev` en el puerto 3000.
- **Resultado de verificación:** Next.js quedó listo en `http://localhost:3000` y la ruta raíz respondió `HTTP 200`, con redirección a `/login`.
- **Nota de configuración:** La plantilla `.env.local` contiene una clave publicable pendiente de reemplazar por una credencial real. La interfaz de login puede abrirse, pero las funciones que dependan de Supabase podrían requerir credenciales válidas.











