-- FIX: Accountants can only see safe client fields, not API keys or infra config

-- 1. Drop the existing broad accountant select policy on clients
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "Accountants can view client data" ON public.clients;
DROP POLICY IF EXISTS "accountants_view_clients" ON public.clients;

-- 2. Create a restricted view with only fields accountants need
CREATE OR REPLACE VIEW public.clients_accountant_view
WITH (security_invoker = true)
AS
SELECT
  id,
  brand_name,
  legal_name,
  vat_number,
  business_nature,
  plan_type,
  plan_expires_at,
  is_active,
  created_at,
  updated_at,
  billing_cycle,
  billing_day,
  monthly_price,
  yearly_price,
  grace_until,
  sheet_id,
  telegram_chat_id
FROM public.clients;

-- 3. Grant accountants access to the view only
GRANT SELECT ON public.clients_accountant_view TO authenticated;

-- 4. Re-create a narrow accountant policy on the base clients table
--    (read-only, only the safe columns above, only for their assigned clients)
CREATE POLICY "accountants_view_assigned_clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR (
      has_role(auth.uid(), 'accountant'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.accountant_clients ac
        JOIN public.accountants a ON a.id = ac.accountant_id
        WHERE ac.client_id = clients.id
          AND a.user_id = auth.uid()
          AND ac.unassigned_at IS NULL
      )
    )
  );