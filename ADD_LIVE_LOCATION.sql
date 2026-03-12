-- Add live location tracking columns to delivery_boys table
-- Run this in Supabase SQL Editor

ALTER TABLE public.delivery_boys
  ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.delivery_boys.current_lat IS 'Last known GPS latitude of delivery boy';
COMMENT ON COLUMN public.delivery_boys.current_lng IS 'Last known GPS longitude of delivery boy';
COMMENT ON COLUMN public.delivery_boys.location_updated_at IS 'Timestamp of last GPS update';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'delivery_boys'
  AND column_name IN ('current_lat', 'current_lng', 'location_updated_at');
