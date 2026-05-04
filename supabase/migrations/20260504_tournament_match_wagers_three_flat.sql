-- Tournament wagers v2 — three independent flat-dollar fields per matchup.
--
-- Old shape: { pricePerPoint: N } (single $/point that multiplied team-BB by 2 and singles by 1)
-- New shape: { bb: N, s1: N, s2: N } where each component is a standalone bet (tie = $0)
--
-- Migration policy: zero out unknown fields and default missing to 0. Existing rounds
-- should not suddenly inherit a wager that wasn't explicitly chosen for the new shape.
UPDATE public.tournament_matches
SET wagers = jsonb_build_object('bb', 0, 's1', 0, 's2', 0)
WHERE wagers IS NOT NULL
  AND NOT (wagers ? 'bb' AND wagers ? 's1' AND wagers ? 's2');
