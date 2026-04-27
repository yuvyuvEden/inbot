-- Protect user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admin can read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure assets bucket exists
INSERT INTO storage.buckets (id, name, public)
  VALUES ('assets', 'assets', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for assets bucket
CREATE POLICY "authenticated users can upload assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "anyone can read assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assets');

CREATE POLICY "owner or admin can delete assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assets' AND (
      owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );