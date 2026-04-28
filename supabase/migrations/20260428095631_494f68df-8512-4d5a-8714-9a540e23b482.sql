CREATE TABLE IF NOT EXISTS public.invoice_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_quarantine_telegram
  ON public.invoice_quarantine(telegram_chat_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.invoice_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quarantine_admin_all"
  ON public.invoice_quarantine
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));