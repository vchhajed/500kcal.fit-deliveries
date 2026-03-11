-- Add starting point columns to delivery_boys table
-- Run this SQL in Supabase SQL Editor

ALTER TABLE public.delivery_boys
  ADD COLUMN IF NOT EXISTS starting_address TEXT,
  ADD COLUMN IF NOT EXISTS starting_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS starting_lng DECIMAL(11, 8);

COMMENT ON COLUMN public.delivery_boys.starting_address IS 'Starting point address for route planning (e.g., kitchen/depot)';
COMMENT ON COLUMN public.delivery_boys.starting_lat IS 'GPS latitude of saved starting point';
COMMENT ON COLUMN public.delivery_boys.starting_lng IS 'GPS longitude of saved starting point';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'delivery_boys'
  AND column_name IN ('starting_address', 'starting_lat', 'starting_lng');
