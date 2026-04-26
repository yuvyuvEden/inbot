DROP POLICY IF EXISTS "Accountants can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can update invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants view their clients invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants update their clients invoices" ON invoices;

CREATE POLICY "Accountants view their clients invoices"
  ON invoices FOR SELECT
  USING (
    has_role(auth.uid(), 'accountant'::app_role)
    AND EXISTS (
      SELECT 1 FROM accountant_clients ac
      JOIN accountants a ON a.id = ac.accountant_id
      WHERE ac.client_id = invoices.client_id
        AND a.user_id = auth.uid()
        AND ac.unassigned_at IS NULL
    )
  );

CREATE POLICY "Accountants update their clients invoices"
  ON invoices FOR UPDATE
  USING (
    has_role(auth.uid(), 'accountant'::app_role)
    AND EXISTS (
      SELECT 1 FROM accountant_clients ac
      JOIN accountants a ON a.id = ac.accountant_id
      WHERE ac.client_id = invoices.client_id
        AND a.user_id = auth.uid()
        AND ac.unassigned_at IS NULL
    )
  );