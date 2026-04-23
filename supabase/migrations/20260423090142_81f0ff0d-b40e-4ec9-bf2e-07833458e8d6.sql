-- Allow clients to check if they have an active accountant assignment
CREATE POLICY "Clients can view their own accountant assignment"
  ON accountant_clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = accountant_clients.client_id
        AND c.user_id = auth.uid()
    )
  );

-- Also ensure admins and accountants can still manage accountant_clients
-- (these may already exist, use IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accountant_clients' 
    AND policyname = 'Admins can manage accountant_clients'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can manage accountant_clients"
        ON accountant_clients FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    $policy$;
  END IF;
END $$;