-- Migration: Initial schema, RLS policies, Storage bucket (parts-assets) and seed for Frank and Bang
-- Follows supabase and supabase-postgres-best-practices skills.

-- 1. Player profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  coins integer not null default 100 check (coins >= 0),
  free_packs integer not null default 3 check (free_packs >= 0),
  created_at timestamptz not null default now()
);

-- 2. Modular body parts catalog (Single Source of Truth)
create table if not exists public.parts_catalog (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  slot text not null check (slot in ('head', 'torso', 'arms', 'legs')),
  rarity text not null check (rarity in ('normal', 'rare', 'unique')),
  asset_path text,
  card_asset_path text,
  description text not null,
  hp_delta integer not null default 0,
  atk_delta integer not null default 0,
  def_delta integer not null default 0,
  mov_delta integer not null default 0,
  trait jsonb,
  is_starter boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint parts_catalog_rarity_bounds check (
    (
      rarity = 'normal'
      and abs(hp_delta) <= 2
      and abs(atk_delta) <= 2
      and abs(def_delta) <= 2
      and abs(mov_delta) <= 2
      and trait is null
    )
    or (
      rarity = 'rare'
      and abs(hp_delta) <= 3
      and abs(atk_delta) <= 3
      and abs(def_delta) <= 3
      and abs(mov_delta) <= 3
      and trait is null
    )
    or (
      rarity = 'unique'
      and abs(hp_delta) <= 4
      and abs(atk_delta) <= 4
      and abs(def_delta) <= 4
      and abs(mov_delta) <= 4
      and trait is not null
    )
  ),
  constraint parts_catalog_starter_must_be_normal check (
    (not is_starter) or (rarity = 'normal' and is_active)
  )
);

-- Guarantee exactly one starter part per slot and fast active pool lookups
create unique index if not exists idx_parts_catalog_one_starter_per_slot
  on public.parts_catalog (slot)
  where is_starter = true;

create index if not exists idx_parts_catalog_active_slot_rarity
  on public.parts_catalog (slot, rarity)
  where is_active = true;

-- 3. Player card/part inventory
create table if not exists public.user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  part_id text not null references public.parts_catalog (id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  obtained_at timestamptz not null default now(),
  unique (user_id, part_id)
);

create index if not exists idx_user_inventory_user_id
  on public.user_inventory (user_id);

create index if not exists idx_user_inventory_part_id
  on public.user_inventory (part_id);

-- 4. Player equipped creature loadout
create table if not exists public.user_loadouts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  head_part_id text not null references public.parts_catalog (id) on delete restrict,
  torso_part_id text not null references public.parts_catalog (id) on delete restrict,
  arms_part_id text not null references public.parts_catalog (id) on delete restrict,
  legs_part_id text not null references public.parts_catalog (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_loadouts_head on public.user_loadouts (head_part_id);
create index if not exists idx_user_loadouts_torso on public.user_loadouts (torso_part_id);
create index if not exists idx_user_loadouts_arms on public.user_loadouts (arms_part_id);
create index if not exists idx_user_loadouts_legs on public.user_loadouts (legs_part_id);

-- 5. Multiplayer Host-Authoritative rooms
create table if not exists public.game_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references public.profiles (id) on delete cascade,
  guest_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  terrain_seed integer not null,
  winner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_rooms_host_user_id
  on public.game_rooms (host_user_id);

create index if not exists idx_game_rooms_guest_user_id
  on public.game_rooms (guest_user_id);

create index if not exists idx_game_rooms_status
  on public.game_rooms (status)
  where status in ('waiting', 'playing');

-- 6. Enable Row Level Security on all public tables
alter table public.profiles enable row level security;
alter table public.parts_catalog enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_loadouts enable row level security;
alter table public.game_rooms enable row level security;

-- Profiles policies
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Parts catalog policies (read-only for authenticated players)
create policy "parts_catalog_select_authenticated"
  on public.parts_catalog for select
  to authenticated
  using (is_active = true);

-- User inventory policies
create policy "user_inventory_select_own"
  on public.user_inventory for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_inventory_insert_own"
  on public.user_inventory for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_inventory_update_own"
  on public.user_inventory for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- User loadouts policies
create policy "user_loadouts_select_own"
  on public.user_loadouts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_loadouts_insert_own"
  on public.user_loadouts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_loadouts_update_own"
  on public.user_loadouts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Game rooms policies
create policy "game_rooms_select_accessible"
  on public.game_rooms for select
  to authenticated
  using (
    status = 'waiting'
    or (select auth.uid()) = host_user_id
    or (select auth.uid()) = guest_user_id
  );

create policy "game_rooms_insert_host"
  on public.game_rooms for insert
  to authenticated
  with check ((select auth.uid()) = host_user_id);

create policy "game_rooms_update_participant_or_join"
  on public.game_rooms for update
  to authenticated
  using (
    (select auth.uid()) = host_user_id
    or (select auth.uid()) = guest_user_id
    or (status = 'waiting' and guest_user_id is null)
  )
  with check (
    (select auth.uid()) = host_user_id
    or (select auth.uid()) = guest_user_id
  );

-- 7. Supabase Storage bucket for part & card visuals (PNG/SVG)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'parts-assets',
  'parts-assets',
  true,
  5242880,
  array['image/svg+xml', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "parts_assets_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'parts-assets');

-- 8. Initial MVP seed: 12 balanced parts (4 slots x 3 rarities)
insert into public.parts_catalog (
  id, name, slot, rarity, asset_path, card_asset_path, description,
  hp_delta, atk_delta, def_delta, mov_delta, trait, is_starter, is_active
)
values
  -- HEADS (3)
  (
    'head_stitch_skull',
    'Craneo Cosido',
    'head',
    'normal',
    null,
    null,
    'Craneo clasico reforzado con pernos de acero. Equilibrio confiable para empezar.',
    1, 0, 1, 0,
    null,
    true, true
  ),
  (
    'head_brass_visor',
    'Visor de Laton',
    'head',
    'rare',
    null,
    null,
    'Lente telescopica calibrada que mejora la precision ofensiva sacrificando agilidad.',
    0, 2, 1, -1,
    null,
    false, true
  ),
  (
    'head_voltaic_crown',
    'Corona Voltaica',
    'head',
    'unique',
    null,
    null,
    'Bobina cerebral sobrecargada que extiende el tiempo de decision en cada turno.',
    3, 2, -1, 1,
    '{"id":"extra_turn_time","name":"Mente Acelerada","description":"Anade +3 segundos al temporizador de tu turno.","effectType":"turn_time_bonus","effectValue":3}'::jsonb,
    false, true
  ),

  -- TORSOS (3)
  (
    'torso_canvas_ribcage',
    'Caja Toracica de Lona',
    'torso',
    'normal',
    null,
    null,
    'Armazon ligero de costillas remendadas con proteccion basica.',
    1, 0, 1, 0,
    null,
    true, true
  ),
  (
    'torso_boiler_plate',
    'Coraza de Caldera',
    'torso',
    'rare',
    null,
    null,
    'Placas remachadas de hierro que absorben metralla a costa de peso extra.',
    2, -1, 2, -1,
    null,
    false, true
  ),
  (
    'torso_reactor_core',
    'Nucleo Reactor',
    'torso',
    'unique',
    null,
    null,
    'Chasis blindado con nucleo amortiguador que dispersa la onda expansiva.',
    4, 1, 1, -2,
    '{"id":"blast_shield","name":"Escudo de Onda","description":"Reduce en 15% el dano recibido por salpicadura.","effectType":"splash_resist_pct","effectValue":15}'::jsonb,
    false, true
  ),

  -- ARMS (3 - isometric SVG visuals generated with anatomy skill)
  (
    'arms_copper_hook',
    'Brazos de Gancho de Cobre',
    'arms',
    'normal',
    'parts/arms/arms_copper_hook.svg',
    null,
    'Articulacion mecanica simple con pinza de cobre para lanzamientos estables.',
    0, 1, 0, 1,
    null,
    true, true
  ),
  (
    'arms_pneumatic_piston',
    'Brazos Piston Neumatico',
    'arms',
    'rare',
    'parts/arms/arms_pneumatic_piston.svg',
    null,
    'Cilindros presurizados que impulsan granadas con fuerza superior.',
    0, 3, -1, 1,
    null,
    false, true
  ),
  (
    'arms_tesla_catapult',
    'Brazos Catapulta Tesla',
    'arms',
    'unique',
    'parts/arms/arms_tesla_catapult.svg',
    null,
    'Acelerador electromagnetico experimental que amplifica cada detonacion.',
    -1, 4, 0, 1,
    '{"id":"overcharged_blast","name":"Detonacion Amplificada","description":"Incrementa el radio de explosion y crater en 15%.","effectType":"blast_radius_pct","effectValue":15}'::jsonb,
    false, true
  ),

  -- LEGS (3 - isometric SVG visuals generated with anatomy skill)
  (
    'legs_peg_struts',
    'Piernas de Puntal Basico',
    'legs',
    'normal',
    'parts/legs/legs_peg_struts.svg',
    null,
    'Soportes de madera y metal que ofrecen estabilidad basica sobre crateres.',
    1, 0, 0, 1,
    null,
    true, true
  ),
  (
    'legs_coil_springs',
    'Piernas de Resorte Helicoidal',
    'legs',
    'rare',
    'parts/legs/legs_coil_springs.svg',
    null,
    'Amortiguadores de acero templado ideales para reposicionarse rapido.',
    0, 1, -1, 3,
    null,
    false, true
  ),
  (
    'legs_hydraulic_walkers',
    'Piernas Hidraulicas de Asalto',
    'legs',
    'unique',
    'parts/legs/legs_hydraulic_walkers.svg',
    null,
    'Tren motriz hidraulico que ancla al suelo y potencia el impulso de disparo.',
    2, 0, 1, 4,
    '{"id":"anchored_launch","name":"Anclaje de Artilleria","description":"Aumenta en 10% la velocidad inicial de tus granadas.","effectType":"launch_speed_pct","effectValue":10}'::jsonb,
    false, true
  )
on conflict (id) do update
set
  name = excluded.name,
  slot = excluded.slot,
  rarity = excluded.rarity,
  asset_path = excluded.asset_path,
  card_asset_path = excluded.card_asset_path,
  description = excluded.description,
  hp_delta = excluded.hp_delta,
  atk_delta = excluded.atk_delta,
  def_delta = excluded.def_delta,
  mov_delta = excluded.mov_delta,
  trait = excluded.trait,
  is_starter = excluded.is_starter,
  is_active = excluded.is_active;
