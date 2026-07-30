-- ============================================================================
-- 20260728_rls_perf_phase1.sql
-- Phase 1 performance + security migration (no app-code changes required)
--
-- 1. Index every unindexed foreign key (20 indexes)
-- 2. Rewrite RLS policies: auth.uid()/auth.role()/auth.jwt() wrapped in
--    scalar subselects so they evaluate ONCE per query, not once per row
--    (fixes every `auth_rls_initplan` advisor warning)
-- 3. Consolidate multiple permissive policies per action where provably
--    semantics-preserving (OR of quals / OR of with_checks)
-- 4. Security: drop public-write policy on ghin_index_cache
--    (roles={public}, USING(true) — service role bypasses RLS and does not
--    need it; clients never write this table). Enable RLS on bb_member_index
--    with read-only access (clients only SELECT; edge fns use service role).
--
-- NOT changed (intentional):
-- * session_handoffs: RLS-on/no-policies = deny-all to clients; the
--   SECURITY DEFINER handoff functions still work. Separate follow-up.
-- * roster_shares claim/self-link UPDATE flows: merged but equivalent —
--   multi-permissive UPDATE = (USING_a OR USING_b) + (CHECK_a OR CHECK_b).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · Missing FK indexes
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists idx_feedback_user_id              on public.feedback (user_id);
create index if not exists idx_game_configs_created_by       on public.game_configs (created_by);
create index if not exists idx_ledger_entries_round_id       on public.ledger_entries (round_id);
create index if not exists idx_ledger_entries_from_member_id on public.ledger_entries (from_member_id);
create index if not exists idx_ledger_entries_to_member_id   on public.ledger_entries (to_member_id);
create index if not exists idx_linked_matches_created_by     on public.linked_matches (created_by);
create index if not exists idx_pending_challenges_challenged_round_id on public.pending_challenges (challenged_round_id);
create index if not exists idx_pending_challenges_challenger_round_id on public.pending_challenges (challenger_round_id);
create index if not exists idx_pending_challenges_linked_match_id     on public.pending_challenges (linked_match_id);
create index if not exists idx_roster_shares_sender_id       on public.roster_shares (sender_id);
create index if not exists idx_scorer_invites_from_profile_id on public.scorer_invites (from_profile_id);
create index if not exists idx_scorer_invites_round_id       on public.scorer_invites (round_id);
create index if not exists idx_scores_entered_by             on public.scores (entered_by);
create index if not exists idx_sessions_created_by           on public.sessions (created_by);
create index if not exists idx_tournament_matches_round_id   on public.tournament_matches (round_id);
create index if not exists idx_tournament_matches_schedule_id on public.tournament_matches (schedule_id);
create index if not exists idx_tournament_members_user_id    on public.tournament_members (user_id);
create index if not exists idx_tournament_schedule_tournament_id on public.tournament_schedule (tournament_id);
create index if not exists idx_tournament_team_players_team_id on public.tournament_team_players (team_id);
create index if not exists idx_tournaments_owner_id          on public.tournaments (owner_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · courses (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists courses_select_public on public.courses;
create policy courses_select_public on public.courses for select
  using (is_public = true or owner_id = (select auth.uid()));

drop policy if exists courses_insert_own on public.courses;
create policy courses_insert_own on public.courses for insert
  with check (owner_id = (select auth.uid()));

drop policy if exists courses_update_own on public.courses;
create policy courses_update_own on public.courses for update
  using (owner_id = (select auth.uid()));

drop policy if exists courses_delete_own on public.courses;
create policy courses_delete_own on public.courses for delete
  using (owner_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · feedback (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "authenticated users can submit feedback" on public.feedback;
create policy "authenticated users can submit feedback" on public.feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "users can view own feedback" on public.feedback;
create policy "users can view own feedback" on public.feedback
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4 · game_configs (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists game_configs_select_own_or_member on public.game_configs;
create policy game_configs_select_own_or_member on public.game_configs for select
  using (exists (
    select 1 from rounds r
    where r.id = game_configs.round_id
      and (r.owner_id = (select auth.uid())
           or exists (select 1 from round_members rm
                      where rm.round_id = r.id and rm.profile_id = (select auth.uid())))));

drop policy if exists game_configs_insert on public.game_configs;
create policy game_configs_insert on public.game_configs for insert
  with check (exists (
    select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = (select auth.uid())));

drop policy if exists game_configs_update on public.game_configs;
create policy game_configs_update on public.game_configs for update
  using (exists (
    select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = (select auth.uid())));

drop policy if exists game_configs_delete on public.game_configs;
create policy game_configs_delete on public.game_configs for delete
  using (exists (
    select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 5 · ghin_index_cache — SECURITY FIX
-- "service role can write ghin cache" was roles={public} USING(true):
-- any anon client could write. Service role bypasses RLS entirely, so the
-- edge functions keep working. Read stays public (unchanged policy).
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "service role can write ghin cache" on public.ghin_index_cache;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 6 · bb_member_index — SECURITY FIX (advisor ERROR: RLS disabled)
-- Clients only SELECT; edge functions write via service role (bypasses RLS).
-- ────────────────────────────────────────────────────────────────────────────
alter table public.bb_member_index enable row level security;
drop policy if exists bb_member_index_read on public.bb_member_index;
create policy bb_member_index_read on public.bb_member_index for select
  using (true);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 7 · ledger_entries (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select on public.ledger_entries for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists ledger_entries_insert on public.ledger_entries;
create policy ledger_entries_insert on public.ledger_entries for insert
  with check ((select auth.role()) = 'authenticated');

drop policy if exists ledger_entries_delete on public.ledger_entries;
create policy ledger_entries_delete on public.ledger_entries for delete
  using (exists (
    select 1 from rounds r
    where r.id = ledger_entries.round_id and r.owner_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 8 · linked_matches (consolidate 2 SELECT → 1; initplan)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists linked_matches_select_participant on public.linked_matches;
drop policy if exists linked_matches_select_pending on public.linked_matches;
create policy linked_matches_select on public.linked_matches for select
  using (
    (status = 'pending' and (select auth.role()) = 'authenticated')
    or created_by = (select auth.uid())
    or exists (select 1 from rounds r
               where r.id = any (array[linked_matches.round_a_id, linked_matches.round_b_id])
                 and r.owner_id = (select auth.uid()))
    or exists (select 1 from round_members rm
               where rm.round_id = any (array[linked_matches.round_a_id, linked_matches.round_b_id])
                 and rm.profile_id = (select auth.uid())));

drop policy if exists linked_matches_insert_own on public.linked_matches;
create policy linked_matches_insert_own on public.linked_matches for insert
  with check (created_by = (select auth.uid()));

drop policy if exists linked_matches_update_participant on public.linked_matches;
create policy linked_matches_update_participant on public.linked_matches for update
  using (
    created_by = (select auth.uid())
    or exists (select 1 from rounds r
               where r.id = linked_matches.round_a_id and r.owner_id = (select auth.uid()))
    or (round_b_id is not null
        and exists (select 1 from rounds r
                    where r.id = linked_matches.round_b_id and r.owner_id = (select auth.uid())))
    or (round_b_id is null and (select auth.role()) = 'authenticated'));

drop policy if exists linked_matches_delete_creator on public.linked_matches;
create policy linked_matches_delete_creator on public.linked_matches for delete
  using (created_by = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 9 · pending_challenges (restructure ALL+SELECT+UPDATE → per-command)
-- Equivalent: challenger had ALL; challenged had SELECT + UPDATE.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists challenger_all on public.pending_challenges;
drop policy if exists challenged_read on public.pending_challenges;
drop policy if exists challenged_update on public.pending_challenges;

create policy pending_challenges_select on public.pending_challenges for select
  using ((select auth.uid()) = challenger_id or (select auth.uid()) = challenged_user_id);

create policy pending_challenges_insert on public.pending_challenges for insert
  with check ((select auth.uid()) = challenger_id);

create policy pending_challenges_update on public.pending_challenges for update
  using ((select auth.uid()) = challenger_id or (select auth.uid()) = challenged_user_id)
  with check ((select auth.uid()) = challenger_id or (select auth.uid()) = challenged_user_id);

create policy pending_challenges_delete on public.pending_challenges for delete
  using ((select auth.uid()) = challenger_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 10 · profiles (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using ((select auth.uid()) = id);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 11 · roster_players (consolidate 4 SELECT → 1, 2 UPDATE → 1)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists roster_select on public.roster_players;
drop policy if exists roster_select_by_email on public.roster_players;
drop policy if exists roster_select_linked_match_host on public.roster_players;
drop policy if exists roster_select_own_user_id on public.roster_players;
create policy roster_players_select on public.roster_players for select
  using (
    owner_id = (select auth.uid())
    or user_id = (select auth.uid())
    or (email is not null and lower(email) = lower((select auth.jwt()) ->> 'email'))
    or (is_favorite = true and owner_id in (
        select r.owner_id
        from rounds r
        join linked_matches lm on lm.round_a_id = r.id
        where lm.status in ('pending', 'linked')
          and lm.round_b_id in (select rm.round_id from round_members rm
                                where rm.profile_id = (select auth.uid())))));

drop policy if exists roster_insert on public.roster_players;
create policy roster_players_insert on public.roster_players for insert
  with check (owner_id = (select auth.uid()));

drop policy if exists roster_update on public.roster_players;
drop policy if exists roster_update_self_link on public.roster_players;
create policy roster_players_update on public.roster_players for update
  using (
    owner_id = (select auth.uid())
    or (email is not null and user_id is null
        and lower(email) = lower((select auth.jwt()) ->> 'email')))
  with check (
    owner_id = (select auth.uid())
    or user_id = (select auth.uid()));

drop policy if exists roster_delete on public.roster_players;
create policy roster_players_delete on public.roster_players for delete
  using (owner_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 12 · roster_shares (consolidate 2 SELECT → 1, 2 UPDATE → 1)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists roster_shares_select_recipient on public.roster_shares;
drop policy if exists roster_shares_select_sender on public.roster_shares;
create policy roster_shares_select on public.roster_shares for select
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (recipient_id is null
        and lower(recipient_email) = lower((select auth.jwt()) ->> 'email')));

drop policy if exists roster_shares_insert on public.roster_shares;
create policy roster_shares_insert on public.roster_shares for insert
  with check (sender_id = (select auth.uid()));

drop policy if exists roster_shares_claim on public.roster_shares;
drop policy if exists roster_shares_update_claimed on public.roster_shares;
create policy roster_shares_update on public.roster_shares for update
  using (
    recipient_id = (select auth.uid())
    or (recipient_id is null
        and lower(recipient_email) = lower((select auth.jwt()) ->> 'email')))
  with check (recipient_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 13 · round_members (consolidate 2 SELECT → 1; initplan)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists round_members_select_own_or_member on public.round_members;
drop policy if exists round_members_select_linked_match on public.round_members;
create policy round_members_select on public.round_members for select
  using (
    is_round_owner(round_id, (select auth.uid()))
    or is_round_member(round_id, (select auth.uid()))
    or is_round_member_via_linked_match(round_id, (select auth.uid())));

drop policy if exists round_members_insert on public.round_members;
create policy round_members_insert on public.round_members for insert
  with check (is_round_owner(round_id, (select auth.uid()))
              or profile_id = (select auth.uid()));

drop policy if exists round_members_update on public.round_members;
create policy round_members_update on public.round_members for update
  using (profile_id = (select auth.uid())
         or exists (select 1 from rounds r
                    where r.id = round_members.round_id and r.owner_id = (select auth.uid())));

drop policy if exists round_members_delete on public.round_members;
create policy round_members_delete on public.round_members for delete
  using (profile_id = (select auth.uid())
         or exists (select 1 from rounds r
                    where r.id = round_members.round_id and r.owner_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 14 · round_settlements (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists round_settlements_select on public.round_settlements;
create policy round_settlements_select on public.round_settlements for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "Users can insert settlements for their rounds" on public.round_settlements;
create policy round_settlements_insert on public.round_settlements for insert
  with check (round_id in (select r.id from rounds r where r.owner_id = (select auth.uid())));

drop policy if exists "Users can update settlements for their rounds" on public.round_settlements;
create policy round_settlements_update on public.round_settlements for update
  using (round_id in (select r.id from rounds r where r.owner_id = (select auth.uid())));

drop policy if exists round_settlements_delete on public.round_settlements;
create policy round_settlements_delete on public.round_settlements for delete
  using (exists (select 1 from rounds r
                 where r.id = round_settlements.round_id and r.owner_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 15 · rounds (consolidate 2 SELECT → 1; initplan)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists rounds_select_own_or_member on public.rounds;
drop policy if exists rounds_select_linked_match on public.rounds;
create policy rounds_select on public.rounds for select
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from round_members rm
               where rm.round_id = rounds.id and rm.profile_id = (select auth.uid()))
    or is_linked_match_participant(id, (select auth.uid())));

drop policy if exists rounds_insert_own on public.rounds;
create policy rounds_insert_own on public.rounds for insert
  with check (owner_id = (select auth.uid()));

drop policy if exists rounds_update_admin on public.rounds;
create policy rounds_update_admin on public.rounds for update
  using (owner_id = (select auth.uid()));

drop policy if exists rounds_delete_admin on public.rounds;
create policy rounds_delete_admin on public.rounds for delete
  using (owner_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 16 · scorer_invites (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists scorer_invites_select on public.scorer_invites;
create policy scorer_invites_select on public.scorer_invites for select
  using (to_profile_id = (select auth.uid()) or from_profile_id = (select auth.uid()));

drop policy if exists scorer_invites_insert on public.scorer_invites;
create policy scorer_invites_insert on public.scorer_invites for insert
  with check (from_profile_id = (select auth.uid()));

drop policy if exists scorer_invites_update on public.scorer_invites;
create policy scorer_invites_update on public.scorer_invites for update
  using (to_profile_id = (select auth.uid()))
  with check (to_profile_id = (select auth.uid()));

drop policy if exists scorer_invites_delete on public.scorer_invites;
create policy scorer_invites_delete on public.scorer_invites for delete
  using (from_profile_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 17 · scores (consolidate 2 SELECT → 1; initplan)
-- Hot path: every score save evaluates INSERT (upsert) + UPDATE policies.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists scores_select_own_or_member on public.scores;
drop policy if exists scores_select_linked_match on public.scores;
create policy scores_select on public.scores for select
  using (
    exists (select 1 from rounds r
            where r.id = scores.round_id
              and (r.owner_id = (select auth.uid())
                   or exists (select 1 from round_members rm
                              where rm.round_id = r.id and rm.profile_id = (select auth.uid()))))
    or exists (select 1 from linked_matches lm
               where lm.status in ('pending', 'linked', 'complete')
                 and (lm.round_a_id = scores.round_id or lm.round_b_id = scores.round_id)
                 and (lm.created_by = (select auth.uid())
                      or lm.round_a_id in (select rm.round_id from round_members rm
                                           where rm.profile_id = (select auth.uid()))
                      or lm.round_b_id in (select rm.round_id from round_members rm
                                           where rm.profile_id = (select auth.uid())))));

drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores for insert
  with check (
    exists (select 1 from rounds r
            where r.id = scores.round_id and r.owner_id = (select auth.uid()))
    or exists (select 1 from round_members rm
               where rm.round_id = scores.round_id
                 and rm.profile_id = (select auth.uid())
                 and rm.role in ('admin', 'scorer', 'player')));

drop policy if exists scores_update on public.scores;
create policy scores_update on public.scores for update
  using (
    exists (select 1 from rounds r
            where r.id = scores.round_id and r.owner_id = (select auth.uid()))
    or exists (select 1 from round_members rm
               where rm.round_id = scores.round_id
                 and rm.profile_id = (select auth.uid())
                 and rm.role in ('admin', 'scorer')));

drop policy if exists scores_delete on public.scores;
create policy scores_delete on public.scores for delete
  using (exists (select 1 from rounds r
                 where r.id = scores.round_id and r.owner_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 18 · sessions (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated
  using ((select auth.uid()) = created_by);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 19 · tournaments family
-- Restructure owner_all(ALL) + member_read(SELECT) → per-command policies.
-- Owner keeps full write; members keep read. Semantics identical.
-- ────────────────────────────────────────────────────────────────────────────
-- tournaments
drop policy if exists owner_all on public.tournaments;
drop policy if exists member_read on public.tournaments;
create policy tournaments_select on public.tournaments for select
  using (owner_id = (select auth.uid())
         or id in (select tm.tournament_id from tournament_members tm
                   where tm.user_id = (select auth.uid())));
create policy tournaments_insert on public.tournaments for insert
  with check (owner_id = (select auth.uid()));
create policy tournaments_update on public.tournaments for update
  using (owner_id = (select auth.uid()));
create policy tournaments_delete on public.tournaments for delete
  using (owner_id = (select auth.uid()));

-- tournament_members
drop policy if exists owner_all on public.tournament_members;
drop policy if exists member_read on public.tournament_members;
create policy tournament_members_select on public.tournament_members for select
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy tournament_members_insert on public.tournament_members for insert
  with check (owner_id = (select auth.uid()));
create policy tournament_members_update on public.tournament_members for update
  using (owner_id = (select auth.uid()));
create policy tournament_members_delete on public.tournament_members for delete
  using (owner_id = (select auth.uid()));

-- tournament_teams
drop policy if exists owner_all on public.tournament_teams;
drop policy if exists member_read on public.tournament_teams;
create policy tournament_teams_select on public.tournament_teams for select
  using (
    exists (select 1 from tournaments t
            where t.id = tournament_teams.tournament_id and t.owner_id = (select auth.uid()))
    or exists (select 1 from tournament_members tm
               where tm.tournament_id = tournament_teams.tournament_id
                 and tm.user_id = (select auth.uid())));
create policy tournament_teams_write on public.tournament_teams for all
  using (exists (select 1 from tournaments t
                 where t.id = tournament_teams.tournament_id and t.owner_id = (select auth.uid())));

-- tournament_team_players
drop policy if exists owner_all on public.tournament_team_players;
drop policy if exists member_read on public.tournament_team_players;
create policy tournament_team_players_select on public.tournament_team_players for select
  using (
    exists (select 1 from tournament_teams tt
            join tournaments t on t.id = tt.tournament_id
            where tt.id = tournament_team_players.team_id and t.owner_id = (select auth.uid()))
    or exists (select 1 from tournament_teams tt
               join tournament_members m on m.tournament_id = tt.tournament_id
               where tt.id = tournament_team_players.team_id and m.user_id = (select auth.uid())));
create policy tournament_team_players_write on public.tournament_team_players for all
  using (exists (select 1 from tournament_teams tt
                 join tournaments t on t.id = tt.tournament_id
                 where tt.id = tournament_team_players.team_id and t.owner_id = (select auth.uid())));

-- tournament_schedule
drop policy if exists owner_all on public.tournament_schedule;
drop policy if exists member_read on public.tournament_schedule;
create policy tournament_schedule_select on public.tournament_schedule for select
  using (
    exists (select 1 from tournaments t
            where t.id = tournament_schedule.tournament_id and t.owner_id = (select auth.uid()))
    or exists (select 1 from tournament_members tm
               where tm.tournament_id = tournament_schedule.tournament_id
                 and tm.user_id = (select auth.uid())));
create policy tournament_schedule_write on public.tournament_schedule for all
  using (exists (select 1 from tournaments t
                 where t.id = tournament_schedule.tournament_id and t.owner_id = (select auth.uid())));

-- tournament_matches (owner_all + member_read_write were BOTH ALL → merge)
drop policy if exists owner_all on public.tournament_matches;
drop policy if exists member_read_write on public.tournament_matches;
create policy tournament_matches_all on public.tournament_matches for all
  using (
    exists (select 1 from tournaments t
            where t.id = tournament_matches.tournament_id and t.owner_id = (select auth.uid()))
    or exists (select 1 from tournament_members tm
               where tm.tournament_id = tournament_matches.tournament_id
                 and tm.user_id = (select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 20 · user_preferences (initplan only)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists own_prefs on public.user_preferences;
create policy own_prefs on public.user_preferences for all
  using (user_id = (select auth.uid()));
