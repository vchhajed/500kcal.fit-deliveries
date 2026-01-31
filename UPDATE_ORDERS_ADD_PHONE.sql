-- Add delivery_boy_phone column to existing orders table
-- Run this in Supabase SQL Editor

-- Step 1: Add the column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_boy_phone TEXT;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy_phone
ON public.orders(delivery_boy_phone);

-- Step 3: Create composite index for phone + date queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy_phone_date
ON public.orders(delivery_boy_phone, delivery_date);

-- Step 4: Add comment
COMMENT ON COLUMN public.orders.delivery_boy_phone IS 'Phone number of delivery boy assigned to this order';

-- Step 5: Migrate existing data (copy phone numbers from delivery_boy_id)
-- This populates delivery_boy_phone from the customer_accounts table
UPDATE public.orders o
SET delivery_boy_phone = ca.phone_number
FROM public.customer_accounts ca
WHERE o.delivery_boy_id = ca.id
  AND o.delivery_boy_phone IS NULL
  AND ca.role = 'delivery_boy';

-- Display result
SELECT
  'delivery_boy_phone column added successfully!' as status,
  COUNT(*) FILTER (WHERE delivery_boy_phone IS NOT NULL) as orders_with_phone,
  COUNT(*) FILTER (WHERE delivery_boy_phone IS NULL) as orders_without_phone
FROM public.orders;
