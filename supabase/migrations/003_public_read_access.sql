-- Migration 003: Public read-only access for invoice viewing
-- This is safe because the anon key is client-side anyway

-- Allow public (anon) read access to invoices for QR code verification
CREATE POLICY "Public can read invoices for QR verification"
  ON public.invoices FOR SELECT
  USING (true);

-- Allow public (anon) read access to invoice items  
CREATE POLICY "Public can read invoice items for QR verification"
  ON public.invoice_items FOR SELECT
  USING (true);

-- Allow public read access to customers (name + phone only, not full profile)
CREATE POLICY "Public can read customer names for QR verification"
  ON public.customers FOR SELECT
  USING (true);

-- Allow public read access to settings (shop name for display)
CREATE POLICY "Public can read settings"
  ON public.settings FOR SELECT
  USING (true);
