-- Adds per-player tee selection to round_members, for the multi-tee-per-player
-- feature (scoped 2026-08-15, sent to Jason as multi_tee_scoping.md).
--
-- Purely additive: nullable text column, no default, no backfill, no RLS
-- policy change needed (existing round_members policies don't reference
-- specific columns). Existing rows get tee = null, which every gameEngine.js
-- consumer already resolves as "use the round's default tee" via
-- memberTee(member, ctx.tee) — zero behavior change for any round that
-- doesn't set it.
--
-- Resolution order used throughout the app: member.tee ?? round.tee ?? course.defaultTee

alter table round_members add column if not exists tee text null;
