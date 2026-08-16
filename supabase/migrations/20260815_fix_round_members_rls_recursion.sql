-- Fix: "infinite recursion detected in policy for relation round_members" (42P17)
-- on any UPDATE/DELETE ... RETURNING against round_members (which is what
-- supabase-js .update().select() / .delete().select() send as PATCH/DELETE ...&select=*).
--
-- Root cause (confirmed via dry-run repro against prod on 2026-08-15, in
-- rolled-back transactions — no prod data was touched before this migration):
--
--   round_members_update / round_members_delete have a RAW (not wrapped in a
--   SECURITY DEFINER function) `EXISTS (SELECT 1 FROM rounds r WHERE
--   r.id = round_members.round_id AND r.owner_id = auth.uid())` clause.
--
--   rounds_select ALSO has a RAW `EXISTS (SELECT 1 FROM round_members rm
--   WHERE rm.round_id = rounds.id AND rm.profile_id = auth.uid())` clause.
--
-- Postgres's RLS query REWRITER expands raw (unwrapped) table references
-- inside a policy's USING/WITH CHECK expression at rewrite time, before any
-- runtime short-circuit evaluation happens. Because BOTH of the above are raw
-- references (not hidden behind an opaque function-call boundary), rewriting
-- round_members's UPDATE/DELETE policy pulls in rounds_select, which pulls
-- round_members's policies back in — a second, structural re-entry into
-- round_members while its own policy is still being expanded for the SAME
-- statement. Postgres's recursion guard rejects this outright, regardless of
-- SECURITY DEFINER/BYPASSRLS on any function involved — the guard fires
-- during expansion, before role-based bypass is even relevant.
--
-- (An earlier theory — that this was caused by SQL-language SECURITY DEFINER
-- helper functions getting inlined by the planner, defeating their RLS
-- bypass — was tested and DISPROVEN: converting is_round_member/is_round_owner/
-- is_round_member_via_linked_match to plpgsql did NOT fix it. The helper
-- functions were never the problem; they're opaque to the rewriter either way.
-- The raw inline EXISTS clauses were the actual problem.)
--
-- Fix: route round_members_update/delete's ownership check through the
-- existing is_round_owner() SECURITY DEFINER function instead of a raw
-- EXISTS. Function calls are opaque to the RLS rewriter (it only expands
-- direct table references appearing in the policy expression itself), so
-- this breaks the cycle without touching rounds_select or any other table's
-- policies — smaller blast radius than fixing the rounds side.
--
-- game_configs, scores, linked_matches, and roster_players also have raw
-- EXISTS references into round_members, but none of them close a loop back
-- to themselves (they only reach round_members once via rounds, and
-- round_members's SELECT/INSERT policies are already all function calls —
-- opaque, no further expansion) — confirmed via dry-run, no changes needed
-- there.

begin;

drop policy if exists round_members_update on round_members;
create policy round_members_update on round_members for update
using (
  profile_id = (select auth.uid())
  or is_round_owner(round_id, (select auth.uid()))
);

drop policy if exists round_members_delete on round_members;
create policy round_members_delete on round_members for delete
using (
  profile_id = (select auth.uid())
  or is_round_owner(round_id, (select auth.uid()))
);

commit;
