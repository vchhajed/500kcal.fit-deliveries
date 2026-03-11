-- Add vehicle profile and document columns to delivery_boys table
-- Run this SQL in Supabase SQL Editor

ALTER TABLE public.delivery_boys
  ADD COLUMN IF NOT EXISTS pan_card_url TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_card_url TEXT,
  ADD COLUMN IF NOT EXISTS bike_model TEXT,
  ADD COLUMN IF NOT EXISTS bike_mileage DECIMAL(5,2) DEFAULT 40.0,
  ADD COLUMN IF NOT EXISTS avg_distance_per_order DECIMAL(5,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS petrol_rate DECIMAL(6,2) DEFAULT 105.0;

COMMENT ON COLUMN public.delivery_boys.bike_model IS 'Bike model for fuel cost calculation';
COMMENT ON COLUMN public.delivery_boys.bike_mileage IS 'Bike mileage in km per liter';
COMMENT ON COLUMN public.delivery_boys.avg_distance_per_order IS 'Average distance per delivery in km (used for route estimation)';
COMMENT ON COLUMN public.delivery_boys.petrol_rate IS 'Current petrol rate in INR per liter';
COMMENT ON COLUMN public.delivery_boys.pan_card_url IS 'URL to uploaded PAN card document';
COMMENT ON COLUMN public.delivery_boys.aadhar_card_url IS 'URL to uploaded Aadhaar card document';

-- Verify columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'delivery_boys'
  AND column_name IN ('pan_card_url', 'aadhar_card_url', 'bike_model', 'bike_mileage', 'avg_distance_per_order', 'petrol_rate');
