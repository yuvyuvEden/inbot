CREATE TABLE public.vat_rules (
  category        TEXT PRIMARY KEY,
  vat_rate        NUMERIC NOT NULL DEFAULT 1.0,
  tax_rate        NUMERIC NOT NULL DEFAULT 1.0,
  no_vat          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vat_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read vat_rules"
  ON public.vat_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin can manage vat_rules"
  ON public.vat_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vat_rules (category, vat_rate, tax_rate, no_vat) VALUES
  ('ציוד משרדי',              1.0,                1.0,  false),
  ('שכירות',                  1.0,                0.25, false),
  ('ניהול ואחזקה',            0.25,               0.25, false),
  ('ניקיון והיגיינה',         1.0,                1.0,  false),
  ('תיקונים ושיפוצים',        1.0,                1.0,  false),
  ('ריהוט וציוד קבוע',        1.0,                1.0,  false),
  ('ארנונה ואגרות',           0.0,                0.25, true),
  ('חשמל',                    0.25,               0.25, false),
  ('מים',                     0.25,               0.25, false),
  ('ביטוח עסקי',              0.0,                1.0,  true),
  ('ביטוח פנסיוני',           0.0,                1.0,  true),
  ('ביטוח לאומי',             0.0,                1.0,  true),
  ('מס הכנסה ומע"מ',          0.0,                1.0,  true),
  ('מחשוב ותוכנה',            1.0,                1.0,  false),
  ('שירותי ענן',              1.0,                1.0,  false),
  ('דומיינים ואחסון',         1.0,                1.0,  false),
  ('פיתוח אתרים',             1.0,                1.0,  false),
  ('תקשורת',                  0.6667,             0.50, false),
  ('מינויים (SaaS)',           1.0,                1.0,  false),
  ('דלק',                     0.6667,             0.45, false),
  ('חניה',                    1.0,                0.45, false),
  ('תחזוקת רכב',              0.6667,             0.45, false),
  ('ביטוח רכב',               0.0,                0.45, true),
  ('אגרות כביש',              0.6667,             0.45, false),
  ('מוניות',                  0.6667,             0.45, false),
  ('תחבורה ציבורית',          0.0,                0.45, true),
  ('פרסום ושיווק',            1.0,                1.0,  false),
  ('שירותי תוכן',             1.0,                1.0,  false),
  ('כנסים ואירועים',          1.0,                1.0,  false),
  ('הכשרה והשתלמויות',        1.0,                1.0,  false),
  ('ייעוץ משפטי',             1.0,                1.0,  false),
  ('שירותי הנהלת חשבונות',    1.0,                1.0,  false),
  ('עמלות בנק',               0.0,                1.0,  true),
  ('עמלות סליקה',             1.0,                1.0,  false),
  ('ריבית ומימון',            0.0,                1.0,  true),
  ('כיבוד למשרד',             0.0,                0.80, true),
  ('ארוחות ומסעדות',          0.0,                0.0,  true),
  ('מתנות ורווחה',            0.0,                1.0,  true),
  ('תרומות',                  0.0,                1.0,  true),
  ('אחר',                     1.0,                1.0,  false)
ON CONFLICT (category) DO NOTHING;