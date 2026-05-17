-- 14 Holes game: per-score KEEP/DISCARD flag.
-- Engine reads this as ctx.discards[memberId][hole]. Default KEEP (false).
-- Reversible: ALTER TABLE scores DROP COLUMN is_discarded;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS is_discarded boolean NOT NULL DEFAULT false;

-- RLS smoke test (run manually in SQL editor as the row owner before shipping
-- the store action — confirm the existing scores UPDATE policy covers the
-- new column):
--   UPDATE scores SET is_discarded = true
--   WHERE id = '<a score row you own>' RETURNING is_discarded;
