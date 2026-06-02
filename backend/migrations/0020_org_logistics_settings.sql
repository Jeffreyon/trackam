-- Org-level logistics settings for commercial instances.
-- Uses the existing logistics_settings table with a well-known user_id of
-- '__org__' so the same key-value schema works for both per-user and org-level.
-- The controller checks org settings first, then falls back to per-user.
--
-- logistics_settings.user_id has a FK to users.id, so we first insert a
-- sentinel "org" user row to anchor the org-level settings. This row is not
-- a real account — it has no email, no password, and no roles. It exists
-- purely so the FK is satisfied. Authentication paths filter on email IS NOT
-- NULL elsewhere, so this row can never log in.

INSERT INTO users (id, email, display_name, roles, email_verified, created_at, updated_at)
VALUES (
  '__org__',
  NULL,
  'Organisation (system)',
  ARRAY[]::TEXT[],
  FALSE,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO logistics_settings (user_id, key, value)
VALUES
  ('__org__', 'fuel_price_per_litre', '950'),
  ('__org__', 'fuel_efficiency_multiplier', '0.12'),
  ('__org__', 'ghost_threshold_hours', '48'),
  ('__org__', 'business_name', ''),
  ('__org__', 'business_city', ''),
  ('__org__', 'country', 'ng')
ON CONFLICT (user_id, key) DO NOTHING;
