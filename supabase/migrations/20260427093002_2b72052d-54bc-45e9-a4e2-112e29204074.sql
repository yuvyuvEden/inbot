DROP POLICY IF EXISTS "accountant_can_update_is_read" ON public.invoice_comments;

CREATE POLICY "accountant_can_update_is_read"
  ON public.invoice_comments FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'accountant'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.accountant_clients ac ON ac.client_id = i.client_id
      JOIN public.accountants a ON a.id = ac.accountant_id
      WHERE i.id = invoice_comments.invoice_id
        AND a.user_id = auth.uid()
        AND ac.unassigned_at IS NULL
    )
  )
  WITH CHECK (true);