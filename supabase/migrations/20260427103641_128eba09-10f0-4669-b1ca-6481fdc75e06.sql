-- 1. Add grace_until column to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ NULL;

-- 2. Create a function that sets grace_until on all clients of a suspended accountant
CREATE OR REPLACE FUNCTION public.handle_accountant_suspension()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE clients
    SET grace_until = now() + INTERVAL '14 days'
    WHERE id IN (
      SELECT client_id
      FROM accountant_clients
      WHERE accountant_id = NEW.id
        AND unassigned_at IS NULL
    )
    AND grace_until IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create the trigger on accountants table
DROP TRIGGER IF EXISTS on_accountant_suspension ON accountants;
CREATE TRIGGER on_accountant_suspension
  AFTER UPDATE OF is_active ON accountants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_accountant_suspension();

-- 4. Index for fast lookups on grace_until
CREATE INDEX IF NOT EXISTS idx_clients_grace_until
  ON clients(grace_until)
  WHERE grace_until IS NOT NULL;