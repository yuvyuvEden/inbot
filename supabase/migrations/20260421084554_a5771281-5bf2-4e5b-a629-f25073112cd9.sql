ALTER TABLE accountants
  ADD COLUMN IF NOT EXISTS base_client_count INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS billing_day INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS free_months INTEGER NOT NULL DEFAULT 1;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billing_day INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_months INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS billing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('accountant', 'client')),
  entity_id UUID NOT NULL,
  billing_period TEXT NOT NULL,
  billing_day INTEGER,
  base_count INTEGER,
  extra_count INTEGER,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  extra_amount NUMERIC NOT NULL DEFAULT 0,
  total_before_vat NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_with_vat NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','waived')),
  payment_method TEXT
    CHECK (payment_method IN ('internal','external','free') OR payment_method IS NULL),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_log_entity
  ON billing_log(entity_type, entity_id, billing_period DESC);

CREATE INDEX IF NOT EXISTS idx_billing_log_status
  ON billing_log(status, billing_period DESC);

ALTER TABLE billing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_billing ON billing_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );