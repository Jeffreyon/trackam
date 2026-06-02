-- Staff profile fields — mirror what riders got in 0021. Trackam users
-- (owner, staff, hub workers) need the same identity attributes as riders
-- so handovers TO them can derive name/phone/ID-hash from their session
-- instead of a freshly typed form.
--
-- Owners auto-verify at signup (handled in auth.service / bootstrapAdminData).
-- Other staff land in the verification queue and the owner approves them.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_type TEXT
    CHECK (govt_id_type IN ('nin', 'voters_card', 'passport', 'drivers_license'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_number TEXT;

-- Base64-encoded image (data URL). Same storage convention as riders.govt_id_photo.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_photo TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_verified_by TEXT
    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS govt_id_rejection_reason TEXT;

-- Phone is unique per-user (a phone can only be tied to one Trackam account)
-- but we allow NULL on legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL;

-- Pending-verification queue index — excludes the synthetic __org__ user and
-- any row that hasn't started ID submission.
CREATE INDEX IF NOT EXISTS idx_users_govt_id_pending
  ON users(id)
  WHERE govt_id_type IS NOT NULL
    AND govt_id_verified_at IS NULL
    AND id NOT LIKE '\_\_%\_\_' ESCAPE '\';

-- Backfill: any existing user with the 'owner' role is the founder. They
-- don't need to verify themselves — auto-verify them now (no ID type set
-- though, so they won't appear in the queue or count as fully-onboarded
-- until they upload one. The verified_at being set just means they don't
-- need someone else to approve them when they do.)
-- Actually safer: leave them as-is; the auth-flow logic in auth.service
-- handles auto-verification for the owner who signs up fresh.
