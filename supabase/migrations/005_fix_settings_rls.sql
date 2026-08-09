-- Migration 005: Drop ALL existing settings policies and recreate
-- Run this in Supabase SQL Editor

-- Drop EVERY policy on settings table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'settings'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.settings';
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create a single permissive policy
CREATE POLICY "settings_full_access"
  ON public.settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
