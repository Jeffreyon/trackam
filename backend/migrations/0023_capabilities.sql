-- Org-level marketplace capabilities.
-- 'carry' = carrier (logistics operator), 'buy' = buyer (ships goods via the network).
-- Existing users default to 'carry' since all current accounts are logistics operators.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{carry}';
