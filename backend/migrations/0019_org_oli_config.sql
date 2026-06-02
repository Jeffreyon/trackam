-- Org-level OLI Switch configuration.
-- In the commercial model the logistics founder registers ONE operator on OLI
-- Switch and all staff on the Trackam instance share that identity. This
-- replaces per-user oli_accounts as the primary API key source.
--
-- Singleton table (id = 'default'). The super_admin role controls access.

CREATE TABLE IF NOT EXISTS org_oli_config (
  id               TEXT        PRIMARY KEY DEFAULT 'default',
  oli_operator_id  TEXT,
  oli_api_key      TEXT,
  oli_status       TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (oli_status IN ('pending', 'active')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the super_admin role — full org control for the logistics founder
INSERT INTO roles (id, description, permissions)
VALUES ('super_admin', 'Logistics company founder — full org control', ARRAY['*'])
ON CONFLICT (id) DO NOTHING;

-- Migrate: if an existing oli_accounts row has an active key, copy it to the
-- org-level config so existing deployments don't break.
INSERT INTO org_oli_config (id, oli_operator_id, oli_api_key, oli_status)
SELECT 'default', oli_operator_id, oli_api_key, oli_status
FROM oli_accounts
WHERE oli_api_key IS NOT NULL AND oli_status = 'active'
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (id) DO NOTHING;
