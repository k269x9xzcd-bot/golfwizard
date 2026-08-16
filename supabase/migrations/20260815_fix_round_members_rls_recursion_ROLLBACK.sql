-- Rollback for 20260815_fix_round_members_rls_recursion.sql
-- Restores the original (recursion-prone) raw-EXISTS policies exactly as
-- they were before the fix, in case the fix needs to be reverted.

begin;

drop policy if exists round_members_update on round_members;
create policy round_members_update on round_members for update
using (
  (profile_id = (select auth.uid()))
  or (exists (select 1 from rounds r where r.id = round_members.round_id and r.owner_id = (select auth.uid())))
);

drop policy if exists round_members_delete on round_members;
create policy round_members_delete on round_members for delete
using (
  (profile_id = (select auth.uid()))
  or (exists (select 1 from rounds r where r.id = round_members.round_id and r.owner_id = (select auth.uid())))
);

commit;
