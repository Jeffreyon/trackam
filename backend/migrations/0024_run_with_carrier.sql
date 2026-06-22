-- Add with_carrier status and canonical route columns to dispatch_runs

ALTER TABLE dispatch_runs
  DROP CONSTRAINT IF EXISTS dispatch_runs_status_check;

ALTER TABLE dispatch_runs
  ADD CONSTRAINT dispatch_runs_status_check
    CHECK (status IN ('loading','in_transit','with_carrier','completed','cancelled'));

ALTER TABLE dispatch_runs
  ADD COLUMN IF NOT EXISTS origin_city TEXT,
  ADD COLUMN IF NOT EXISTS dest_city   TEXT;
