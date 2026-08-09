-- Migration 004: Shop settings enhancements
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ar_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS cr_number TEXT;

-- Ensure logo_url column exists
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
