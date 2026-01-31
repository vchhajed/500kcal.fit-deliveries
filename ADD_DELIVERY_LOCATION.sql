-- Add delivery location tracking to orders table
-- This allows capturing GPS coordinates when delivery is completed

-- Step 1: Add location columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS delivery_location_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS delivery_address_verified TEXT;

-- Step 2: Create spatial index for location queries (if PostGIS is available)
-- Note: This requires PostGIS extension
-- CREATE INDEX IF NOT EXISTS idx_orders_delivery_location
-- ON public.orders USING GIST (
--   ll_to_earth(delivery_latitude, delivery_longitude)
-- );

-- Step 3: Add comments
COMMENT ON COLUMN public.orders.delivery_latitude IS 'GPS latitude where order was delivered';
COMMENT ON COLUMN public.orders.delivery_longitude IS 'GPS longitude where order was delivered';
COMMENT ON COLUMN public.orders.delivery_location_accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN public.orders.delivery_address_verified IS 'Reverse geocoded address at delivery location';

-- Display result
SELECT
  'Delivery location tracking columns added!' as status,
  COUNT(*) FILTER (WHERE delivery_latitude IS NOT NULL) as orders_with_location,
  COUNT(*) FILTER (WHERE delivery_latitude IS NULL) as orders_without_location
FROM public.orders;
