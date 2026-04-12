
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS vat_rate double precision NOT NULL DEFAULT 1.17,
  ADD COLUMN IF NOT EXISTS ai_temperature double precision NOT NULL DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS alloc_threshold_before integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS alloc_threshold_after integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS fetch_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invoice_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS known_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learned_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_days integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS thread_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS lookback_rows integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS max_distance integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_logo_bytes integer NOT NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS processed_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
