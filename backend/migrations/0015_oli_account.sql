-- Tracks the OLI Switch operator account provisioned during Trackam signup.
-- One record per user. oli_api_key is null until the operator enters it after approval.
CREATE TABLE IF NOT EXISTS oli_accounts (
  user_id         UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  oli_operator_id UUID,
  oli_status      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (oli_status IN ('pending', 'active')),
  oli_api_key     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
