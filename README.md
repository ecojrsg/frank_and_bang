# Frank and Bang — Guía de Instalación, Supabase y Lanzamiento del Servidor

Juego web multijugador 2D de artillería por turnos y coleccionismo TCG (*FrankenTillería*), construido con **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4** y **Supabase** (Auth, PostgreSQL con RLS, Storage y Realtime).

---

## Requisitos previos

- **Node.js** `>= 20.12` (recomendado **Node 22 LTS** — soporta `--env-file`).
- **pnpm** `>= 10` (`npm install -g pnpm` si aún no lo tienes).
- Una cuenta y proyecto en **[Supabase](https://supabase.com/)**.
- **Supabase CLI** (opcional, se puede invocar directamente con `npx supabase`).

---

## 1. Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/ecojrsg/frank_and_bang.git
cd frank_and_bang
pnpm install
```

---

## 2. Configurar las variables de entorno (`.env.local`)

Copia el archivo de plantilla [.env.example](.env.example) a `.env.local` en la raíz del proyecto:

```powershell
# En Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# En macOS / Linux
cp .env.example .env.local
```

Edita `.env.local` con las credenciales de tu proyecto desde el **Supabase Dashboard**:

```env
# Project Settings -> Data API (Project URL)
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co

# Project Settings -> API Keys (Publishable key o Anon public key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_o_anon_key

# Project Settings -> API Keys (Service Role / Secret key - SOLO uso local para scripts)
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

> [!CAUTION]
> Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en código de cliente (`NEXT_PUBLIC_*`) ni subas `.env.local` a Git. El servidor de juego solo usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`); `SUPABASE_SERVICE_ROLE_KEY` únicamente la requiere `scripts/upload-part-assets.mjs` para subir imágenes al bucket.

---

## 3. Crear tablas, catálogo y bucket en Supabase

El proyecto incluye 3 migraciones SQL en [`supabase/migrations/`](supabase/migrations):

1. `20261123000001_init_frank_and_bang.sql` — Esquema inicial (`profiles`, `parts_catalog`, `user_inventory`, `user_loadouts`, `game_rooms`), políticas RLS, trigger de perfil inicial (3 sobres gratis + equipamiento base), catálogo inicial de 12 piezas y bucket público `parts-assets`.
2. `20261123000002_head_torso_assets.sql` — Vincula las rutas SVG de cabezas, torsos, brazos, piernas y tarjetas en `parts-assets`.
3. `20261123000003_four_player_teams.sql` — Soporte de salas para hasta 4 jugadores por equipos (`player_ids uuid[]`, `winner_team_id` y políticas RLS actualizadas).

### Opción A — Usando Supabase CLI (Recomendada)

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

### Opción B — Manual desde el SQL Editor del Dashboard

Si prefieres hacerlo sin CLI:
1. Abre **SQL Editor** en tu proyecto de Supabase.
2. Copia y ejecuta en orden estricto los archivos:
   - `supabase/migrations/20261123000001_init_frank_and_bang.sql`
   - `supabase/migrations/20261123000002_head_torso_assets.sql`
   - `supabase/migrations/20261123000003_four_player_teams.sql`

---

## 4. Generar y subir los assets SVG al bucket `parts-assets`

Las ilustraciones de piezas y tarjetas viven en el bucket público **`parts-assets`** de Supabase Storage.

1. (Opcional si ya existen en `assets/parts-assets/`) Regenera los SVGs isométricos locales:

```bash
pnpm run assets:generate
```

2. Sube los archivos de `assets/parts-assets/` a tu bucket `parts-assets` en Supabase leyendo las variables de `.env.local`:

```bash
node --env-file=.env.local scripts/upload-part-assets.mjs
```

*(Si ya cargaste las variables de entorno en tu terminal, también puedes ejecutar `pnpm run assets:upload`.)*

Al finalizar verás la confirmación: `Done. Uploaded 13 asset(s) to parts-assets.`

---

## 5. Ajustes recomendados en Supabase Auth y Realtime

1. **Evitar límite de correos al registrar jugadores (`email rate limit exceeded`):**
   - El plan gratuito de Supabase Auth limita el envío de correos a **2 por hora**.
   - Para pruebas y partidas rápidas con tus amigos, entra en **Authentication → Providers → Email** y desactiva **Confirm email** (pulsa *Save*). Así los jugadores entran inmediatamente al crear cuenta sin disparar correos.
2. **Realtime habilitado:**
   - Verifica en **Project Settings → API / Realtime** que **Realtime** está activo. Las salas multijugador (`room:<CODIGO>`) usan **Supabase Realtime Presence & Broadcast** para sincronizar lobby y partida en arquitectura *Host-Autoritativo*.

---

## 6. Lanzar el servidor de juego

### Modo desarrollo (local)

```bash
pnpm dev
```

Abre **[http://localhost:3000](http://localhost:3000)** en tu navegador (redirige automáticamente a `/login` o `/menu`).

### Modo desarrollo abierto a red local (LAN / amigos en el mismo Wi-Fi)

```bash
pnpm dev -H 0.0.0.0
```

Comparte la URL de red que imprime Next.js (por ejemplo `http://192.168.1.X:3000`) para que otros dispositivos se conecten y se unan por código de sala.

### Modo producción

```bash
pnpm run build
pnpm start
```

---

## 7. Verificación y pruebas

Antes de desplegar o tras modificar código, ejecuta la batería completa:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

---

## 8. Controles básicos en la Arena

- **Moverse:** `A` / `D` o flechas `←` / `→`
- **Saltar:** `Shift`
- **Apuntar ángulo:** `W` / `S` o flechas `↑` / `↓`
- **Cargar y disparar granada:** Mantén `Espacio` y suelta (o usa los botones en pantalla)
- **Explorar mapa / Zoom:** Arrastra el canvas con el ratón para mover la cámara, usa la **rueda del ratón** para *zoom out/in* o haz clic en el **minimapa**

---

## Solución rápida de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| `Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Falta `.env.local` o tiene nombres incorrectos | Verifica que `.env.local` exista en la raíz y reinicia `pnpm dev`. |
| `email rate limit exceeded` al crear cuenta | *Confirm email* activado en Auth | Desactiva **Confirm email** en *Authentication → Providers → Email* o configura un SMTP propio. |
| Tarjetas sin imagen o mostrando plano técnico fallback | Faltan archivos en el bucket `parts-assets` | Ejecuta `node --env-file=.env.local scripts/upload-part-assets.mjs` y valida que el bucket `parts-assets` sea público. |
| Error `ENOENT` en `.next` al ejecutar `pnpm run build` | `pnpm dev` sigue corriendo en paralelo | Detén `pnpm dev`, borra `.next` y vuelve a ejecutar `pnpm run build`. |
