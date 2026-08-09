-- Supabase Migration: Finance / Expenses
-- Run this in the Supabase SQL Editor

------------------------------------------------------------
-- EXPENSES
------------------------------------------------------------
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'transfer')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_category ON public.expenses(category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expenses"
  ON public.expenses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

CREATE POLICY "Authenticated users can update expenses"
  ON public.expenses FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete expenses"
  ON public.expenses FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
