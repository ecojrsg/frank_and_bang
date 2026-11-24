# 04. Reporte Final — Frank and Bang (FrankenTillería)

> **Guía de formato académico:** Extensión objetivo **5–10 páginas** (mantener las capturas de código clave dentro de un máximo de 7 páginas). Exportar este documento junto con los diagramas de `02_arquitectura_y_diagramas.md` a PDF para la entrega final.

**Materia:** Programación Asistida por Inteligencia Artificial  
**Profesor:** Dr. Miguel Jara Maldonado  
**Nombre del Juego:** Frank and Bang  
**Integrantes del Equipo (4):**
1. Jonathan Serna *(Arquitectura Design-First, Gobernanza `hackjs`/AGENTS, Supabase & Motor Principal)*
2. `[Nombre Integrante 2]` *(Asignar módulo presentado: ej. Laboratorio de Víctor y Assets `anatomy` / Bucket `parts-assets`)*
3. `[Nombre Integrante 3]` *(Asignar módulo presentado: ej. Sistema Gacha TCG, Auth y Persistencia)*
4. `[Nombre Integrante 4]` *(Asignar módulo presentado: ej. Arena 2D Worms, Multijugador Realtime y Pruebas Vitest)*

---

## 1. Planteamiento del Problema

El proyecto **FrankenTillería** propone desarrollar un videojuego de estrategia por turnos y artillería 2D al estilo *Worms Armageddon*, compuesto por un **Laboratorio de Víctor** (ensamblaje modular de criaturas con cabeza, torso, brazos y piernas) y un **combate por turnos entre al menos dos jugadores**.

Para lograr un producto divertido, fácil de entender sin explicaciones externas y sencillo de escalar a futuro, identificamos tres retos centrales:
1. **Enganche y progresión inmediata:** Convertir la personalización de partes en una experiencia coleccionable y adictiva tipo **Gacha / Pokémon TCG** con rarezas (`Normal`, `Rara`, `Única`).
2. **Modularidad sin tocar código:** Permitir agregar nuevas piezas y sus gráficos (`.svg` o `.png`) directamente desde la base de datos y almacenamiento en la nube (**Supabase Postgres `public.parts_catalog` + bucket `parts-assets`**) sin recompilar la aplicación.
3. **Multijugador real entre computadoras:** Permitir que un jugador cree una sala, funja como servidor lógico autoritativo y comparta un código de 6 caracteres para que otro jugador se conecte desde otra computadora, incluso en redes escolares con firewalls restrictivos.

---

## 2. Objetivos

### Objetivo General
Diseñar e implementar el MVP 100% web de **Frank and Bang** bajo metodología **Design-First**, integrando autenticación, sistema Gacha de tarjetas coleccionables, ensamblaje modular con estadísticas dinámicas y combate 2D multijugador por turnos sobre Next.js y Supabase, aplicando de manera justificada todas las prácticas de programación asistida por IA vistas en el curso.

### Objetivos Individuales (Equipo de 4 Integrantes)
- **Jonathan Serna:** Dirigir la arquitectura Design-First, crear la skill `hackjs`, redactar `AGENTS.md`, configurar el esquema SQL con RLS, bucket `parts-assets`, motor de dominio y pruebas unitarias.
- **`[Integrante 2]`:** `[Describir objetivo individual concreto y módulo defendido en clase]`.
- **`[Integrante 3]`:** `[Describir objetivo individual concreto y módulo defendido en clase]`.
- **`[Integrante 4]`:** `[Describir objetivo individual concreto y módulo defendido en clase]`.

---

## 3. Diseño de la Propuesta de Solución

### 3.1 Metodología y Arquitectura
Se aplicó **Design-First** (detallado en [`01_metodologia_design_first.md`](01_metodologia_design_first.md)): primero se entrevistaron los requisitos (`/grill-me`), luego se congelaron los diagramas UML, Entidad-Relación y de Secuencia ([`02_arquitectura_y_diagramas.md`](02_arquitectura_y_diagramas.md)), y finalmente se construyó el código siguiendo el estándar `hackjs`.

### 3.2 Estadísticas, Rarezas y Balance
- **Base:** Vida `100`, Ataque `20`, Defensa `5`, Movilidad `100`.
- **Fórmula de daño:** $\text{daño} = \max(1, \text{round}((\text{ATK}_{\text{atacante}} - \text{DEF}_{\text{defensor}}) \times \text{factorExplosión}))$. Con stats base ($20 - 5 = 15$), una partida promedio dura ~6–7 impactos (~2–3 minutos).
- **Rarezas en `public.parts_catalog`:**
  - `Normal` (70%): modificadores de `±1` a `±2` (Vida/Movilidad ×5).
  - `Rara` (24%): modificadores de `±2` a `±3`.
  - `Única` (6%): modificadores de `±3` a `±4` + rasgo pasivo ligero en JSONB (ej. `+15%` radio de explosión o `+2s` de turno).
- **Activos visuales unificados:** Bucket público `parts-assets` en Supabase Storage (PNG/SVG) servido tanto para el cuerpo en el Laboratorio como para las tarjetas del Gacha, con 6 variantes isométricas de Brazos y Piernas generadas con la skill **`anatomy`**.

### 3.3 Capturas de Código Clave (evidencia de conceptos del curso — máx. 7 págs.)
Insertar capturas breves de los siguientes archivos clave:
1. `AGENTS.md` — Ley de sesiones en `docs/entregable final/sesiones/` y reglas Design-First.
2. `.agents/skills/hackjs/SKILL.md` + `skills-lock.json` — Skill propia adaptada para JS/TS.
3. `.agents/agents/design-balance-auditor.md` — Agente personalizado auditando `public.parts_catalog`.
4. `supabase/migrations/20261123000001_init_frank_and_bang.sql` — Tabla `parts_catalog`, bucket `parts-assets` y políticas RLS.
5. `src/domain/statsCalculator.ts` y `src/domain/combatEngine.ts` — Código limpio bajo `hackjs` (headers + JSDoc en inglés + funciones puras).
6. `tests/domain/` — Ejecución en verde de pruebas unitarias con `pnpm test` (Vitest).

### 3.4 Capturas de Pantalla del Funcionamiento
Insertar capturas reales al ejecutar la app:
1. Pantalla de Login / Registro.
2. Menú principal con resumen de criatura, sobres y creación/unión a sala.
3. Apertura de sobre Gacha TCG (revelado de cartas con brillo por rareza y visuals de `parts-assets`).
4. Laboratorio de Víctor ensamblando Brazos/Piernas `anatomy` y viendo cambio de stats en tiempo real.
5. Combate 2D en dos ventanas/computadoras mostrando código de sala, lanzamiento de granada, cráter destructible, indicador de turno y pantalla de victoria.

### 3.5 Liga al Código
- **Repositorio GitHub:** https://github.com/ecojrsg/frank_and_bang
- **Sesiones registradas:** Ver `docs/entregable final/sesiones/Frank Bang MVP Plan.md`.

---

## 4. Autoevaluación de Cada Miembro (500 palabras c/u)

> **Instrucción del profesor:** Cada integrante debe redactar aproximadamente **500 palabras** reflexionando sobre sus acciones, emociones frente a la propuesta de solución, y cómo el proyecto y lo aprendido en el curso aportan a su desarrollo profesional.

### 4.1 Autoevaluación — Jonathan Serna
`[Redactar reflexión personal de ~500 palabras sobre decisiones de diseño, uso de Design-First, creación de hackjs, retos enfrentados, emociones durante el desarrollo y crecimiento logrado en el curso.]`

### 4.2 Autoevaluación — `[Integrante 2]`
`[Redactar reflexión personal de ~500 palabras.]`

### 4.3 Autoevaluación — `[Integrante 3]`
`[Redactar reflexión personal de ~500 palabras.]`

### 4.4 Autoevaluación — `[Integrante 4]`
`[Redactar reflexión personal de ~500 palabras.]`

---

## 5. Referencias

- Next.js Documentation (App Router & Route Handlers). https://nextjs.org/docs
- Supabase Documentation (Auth SSR, Postgres RLS, Realtime Broadcast & Storage). https://supabase.com/docs
- Vitest Testing Framework. https://vitest.dev/
- Shelley, M. (1818). *Frankenstein; or, The Modern Prometheus*.
- Team17 (1999). *Worms Armageddon* (referencia de diseño de artillería 2D por turnos).
