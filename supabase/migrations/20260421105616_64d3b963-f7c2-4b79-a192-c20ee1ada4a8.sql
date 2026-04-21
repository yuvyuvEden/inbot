-- 1. Add deleted_at to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Partial index
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted
  ON invoices(client_id, invoice_date DESC)
  WHERE deleted_at IS NULL;

-- 3. Update existing RLS policies to exclude soft-deleted rows
DROP POLICY IF EXISTS "Clients view own invoices" ON invoices;
CREATE POLICY "Clients view own invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = invoices.client_id AND c.user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Accountants view their clients invoices" ON invoices;
CREATE POLICY "Accountants view their clients invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
    )
    AND EXISTS (
      SELECT 1 FROM accountant_clients ac
      JOIN accountants a ON a.id = ac.accountant_id
      WHERE ac.client_id = invoices.client_id
        AND a.user_id = auth.uid()
        AND ac.unassigned_at IS NULL
    )
    AND deleted_at IS NULL
  );