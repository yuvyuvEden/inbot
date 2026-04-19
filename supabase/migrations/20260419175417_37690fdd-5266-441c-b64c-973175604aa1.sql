-- מדיניות מחיקה לאדמין בלבד
CREATE POLICY accountants_delete_admin ON accountants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text = 'admin'
    )
  );

-- פונקציה למחיקה מלאה של רו"ח (accountant + user_roles + profiles)
-- מחיקת auth.users נעשית דרך Edge Function בלבד
CREATE OR REPLACE FUNCTION delete_accountant_full(p_accountant_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM accountants WHERE id = p_accountant_id;

  DELETE FROM accountant_clients WHERE accountant_id = p_accountant_id;
  DELETE FROM accountants WHERE id = p_accountant_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM user_roles WHERE user_id = v_user_id;
    DELETE FROM profiles WHERE user_id = v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;