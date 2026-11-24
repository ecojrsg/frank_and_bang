# 02. Arquitectura, Diagramas UML y Especificación de Base de Datos

## 1. Arquitectura en Capas (Modularidad Extrema)

El sistema separa el dominio puro de juego de Next.js y Supabase para facilitar pruebas unitarias, lectura académica y extensión futura.

```mermaid
flowchart TD
    UI["Capa UI Next.js App Router (Login, Menu, Gacha TCG, Lab, Arena Canvas)"]
    API["Next.js Route Handlers (Catalogo, Sobres Gacha, Loadouts y Salas)"]
    NET["Capa de Red (Supabase Realtime Host-Authoritative Protocol)"]
    ENG["Motor 2D (Canvas Renderer, Physics, Destructible Terrain, Turn Loop)"]
    DOM["Dominio Puro TypeScript (Part, StatsCalculator, GachaEngine, CombatEngine)"]
    REPO["Repositorio Supabase (parts_catalog, profiles, user_inventory, user_loadouts, game_rooms)"]
    STORAGE["Supabase Storage Bucket: parts-assets (SVGs/PNGs de Partes y Tarjetas)"]
    SUPA["Supabase Cloud (Auth + Postgres RLS + Realtime Broadcast/Presence)"]

    UI --> DOM
    UI --> API
    UI --> ENG
    UI --> NET
    UI --> STORAGE
    ENG --> DOM
    NET --> ENG
    NET --> SUPA
    API --> DOM
    API --> REPO
    REPO --> SUPA
    REPO --> STORAGE
```

---

## 2. Diagrama de Clases UML

```mermaid
classDiagram
    class PartSlot {
        <<enumeration>>
        HEAD
        TORSO
        ARMS
        LEGS
    }

    class PartRarity {
        <<enumeration>>
        NORMAL
        RARE
        UNIQUE
    }

    class StatModifier {
        +number hpDelta
        +number atkDelta
        +number defDelta
        +number movDelta
    }

    class SpecialTrait {
        +string id
        +string name
        +string description
        +string effectType
        +number effectValue
    }

    class Part {
        +string id
        +string name
        +PartSlot slot
        +PartRarity rarity
        +string? assetPath
        +string? cardAssetPath
        +string? assetUrl
        +string? cardAssetUrl
        +string description
        +StatModifier modifiers
        +SpecialTrait? trait
        +boolean isStarter
        +boolean isActive
    }

    class Loadout {
        +Part head
        +Part torso
        +Part arms
        +Part legs
    }

    class CreatureStats {
        +number maxHp
        +number attack
        +number defense
        +number mobility
        +SpecialTrait[] activeTraits
    }

    class PartsRepository {
        +fetchActiveParts() Promise~Part[]~
        +fetchStarterParts() Promise~Part[]~
        +resolvePublicAssetUrl(path: string | null) string | null
    }

    class StatsCalculator {
        +BASE_HP = 100
        +BASE_ATK = 20
        +BASE_DEF = 5
        +BASE_MOV = 100
        +HP_SCALE = 5
        +MOV_SCALE = 5
        +computeStats(loadout: Loadout) CreatureStats
    }

    class GachaEngine {
        +DROP_RATES: Record~PartRarity, number~
        +DUPLICATE_COINS: Record~PartRarity, number~
        +rollPack(catalog: Part[], packSize: number, rng: () => number) Part[]
        +rollRarity(roll: number) PartRarity
    }

    class CombatEngine {
        +calculateDamage(attackerAtk: number, defenderDef: number, splashRatio: number) number
        +applyExplosionDamage(fighters: FighterState[], impactX: number, impactY: number, radius: number, attackerAtk: number) DamageEvent[]
    }

    class TerrainMap {
        +number width
        +number height
        +number[] heightMap
        +generate(seed: number) void
        +carveCrater(cx: number, cy: number, radius: number) void
        +getSurfaceY(x: number) number
    }

    class GrenadeProjectile {
        +number x
        +number y
        +number vx
        +number vy
        +number blastRadius
        +step(dt: number, gravity: number) void
    }

    class GameRoomHost {
        +string roomCode
        +MatchState state
        +TerrainMap terrain
        +handlePlayerInput(playerId: string, cmd: PlayerCommand) void
        +tick(dt: number) MatchSnapshot
        +advanceTurn() void
    }

    Part --> PartSlot
    Part --> PartRarity
    Part --> StatModifier
    Part --> SpecialTrait
    PartsRepository ..> Part : hydrates from public.parts_catalog and parts-assets
    Loadout o-- Part
    StatsCalculator ..> Loadout : reads
    StatsCalculator ..> CreatureStats : computes
    GachaEngine ..> Part : selects
    GameRoomHost *-- TerrainMap
    GameRoomHost *-- GrenadeProjectile
    GameRoomHost ..> CombatEngine : delegates
```

---

## 3. Diagrama Entidad-Relación (Supabase Postgres + RLS)

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text display_name
        integer coins
        integer free_packs
        timestamptz created_at
    }

    PARTS_CATALOG {
        text id PK
        text name
        text slot
        text rarity
        text asset_path
        text card_asset_path
        text description
        integer hp_delta
        integer atk_delta
        integer def_delta
        integer mov_delta
        jsonb trait
        boolean is_starter
        boolean is_active
        timestamptz created_at
    }

    USER_INVENTORY {
        uuid id PK
        uuid user_id FK
        text part_id FK
        integer quantity
        timestamptz obtained_at
    }

    USER_LOADOUTS {
        uuid user_id PK
        text head_part_id FK
        text torso_part_id FK
        text arms_part_id FK
        text legs_part_id FK
        timestamptz updated_at
    }

    GAME_ROOMS {
        text code PK
        uuid host_user_id FK
        uuid guest_user_id FK
        text status
        integer terrain_seed
        uuid winner_user_id FK
        timestamptz created_at
    }

    PROFILES ||--o{ USER_INVENTORY : owns
    PARTS_CATALOG ||--o{ USER_INVENTORY : references
    PROFILES ||--|| USER_LOADOUTS : equips
    PARTS_CATALOG ||--o{ USER_LOADOUTS : equipped_in
    PROFILES ||--o{ GAME_ROOMS : hosts_or_joins
```

---

## 4. Diagramas de Secuencia y Estados

### A. Apertura de Sobre Gacha (Inventario + Bucket `parts-assets`)

```mermaid
sequenceDiagram
    actor Player as Jugador
    participant UI as Gacha UI (TCG Flip)
    participant API as POST /api/gacha/open
    participant Engine as GachaEngine
    participant DB as Supabase Postgres (RLS)
    participant Bucket as Supabase Storage (parts-assets)

    Player->>UI: Clic en "Abrir Sobre"
    UI->>API: Request autenticado (cookie SSR)
    API->>DB: Verifica free_packs > 0 o coins >= 100
    API->>DB: SELECT * FROM public.parts_catalog WHERE is_active = true
    API->>Engine: rollPack(activeCatalog, 3)
    Engine-->>API: 3 cartas sorteadas (70% Normal / 24% Rara / 6% Unica)
    API->>DB: Consulta public.user_inventory por cada part_id
    alt Carta NO poseida
        API->>DB: INSERT user_inventory (quantity = 1), isNew = true
    else Carta YA poseida
        API->>DB: UPDATE user_inventory (quantity + 1) y acredita FrankenCoins
    end
    API-->>UI: Retorna 3 cartas con assetUrl y cardAssetUrl de parts-assets
    UI->>Bucket: Descarga SVG/PNG de tarjeta y parte
    Bucket-->>UI: Asset visual cacheado por CDN
    UI-->>Player: Revelacion animada de las 3 tarjetas
```

### B. Partida Multijugador Host-Autoritativo por Código de Sala

```mermaid
sequenceDiagram
    actor Host as Jugador 1 (Host / Servidor)
    participant DB as Supabase DB (game_rooms)
    participant RT as Supabase Realtime (room:CODE)
    actor Guest as Jugador 2 (Invitado)

    Host->>DB: POST /api/rooms -> codigo 6 chars + terrain_seed
    Host->>RT: Subscribe & Presence (role: host, stats, loadout)
    Guest->>DB: POST /api/rooms/CODE/join -> valida y une invitado
    Guest->>RT: Subscribe & Presence (role: guest, stats, loadout)
    Host->>RT: Broadcast "match_start"
    loop Turno activo (20s de movimiento + 1 lanzamiento de granada)
        Guest->>RT: Broadcast "input_cmd" (move / aim / fire)
        RT-->>Host: Procesa input del turno activo
        Host->>Host: Simula fisica, excava crater, aplica dano ATK - DEF
        Host->>RT: Broadcast "state_snapshot"
        RT-->>Guest: Renderiza estado autoritativo en Canvas 2D
    end
    Host->>DB: POST /api/rooms/CODE/finish (+60 ganador / +30 perdedor)
```

### C. Máquina de Estados de la Partida

```mermaid
stateDiagram-v2
    [*] --> LobbyWaiting : Host crea sala (codigo)
    LobbyWaiting --> TurnMoving : Ambos listos y Host inicia
    TurnMoving --> ProjectileFlight : Jugador lanza granada
    TurnMoving --> TurnSwitch : Se agota tiempo (20s)
    ProjectileFlight --> ExplosionResolve : Impacto en terreno o criatura
    ExplosionResolve --> MatchFinished : Un jugador llega a 0 HP
    ExplosionResolve --> TurnSwitch : Ambos siguen vivos
    TurnSwitch --> TurnMoving : Cambia turno y recarga energia
    MatchFinished --> [*] : Recompensa de FrankenCoins
```

---

## 5. Guía de Extensibilidad: Tabla `public.parts_catalog` y Bucket `parts-assets`

### Tabla que se modifica para agregar nuevas piezas: `public.parts_catalog`

Para agregar una nueva pieza (`normal`, `rare` o `unique`) al juego **no se modifica código fuente**:

1. **(Opcional) Sube la imagen PNG o SVG** al bucket público **`parts-assets`** en Supabase Storage:
   - Ruta recomendada para la parte: `parts/<slot>/<id>.svg` (o `.png`).
   - Ruta recomendada si la tarjeta tiene arte distinto: `cards/custom/<id>.png` (o `.svg`).
   - Si no subes imagen aún, deja `asset_path = NULL` y la interfaz mostrará automáticamente una ficha geométrica descriptiva.
2. **Inserta la fila en `public.parts_catalog`** respetando los rangos de balance por rareza:
   - `normal`: deltas entre `-2` y `+2` (`trait = NULL`).
   - `rare`: deltas entre `-3` y `+3` (`trait = NULL`).
   - `unique`: deltas entre `-4` y `+4` + objeto JSONB `trait` obligatorio.

#### Ejemplo SQL listo para insertar una nueva pieza rara o única

```sql
INSERT INTO public.parts_catalog (
  id,
  name,
  slot,
  rarity,
  asset_path,
  card_asset_path,
  description,
  hp_delta,
  atk_delta,
  def_delta,
  mov_delta,
  trait,
  is_starter,
  is_active
) VALUES (
  'arms_plasma_claw',
  'Garra de Plasma',
  'arms',
  'unique',
  'parts/arms/arms_plasma_claw.png',
  NULL,
  'Lanzador experimental de alta energia que sacrifica blindaje por alcance explosivo.',
  0,
  4,
  -1,
  0,
  '{
    "id": "wide_blast",
    "name": "Onda de Choque",
    "description": "Aumenta el radio de explosion de la granada en 15%.",
    "effectType": "blast_radius_pct",
    "effectValue": 15
  }'::jsonb,
  false,
  true
);
```

### Número promedio recomendado de piezas para versión completa
- **MVP actual:** 12 piezas (4 slots × 3 variantes: 1 Normal starter, 1 Rara, 1 Única).
- **Versión comercial / completa recomendada:** **24 a 36 piezas** (6 a 9 variantes por slot: 3 Normales, 2–3 Raras y 1–3 Únicas por cada parte del cuerpo) para sostener la rejugabilidad del Gacha sin diluir demasiado las piezas iniciales.
