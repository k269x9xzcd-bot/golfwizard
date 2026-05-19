-- scorer_invites: captain invites a GolfWizard user to score their active round
CREATE TABLE IF NOT EXISTS scorer_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  from_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name     text NOT NULL,
  to_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_code     text NOT NULL,
  round_name    text,
  course_name   text,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scorer_invites ENABLE ROW LEVEL SECURITY;

-- Captain can create invites for their rounds
CREATE POLICY "scorer_invites_insert" ON scorer_invites
  FOR INSERT WITH CHECK (from_profile_id = auth.uid());

-- Sender and recipient can read
CREATE POLICY "scorer_invites_select" ON scorer_invites
  FOR SELECT USING (to_profile_id = auth.uid() OR from_profile_id = auth.uid());

-- Recipient can accept/decline; sender can delete stale invites
CREATE POLICY "scorer_invites_update" ON scorer_invites
  FOR UPDATE USING (to_profile_id = auth.uid())
  WITH CHECK (to_profile_id = auth.uid());

CREATE POLICY "scorer_invites_delete" ON scorer_invites
  FOR DELETE USING (from_profile_id = auth.uid());

-- Auto-expire invites older than 4 hours (cleaned up on read, not cron)
CREATE INDEX IF NOT EXISTS scorer_invites_to_profile_idx ON scorer_invites (to_profile_id, status, created_at);
