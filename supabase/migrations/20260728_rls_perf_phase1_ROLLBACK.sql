-- ============================================================================
-- ROLLBACK for 20260728_rls_perf_phase1.sql
-- Restores the exact pre-migration policy set (captured from live pg_policies
-- on 2026-07-28 before applying). Run only if the migration causes RLS
-- regressions.
--
-- NOTE: The 20 FK indexes are intentionally KEPT on rollback — they are
-- semantically inert and purely beneficial.
-- NOTE: Restoring "service role can write ghin cache" re-opens the public
-- write hole on ghin_index_cache. It is restored here for fidelity; delete
-- that block if you roll back for unrelated reasons.
-- ============================================================================

-- ── courses ──
drop policy if exists courses_select_public on public.courses;
create policy courses_select_public on public.courses for select
  using ((is_public = true) or (owner_id = auth.uid()));
drop policy if exists courses_insert_own on public.courses;
create policy courses_insert_own on public.courses for insert
  with check (owner_id = auth.uid());
drop policy if exists courses_update_own on public.courses;
create policy courses_update_own on public.courses for update
  using (owner_id = auth.uid());
drop policy if exists courses_delete_own on public.courses;
create policy courses_delete_own on public.courses for delete
  using (owner_id = auth.uid());

-- ── feedback ──
drop policy if exists "authenticated users can submit feedback" on public.feedback;
create policy "authenticated users can submit feedback" on public.feedback
  for insert to authenticated
  with check ((auth.uid() = user_id) or (user_id is null));
drop policy if exists "users can view own feedback" on public.feedback;
create policy "users can view own feedback" on public.feedback
  for select to authenticated
  using (auth.uid() = user_id);

-- ── game_configs ──
drop policy if exists game_configs_select_own_or_member on public.game_configs;
create policy game_configs_select_own_or_member on public.game_configs for select
  using (exists (select 1 from rounds r
    where r.id = game_configs.round_id
      and (r.owner_id = auth.uid()
           or exists (select 1 from round_members rm
                      where rm.round_id = r.id and rm.profile_id = auth.uid()))));
drop policy if exists game_configs_insert on public.game_configs;
create policy game_configs_insert on public.game_configs for insert
  with check (exists (select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = auth.uid()));
drop policy if exists game_configs_update on public.game_configs;
create policy game_configs_update on public.game_configs for update
  using (exists (select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = auth.uid()));
drop policy if exists game_configs_delete on public.game_configs;
create policy game_configs_delete on public.game_configs for delete
  using (exists (select 1 from rounds r
    where r.id = game_configs.round_id and r.owner_id = auth.uid()));

-- ── ghin_index_cache (restores public-write hole — see header note) ──
drop policy if exists "service role can write ghin cache" on public.ghin_index_cache;
create policy "service role can write ghin cache" on public.ghin_index_cache
  for all using (true);

-- ── bb_member_index ──
drop policy if exists bb_member_index_read on public.bb_member_index;
alter table public.bb_member_index disable row level security;

-- ── ledger_entries ──
drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select on public.ledger_entries for select
  using (auth.role() = 'authenticated');
drop policy if exists ledger_entries_insert on public.ledger_entries;
create policy ledger_entries_insert on public.ledger_entries for insert
  with check (auth.role() = 'authenticated');
drop policy if exists ledger_entries_delete on public.ledger_entries;
create policy ledger_entries_delete on public.ledger_entries for delete
  using (exists (select 1 from rounds r
    where r.id = ledger_entries.round_id and r.owner_id = auth.uid()));

-- ── linked_matches ──
drop policy if exists linked_matches_select on public.linked_matches;
create policy linked_matches_select_participant on public.linked_matches for select
  using (created_by = auth.uid()
    or exists (select 1 from rounds r
               where r.id = any (array[linked_matches.round_a_id, linked_matches.round_b_id])
                 and r.owner_id = auth.uid())
    or exists (select 1 from round_members rm
               where rm.round_id = any (array[linked_matches.round_a_id, linked_matches.round_b_id])
                 and rm.profile_id = auth.uid()));
create policy linked_matches_select_pending on public.linked_matches for select
  using (status = 'pending' and auth.role() = 'authenticated');
drop policy if exists linked_matches_insert_own on public.linked_matches;
create policy linked_matches_insert_own on public.linked_matches for insert
  with check (created_by = auth.uid());
drop policy if exists linked_matches_update_participant on public.linked_matches;
create policy linked_matches_update_participant on public.linked_matches for update
  using (created_by = auth.uid()
    or exists (select 1 from rounds r
               where r.id = linked_matches.round_a_id and r.owner_id = auth.uid())
    or (round_b_id is not null
        and exists (select 1 from rounds r
                    where r.id = linked_matches.round_b_id and r.owner_id = auth.uid()))
    or (round_b_id is null and auth.role() = 'authenticated'));
drop policy if exists linked_matches_delete_creator on public.linked_matches;
create policy linked_matches_delete_creator on public.linked_matches for delete
  using (created_by = auth.uid());

-- ── pending_challenges ──
drop policy if exists pending_challenges_select on public.pending_challenges;
drop policy if exists pending_challenges_insert on public.pending_challenges;
drop policy if exists pending_challenges_update on public.pending_challenges;
drop policy if exists pending_challenges_delete on public.pending_challenges;
create policy challenger_all on public.pending_challenges for all
  using (auth.uid() = challenger_id);
create policy challenged_read on public.pending_challenges for select
  using (auth.uid() = challenged_user_id);
create policy challenged_update on public.pending_challenges for update
  using (auth.uid() = challenged_user_id);

-- ── profiles ──
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id);

-- ── roster_players ──
drop policy if exists roster_players_select on public.roster_players;
drop policy if exists roster_players_insert on public.roster_players;
drop policy if exists roster_players_update on public.roster_players;
drop policy if exists roster_players_delete on public.roster_players;
create policy roster_select on public.roster_players for select
  using (owner_id = auth.uid());
create policy roster_select_by_email on public.roster_players for select
  using (email is not null and lower(email) = lower(auth.jwt() ->> 'email'));
create policy roster_select_own_user_id on public.roster_players for select
  using (user_id = auth.uid());
create policy roster_select_linked_match_host on public.roster_players for select
  using (is_favorite = true and owner_id in (
    select r.owner_id from rounds r
    join linked_matches lm on lm.round_a_id = r.id
    where lm.status in ('pending', 'linked')
      and lm.round_b_id in (select rm.round_id from round_members rm
                            where rm.profile_id = auth.uid())));
create policy roster_insert on public.roster_players for insert
  with check (owner_id = auth.uid());
create policy roster_update on public.roster_players for update
  using (owner_id = auth.uid());
create policy roster_update_self_link on public.roster_players for update
  using (email is not null and user_id is null
         and lower(email) = lower(auth.jwt() ->> 'email'))
  with check (user_id = auth.uid());
create policy roster_delete on public.roster_players for delete
  using (owner_id = auth.uid());

-- ── roster_shares ──
drop policy if exists roster_shares_select on public.roster_shares;
drop policy if exists roster_shares_update on public.roster_shares;
create policy roster_shares_select_sender on public.roster_shares for select
  using (sender_id = auth.uid());
create policy roster_shares_select_recipient on public.roster_shares for select
  using (recipient_id = auth.uid()
         or (recipient_id is null and lower(recipient_email) = lower(auth.jwt() ->> 'email')));
drop policy if exists roster_shares_insert on public.roster_shares;
create policy roster_shares_insert on public.roster_shares for insert
  with check (sender_id = auth.uid());
create policy roster_shares_claim on public.roster_shares for update
  using (recipient_id is null and lower(recipient_email) = lower(auth.jwt() ->> 'email'))
  with check (recipient_id = auth.uid());
create policy roster_shares_update_claimed on public.roster_shares for update
  using (recipient_id = auth.uid());

-- ── round_members ──
drop policy if exists round_members_select on public.round_members;
create policy round_members_select_own_or_member on public.round_members for select
  using (is_round_owner(round_id, auth.uid()) or is_round_member(round_id, auth.uid()));
create policy round_members_select_linked_match on public.round_members for select
  using (is_round_member_via_linked_match(round_id, auth.uid()));
drop policy if exists round_members_insert on public.round_members;
create policy round_members_insert on public.round_members for insert
  with check (is_round_owner(round_id, auth.uid()) or profile_id = auth.uid());
drop policy if exists round_members_update on public.round_members;
create policy round_members_update on public.round_members for update
  using (profile_id = auth.uid()
         or exists (select 1 from rounds r
                    where r.id = round_members.round_id and r.owner_id = auth.uid()));
drop policy if exists round_members_delete on public.round_members;
create policy round_members_delete on public.round_members for delete
  using (exists (select 1 from rounds r
                 where r.id = round_members.round_id and r.owner_id = auth.uid())
         or profile_id = auth.uid());

-- ── round_settlements ──
drop policy if exists round_settlements_select on public.round_settlements;
create policy round_settlements_select on public.round_settlements for select
  using (auth.role() = 'authenticated');
drop policy if exists round_settlements_insert on public.round_settlements;
create policy "Users can insert settlements for their rounds" on public.round_settlements for insert
  with check (round_id in (select r.id from rounds r where r.owner_id = auth.uid()));
drop policy if exists round_settlements_update on public.round_settlements;
create policy "Users can update settlements for their rounds" on public.round_settlements for update
  using (round_id in (select r.id from rounds r where r.owner_id = auth.uid()));
drop policy if exists round_settlements_delete on public.round_settlements;
create policy round_settlements_delete on public.round_settlements for delete
  using (exists (select 1 from rounds r
                 where r.id = round_settlements.round_id and r.owner_id = auth.uid()));

-- ── rounds ──
drop policy if exists rounds_select on public.rounds;
create policy rounds_select_own_or_member on public.rounds for select
  using (owner_id = auth.uid()
         or exists (select 1 from round_members rm
                    where rm.round_id = rounds.id and rm.profile_id = auth.uid()));
create policy rounds_select_linked_match on public.rounds for select
  using (is_linked_match_participant(id, auth.uid()));
drop policy if exists rounds_insert_own on public.rounds;
create policy rounds_insert_own on public.rounds for insert
  with check (owner_id = auth.uid());
drop policy if exists rounds_update_admin on public.rounds;
create policy rounds_update_admin on public.rounds for update
  using (owner_id = auth.uid());
drop policy if exists rounds_delete_admin on public.rounds;
create policy rounds_delete_admin on public.rounds for delete
  using (owner_id = auth.uid());

-- ── scorer_invites ──
drop policy if exists scorer_invites_select on public.scorer_invites;
create policy scorer_invites_select on public.scorer_invites for select
  using (to_profile_id = auth.uid() or from_profile_id = auth.uid());
drop policy if exists scorer_invites_insert on public.scorer_invites;
create policy scorer_invites_insert on public.scorer_invites for insert
  with check (from_profile_id = auth.uid());
drop policy if exists scorer_invites_update on public.scorer_invites;
create policy scorer_invites_update on public.scorer_invites for update
  using (to_profile_id = auth.uid())
  with check (to_profile_id = auth.uid());
drop policy if exists scorer_invites_delete on public.scorer_invites;
create policy scorer_invites_delete on public.scorer_invites for delete
  using (from_profile_id = auth.uid());

-- ── scores ──
drop policy if exists scores_select on public.scores;
create policy scores_select_own_or_member on public.scores for select
  using (exists (select 1 from rounds r
    where r.id = scores.round_id
      and (r.owner_id = auth.uid()
           or exists (select 1 from round_members rm
                      where rm.round_id = r.id and rm.profile_id = auth.uid()))));
create policy scores_select_linked_match on public.scores for select
  using (exists (select 1 from linked_matches lm
    where lm.status in ('pending', 'linked', 'complete')
      and (lm.round_a_id = scores.round_id or lm.round_b_id = scores.round_id)
      and (lm.created_by = auth.uid()
           or lm.round_a_id in (select rm.round_id from round_members rm
                                where rm.profile_id = auth.uid())
           or lm.round_b_id in (select rm.round_id from round_members rm
                                where rm.profile_id = auth.uid()))));
drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores for insert
  with check (exists (select 1 from rounds r
                      where r.id = scores.round_id and r.owner_id = auth.uid())
              or exists (select 1 from round_members rm
                         where rm.round_id = scores.round_id
                           and rm.profile_id = auth.uid()
                           and rm.role in ('admin', 'scorer', 'player')));
drop policy if exists scores_update on public.scores;
create policy scores_update on public.scores for update
  using (exists (select 1 from rounds r
                 where r.id = scores.round_id and r.owner_id = auth.uid())
         or exists (select 1 from round_members rm
                    where rm.round_id = scores.round_id
                      and rm.profile_id = auth.uid()
                      and rm.role in ('admin', 'scorer')));
drop policy if exists scores_delete on public.scores;
create policy scores_delete on public.scores for delete
  using (exists (select 1 from rounds r
                 where r.id = scores.round_id and r.owner_id = auth.uid()));

-- ── sessions ──
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated
  with check (auth.uid() = created_by);
drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated
  using (auth.uid() = created_by);

-- ── tournaments family ──
drop policy if exists tournaments_select on public.tournaments;
drop policy if exists tournaments_insert on public.tournaments;
drop policy if exists tournaments_update on public.tournaments;
drop policy if exists tournaments_delete on public.tournaments;
create policy owner_all on public.tournaments for all
  using (owner_id = auth.uid());
create policy member_read on public.tournaments for select
  using (id in (select tournament_members.tournament_id from tournament_members
                where tournament_members.user_id = auth.uid()));

drop policy if exists tournament_members_select on public.tournament_members;
drop policy if exists tournament_members_insert on public.tournament_members;
drop policy if exists tournament_members_update on public.tournament_members;
drop policy if exists tournament_members_delete on public.tournament_members;
create policy owner_all on public.tournament_members for all
  using (owner_id = auth.uid());
create policy member_read on public.tournament_members for select
  using (user_id = auth.uid());

drop policy if exists tournament_teams_select on public.tournament_teams;
drop policy if exists tournament_teams_write on public.tournament_teams;
create policy owner_all on public.tournament_teams for all
  using (exists (select 1 from tournaments
                 where tournaments.id = tournament_teams.tournament_id
                   and tournaments.owner_id = auth.uid()));
create policy member_read on public.tournament_teams for select
  using (exists (select 1 from tournament_members
                 where tournament_members.tournament_id = tournament_teams.tournament_id
                   and tournament_members.user_id = auth.uid()));

drop policy if exists tournament_team_players_select on public.tournament_team_players;
drop policy if exists tournament_team_players_write on public.tournament_team_players;
create policy owner_all on public.tournament_team_players for all
  using (exists (select 1 from tournament_teams tt
                 join tournaments t on t.id = tt.tournament_id
                 where tt.id = tournament_team_players.team_id and t.owner_id = auth.uid()));
create policy member_read on public.tournament_team_players for select
  using (exists (select 1 from tournament_teams tt
                 join tournament_members m on m.tournament_id = tt.tournament_id
                 where tt.id = tournament_team_players.team_id and m.user_id = auth.uid()));

drop policy if exists tournament_schedule_select on public.tournament_schedule;
drop policy if exists tournament_schedule_write on public.tournament_schedule;
create policy owner_all on public.tournament_schedule for all
  using (exists (select 1 from tournaments
                 where tournaments.id = tournament_schedule.tournament_id
                   and tournaments.owner_id = auth.uid()));
create policy member_read on public.tournament_schedule for select
  using (exists (select 1 from tournament_members
                 where tournament_members.tournament_id = tournament_schedule.tournament_id
                   and tournament_members.user_id = auth.uid()));

drop policy if exists tournament_matches_all on public.tournament_matches;
create policy owner_all on public.tournament_matches for all
  using (exists (select 1 from tournaments
                 where tournaments.id = tournament_matches.tournament_id
                   and tournaments.owner_id = auth.uid()));
create policy member_read_write on public.tournament_matches for all
  using (exists (select 1 from tournament_members
                 where tournament_members.tournament_id = tournament_matches.tournament_id
                   and tournament_members.user_id = auth.uid()));

-- ── user_preferences ──
drop policy if exists own_prefs on public.user_preferences;
create policy own_prefs on public.user_preferences for all
  using (user_id = auth.uid());
