-- Supabase Migration: Monotonic invoice / receipt number sequences
-- Ensures SA-IN-XXXX and SA-RE-XXXX numbers are never reused, even after a row is deleted.
-- Run this in the Supabase SQL Editor (or via supabase db push).

-- 1) Sequence table: one row per prefix, holding the highest number ever issued.
CREATE TABLE IF NOT EXISTS public.number_sequences (
  prefix TEXT PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read number_sequences"
  ON public.number_sequences FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can write number_sequences"
  ON public.number_sequences FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2) Atomic next-number function.
--    - Row lock makes concurrent calls safe (no duplicates).
--    - Always continues above the largest number ever issued (even if that row was deleted).
--    - Defensively never collides with any existing invoice number.
CREATE OR REPLACE FUNCTION public.next_sequence(p_prefix TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
  max_existing BIGINT;
BEGIN
  INSERT INTO public.number_sequences (prefix, last_value)
  VALUES (p_prefix, 0)
  ON CONFLICT (prefix) DO NOTHING;

  SELECT last_value + 1 INTO next_val
  FROM public.number_sequences
  WHERE prefix = p_prefix
  FOR UPDATE;

  SELECT COALESCE(MAX((REGEXP_REPLACE(invoice_number, '^.*-', ''))::BIGINT), 0)
    INTO max_existing
  FROM public.invoices
  WHERE invoice_number LIKE 'SA-' || p_prefix || '-%';

  next_val := GREATEST(next_val, max_existing + 1);

  UPDATE public.number_sequences
     SET last_value = next_val
   WHERE prefix = p_prefix;

  RETURN next_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_sequence(TEXT) TO anon, authenticated;

-- 3) Seed from existing invoices so numbering continues where it left off.
INSERT INTO public.number_sequences (prefix, last_value)
SELECT 'IN', COALESCE(MAX((REGEXP_REPLACE(invoice_number, '^.*-', ''))::BIGINT), 0)
FROM public.invoices WHERE invoice_number LIKE 'SA-IN-%'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO public.number_sequences (prefix, last_value)
SELECT 'RE', COALESCE(MAX((REGEXP_REPLACE(invoice_number, '^.*-', ''))::BIGINT), 0)
FROM public.invoices WHERE invoice_number LIKE 'SA-RE-%'
ON CONFLICT (prefix) DO NOTHING;
