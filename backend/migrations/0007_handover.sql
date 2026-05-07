-- OLI Phase 1: handover tokens, events, lite waybills + BVN on riders + handed_over status

-- Add BVN to riders
ALTER TABLE riders ADD COLUMN IF NOT EXISTS bvn TEXT;

-- Migrate legacy 'recovered' rows (from pre-OLI recovery flow) back to 'in_transit'
UPDATE shipments SET status = 'in_transit', updated_at = NOW() WHERE status = 'recovered';

-- Expand shipments status CHECK to include handed_over
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed', 'ghosted', 'handed_over'));

-- Tokens generated when a custody giver initiates a handover
CREATE TABLE IF NOT EXISTS handover_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  actor_type  TEXT NOT NULL DEFAULT 'ACTOR_COURIER'
                CHECK (actor_type IN ('ACTOR_SENDER','ACTOR_COURIER','ACTOR_HUB','ACTOR_RECEIVER')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable custody transfer events (the PoH record)
CREATE TABLE IF NOT EXISTS handover_events (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shipment_id          TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  token_id             TEXT REFERENCES handover_tokens(id),
  giver_user_id        TEXT REFERENCES users(id),
  giver_actor_type     TEXT NOT NULL,
  receiver_name        TEXT NOT NULL,
  receiver_bvn         TEXT NOT NULL,
  receiver_phone       TEXT,
  receiver_actor_type  TEXT NOT NULL
                         CHECK (receiver_actor_type IN ('ACTOR_SENDER','ACTOR_COURIER','ACTOR_HUB','ACTOR_RECEIVER')),
  proof_hash           TEXT NOT NULL,
  latitude             NUMERIC,
  longitude            NUMERIC,
  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lite waybills created by external (non-app) users via the public generator
CREATE TABLE IF NOT EXISTS lite_waybills (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  waybill_number      TEXT NOT NULL UNIQUE,
  sender_name         TEXT NOT NULL,
  sender_phone        TEXT NOT NULL,
  receiver_name       TEXT NOT NULL,
  receiver_phone      TEXT NOT NULL,
  receiver_address    TEXT NOT NULL,
  goods_description   TEXT NOT NULL,
  pickup_location     TEXT NOT NULL,
  delivery_location   TEXT NOT NULL,
  estimated_weight_kg NUMERIC,
  declared_value_ngn  NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_tokens_token       ON handover_tokens(token);
CREATE INDEX IF NOT EXISTS idx_handover_tokens_shipment_id ON handover_tokens(shipment_id);
CREATE INDEX IF NOT EXISTS idx_handover_events_shipment_id ON handover_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_lite_waybills_number        ON lite_waybills(waybill_number);
