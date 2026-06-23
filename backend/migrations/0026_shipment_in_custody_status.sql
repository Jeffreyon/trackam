-- Add 'in_custody' to shipments status check.
-- Used when a receiving operator mirrors a join-leg shipment locally before
-- they re-dispatch it. Was present in service-layer validation but missing
-- from the DB constraint, causing mirror inserts to fail with a check violation.
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN (
    'pending', 'in_custody', 'in_transit', 'delivered', 'failed',
    'ghosted', 'handed_over', 'disputed'
  ));
