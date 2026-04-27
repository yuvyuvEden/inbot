CREATE TABLE public.system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read system_settings"
  ON public.system_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin can modify system_settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.system_settings (key, value, description) VALUES
  ('vat_rate_percent', '18', 'שיעור המע"מ הנוכחי באחוזים'),
  ('currency', 'ILS', 'מטבע ברירת מחדל'),
  ('invoice_processing_days', '30', 'מספר ימים לעיבוד חשבונית');

CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_system_settings_updated_at();