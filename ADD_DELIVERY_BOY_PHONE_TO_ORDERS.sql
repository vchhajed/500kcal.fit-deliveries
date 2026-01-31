-- Add delivery_boy_phone column to orders table
-- This allows filtering by phone number instead of UUID

-- Step 1: Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
    AND column_name = 'delivery_boy_phone'
  ) THEN
    ALTER TABLE public.orders
    ADD COLUMN delivery_boy_phone TEXT;

    RAISE NOTICE 'Added delivery_boy_phone column to orders table';
  ELSE
    RAISE NOTICE 'delivery_boy_phone column already exists';
  END IF;
END $$;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy_phone
ON public.orders(delivery_boy_phone);

-- Step 3: Migrate existing data (if you have orders with delivery_boy_id)
-- This updates delivery_boy_phone based on existing delivery_boy_id
UPDATE public.orders o
SET delivery_boy_phone = ca.phone_number
FROM public.customer_accounts ca
WHERE o.delivery_boy_id = ca.id
  AND o.delivery_boy_phone IS NULL
  AND ca.role = 'delivery_boy';

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.orders.delivery_boy_phone IS 'Phone number of delivery boy assigned to this order';

-- Display summary
SELECT
  'Orders table updated!' AS status,
  COUNT(*) FILTER (WHERE delivery_boy_phone IS NOT NULL) AS orders_with_phone,
  COUNT(*) FILTER (WHERE delivery_boy_phone IS NULL) AS orders_without_phone
FROM public.orders;
