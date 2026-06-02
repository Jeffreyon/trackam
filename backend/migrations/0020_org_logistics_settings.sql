-- Org-level logistics settings for commercial instances.
-- Uses the existing logistics_settings table with a well-known user_id of
-- '__org__' so the same key-value schema works for both per-user and org-level.
-- The controller checks org settings first, then falls back to per-user.

INSERT INTO logistics_settings (user_id, key, value)
VALUES
  ('__org__', 'fuel_price_per_litre', '950'),
  ('__org__', 'fuel_efficiency_multiplier', '0.12'),
  ('__org__', 'ghost_threshold_hours', '48'),
  ('__org__', 'business_name', ''),
  ('__org__', 'business_city', ''),
  ('__org__', 'country', 'ng')
ON CONFLICT (user_id, key) DO NOTHING;
