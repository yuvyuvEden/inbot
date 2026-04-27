DROP FUNCTION IF EXISTS public.delete_accountant_full(UUID);

CREATE OR REPLACE FUNCTION public.delete_accountant_full(target_accountant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  DELETE FROM accountant_clients WHERE accountant_id = target_accountant_id;
  DELETE FROM accountants WHERE id = target_accountant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_accountant_full(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_accountant_full(UUID) TO authenticated;