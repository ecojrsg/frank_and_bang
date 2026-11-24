-- Migration: Expand public.game_rooms for up to 4 players and customizable teams
-- Follows supabase and supabase-postgres-best-practices skills.

alter table public.game_rooms
  add column if not exists player_ids uuid[] not null default '{}',
  add column if not exists max_players integer not null default 4 check (max_players = 4),
  add column if not exists winner_team_id text check (winner_team_id in ('team1', 'team2'));

update public.game_rooms
set player_ids = array_remove(array[host_user_id, guest_user_id], null)
where coalesce(array_length(player_ids, 1), 0) = 0;

alter table public.game_rooms
  drop constraint if exists game_rooms_max_four_players,
  add constraint game_rooms_max_four_players
    check (coalesce(array_length(player_ids, 1), 0) <= 4);

create index if not exists idx_game_rooms_player_ids
  on public.game_rooms using gin (player_ids);

drop policy if exists "game_rooms_select_accessible" on public.game_rooms;
create policy "game_rooms_select_accessible"
  on public.game_rooms for select
  to authenticated
  using (
    status = 'waiting'
    or (select auth.uid()) = host_user_id
    or (select auth.uid()) = any(player_ids)
  );

drop policy if exists "game_rooms_update_participant_or_join" on public.game_rooms;
create policy "game_rooms_update_participant_or_join"
  on public.game_rooms for update
  to authenticated
  using (
    (select auth.uid()) = host_user_id
    or (select auth.uid()) = any(player_ids)
    or (status = 'waiting' and coalesce(array_length(player_ids, 1), 0) < 4)
  )
  with check (
    (select auth.uid()) = host_user_id
    or (select auth.uid()) = any(player_ids)
  );
