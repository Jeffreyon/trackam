-- Simplify run assignment: move from dispatch_run_legs junction table
-- to a direct run_id FK on shipments.
--
-- Rationale: a shipment belongs to at most one run (the junction table
-- already had UNIQUE(shipment_id)), so a many-to-one FK is cleaner.
-- This removes the join table and makes every query simpler.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES dispatch_runs(id) ON DELETE SET NULL;

-- Migrate existing assignments
UPDATE shipments s
   SET run_id = drl.run_id
  FROM dispatch_run_legs drl
 WHERE drl.shipment_id = s.id;

DROP TABLE IF EXISTS dispatch_run_legs;

CREATE INDEX IF NOT EXISTS idx_shipments_run_id ON shipments(run_id);
