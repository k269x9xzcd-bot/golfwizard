-- Add per-match wager configuration to tournament_matches.
-- wagers shape: { pricePerPoint: number } | null
-- When null/zero, no money flows from this match into round settlements.
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS wagers jsonb;
