-- 0. Deduplicate existing billing_log rows (keep newest per entity_type/entity_id/billing_period)
DELETE FROM billing_log a
USING billing_log b
WHERE a.entity_type = b.entity_type
  AND a.entity_id = b.entity_id
  AND a.billing_period = b.billing_period
  AND a.created_at < b.created_at;

-- In case of identical created_at duplicates, keep the lowest id
DELETE FROM billing_log a
USING billing_log b
WHERE a.entity_type = b.entity_type
  AND a.entity_id = b.entity_id
  AND a.billing_period = b.billing_period
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- 1. Extend entity_type CHECK
ALTER TABLE billing_log DROP CONSTRAINT IF EXISTS billing_log_entity_type_check;
ALTER TABLE billing_log
  ADD CONSTRAINT billing_log_entity_type_check
  CHECK (entity_type IN ('accountant', 'client_direct', 'client_managed'));

-- 2. Extend payment_method CHECK
ALTER TABLE billing_log DROP CONSTRAINT IF EXISTS billing_log_payment_method_check;
ALTER TABLE billing_log
  ADD CONSTRAINT billing_log_payment_method_check
  CHECK (payment_method IN ('internal','external','free','auto') OR payment_method IS NULL);

-- 3. Add payment gateway support columns
ALTER TABLE billing_log
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- 4. Unique constraint to prevent duplicates
ALTER TABLE billing_log DROP CONSTRAINT IF EXISTS billing_log_unique_period;
ALTER TABLE billing_log
  ADD CONSTRAINT billing_log_unique_period
  UNIQUE (entity_type, entity_id, billing_period);