-- Add archived_at and archived_by to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) NULL;

-- Trigger function: auto-set archived_at + archived_by on archive/unarchive
CREATE OR REPLACE FUNCTION public.set_archived_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_archived = true AND (OLD.is_archived = false OR OLD.is_archived IS NULL) THEN
    NEW.archived_at = now();
    NEW.archived_by = auth.uid();
  ELSIF NEW.is_archived = false AND OLD.is_archived = true THEN
    NEW.archived_at = NULL;
    NEW.archived_by = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_invoice_archived ON invoices;
CREATE TRIGGER set_invoice_archived
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_archived_metadata();