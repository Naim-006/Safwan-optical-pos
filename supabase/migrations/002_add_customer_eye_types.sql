-- Migration 002: Add eye_type and lens_type to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS eye_type VARCHAR(50);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lens_type VARCHAR(50);
