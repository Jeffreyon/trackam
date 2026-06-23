-- Allow operators to archive waybills from their mine list view
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
