CREATE POLICY "invoices_delete"
ON public.invoices
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = invoices.client_id AND c.user_id = auth.uid()
  )
);