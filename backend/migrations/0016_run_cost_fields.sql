-- Add cost tracking, delivery date, and flagging columns to dispatch_runs.
-- These fields were previously on shipments but belong at the run level
-- now that waybill-claimed shipments always get zero costs.

ALTER TABLE dispatch_runs ADD COLUMN distance_km INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dispatch_runs ADD COLUMN rider_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dispatch_runs ADD COLUMN fuel_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dispatch_runs ADD COLUMN total_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dispatch_runs ADD COLUMN expected_delivery_date DATE;
ALTER TABLE dispatch_runs ADD COLUMN delay_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dispatch_runs ADD COLUMN ghosting_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dispatch_runs ADD COLUMN last_status_update_at TIMESTAMPTZ;
