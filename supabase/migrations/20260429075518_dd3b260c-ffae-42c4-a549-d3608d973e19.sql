-- FIX: Replace comments_insert policy to enforce invoice ownership

DROP POLICY IF EXISTS "comments_insert" ON public.invoice_comments;

CREATE POLICY "comments_insert"
  ON public.invoice_comments
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = author_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.invoices i
        JOIN public.clients c ON c.id = i.client_id
        WHERE i.id = invoice_comments.invoice_id
          AND c.user_id = auth.uid()
      )
      OR (
        has_role(auth.uid(), 'accountant'::app_role)
        AND EXISTS (
          SELECT 1
          FROM public.invoices i
          JOIN public.accountant_clients ac ON ac.client_id = i.client_id
          JOIN public.accountants a ON a.id = ac.accountant_id
          WHERE i.id = invoice_comments.invoice_id
            AND a.user_id = auth.uid()
            AND ac.unassigned_at IS NULL
        )
      )
    )
  );