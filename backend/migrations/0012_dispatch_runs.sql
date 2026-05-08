-- Dispatch runs: groups multiple waybill legs (shipments) onto one vehicle trip
CREATE TABLE IF NOT EXISTS dispatch_runs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  name        TEXT,
  rider_id    TEXT        REFERENCES riders(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'loading'
                CHECK (status IN ('loading','in_transit','completed','cancelled')),
  notes       TEXT,
  departed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: which shipment legs belong to a run
-- A shipment leg can only be in one run at a time (UNIQUE on shipment_id)
CREATE TABLE IF NOT EXISTS dispatch_run_legs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID        NOT NULL REFERENCES dispatch_runs(id) ON DELETE CASCADE,
  shipment_id TEXT        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (run_id, shipment_id),
  UNIQUE (shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_runs_user_id ON dispatch_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_run_legs_run_id ON dispatch_run_legs(run_id);
