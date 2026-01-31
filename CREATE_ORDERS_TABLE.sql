-- Create Orders Table for 500kcal.fit Delivery Portal
-- Run this SQL in Supabase SQL Editor

-- First, check if table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN

    -- Create orders table
    CREATE TABLE public.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Customer information
      customer_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,

      -- Order details
      menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
      delivery_date DATE NOT NULL,
      meal_slot TEXT NOT NULL CHECK (meal_slot IN ('Breakfast', 'Lunch', 'Dinner')),

      -- Delivery information
      delivery_address TEXT,
      special_instructions TEXT,

      -- Delivery boy assignment
      delivery_boy_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
      delivery_boy_phone TEXT,
      assigned_at TIMESTAMP WITH TIME ZONE,

      -- Order status
      order_status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (order_status IN ('Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled')),

      -- Delivery tracking
      delivery_notes TEXT,
      delivered_at TIMESTAMP WITH TIME ZONE,
      delivery_photo_url TEXT,
      delivery_latitude DECIMAL(10, 8),
      delivery_longitude DECIMAL(11, 8),
      delivery_location_accuracy DECIMAL(10, 2),
      delivery_address_verified TEXT,

      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes for better query performance
    CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
    CREATE INDEX idx_orders_delivery_boy_id ON public.orders(delivery_boy_id);
    CREATE INDEX idx_orders_delivery_boy_phone ON public.orders(delivery_boy_phone);
    CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
    CREATE INDEX idx_orders_order_status ON public.orders(order_status);
    CREATE INDEX idx_orders_meal_slot ON public.orders(meal_slot);

    -- Create composite index for common queries
    CREATE INDEX idx_orders_delivery_boy_date ON public.orders(delivery_boy_id, delivery_date);
    CREATE INDEX idx_orders_delivery_boy_phone_date ON public.orders(delivery_boy_phone, delivery_date);

    -- Add comments for documentation
    COMMENT ON TABLE public.orders IS 'Orders table for meal deliveries';
    COMMENT ON COLUMN public.orders.delivery_boy_id IS 'UUID of delivery boy assigned to this order';
    COMMENT ON COLUMN public.orders.delivery_boy_phone IS 'Phone number of delivery boy assigned to this order';
    COMMENT ON COLUMN public.orders.order_status IS 'Current status of the order';
    COMMENT ON COLUMN public.orders.delivery_photo_url IS 'URL to photo proof of delivery';
    COMMENT ON COLUMN public.orders.delivery_latitude IS 'GPS latitude where order was delivered';
    COMMENT ON COLUMN public.orders.delivery_longitude IS 'GPS longitude where order was delivered';
    COMMENT ON COLUMN public.orders.delivery_location_accuracy IS 'GPS accuracy in meters';
    COMMENT ON COLUMN public.orders.delivery_address_verified IS 'Reverse geocoded address at delivery location';

    RAISE NOTICE 'Orders table created successfully';

  ELSE
    RAISE NOTICE 'Orders table already exists';
  END IF;
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample test orders for testing
-- Note: Replace customer_id and menu_item_id with actual IDs from your database
DO $$
DECLARE
  v_customer_id UUID;
  v_menu_item_id UUID;
BEGIN
  -- Try to get a customer ID (if customer_accounts table exists)
  SELECT id INTO v_customer_id FROM public.customer_accounts
  WHERE role = 'customer' LIMIT 1;

  -- Try to get a menu item ID (if menu_items table exists)
  SELECT id INTO v_menu_item_id FROM public.menu_items LIMIT 1;

  IF v_customer_id IS NOT NULL AND v_menu_item_id IS NOT NULL THEN
    -- Insert sample orders for today
    INSERT INTO public.orders (
      customer_id,
      menu_item_id,
      delivery_date,
      meal_slot,
      delivery_address,
      special_instructions,
      order_status
    ) VALUES
      -- Breakfast orders
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Breakfast', 'Koregaon Park, Pune', 'Ring doorbell', 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Breakfast', 'Viman Nagar, Pune', 'Call on arrival', 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Breakfast', 'Kalyani Nagar, Pune', NULL, 'Pending'),

      -- Lunch orders
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Lunch', 'Kharadi, Pune', 'Office delivery', 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Lunch', 'Hadapsar, Pune', 'Leave at gate', 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Lunch', 'Magarpatta, Pune', NULL, 'Pending'),

      -- Dinner orders
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Dinner', 'Baner, Pune', NULL, 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE, 'Dinner', 'Aundh, Pune', 'Apartment B-404', 'Pending'),

      -- Tomorrow's orders
      (v_customer_id, v_menu_item_id, CURRENT_DATE + 1, 'Breakfast', 'Wakad, Pune', NULL, 'Pending'),
      (v_customer_id, v_menu_item_id, CURRENT_DATE + 1, 'Lunch', 'Hinjewadi, Pune', NULL, 'Pending');

    RAISE NOTICE 'Sample orders created successfully';
  ELSE
    RAISE NOTICE 'Skipping sample data - customer_accounts or menu_items table not found';
  END IF;
END $$;

-- Grant permissions to authenticated users
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own orders
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR delivery_boy_id = auth.uid()
  );

-- Policy: Delivery boys can update their assigned orders
CREATE POLICY "Delivery boys can update their assigned orders"
  ON public.orders
  FOR UPDATE
  USING (delivery_boy_id = auth.uid());

-- Policy: Allow service role to do anything (for API calls)
CREATE POLICY "Service role can do anything"
  ON public.orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Display summary
SELECT
  'Orders table ready!' AS status,
  COUNT(*) AS total_orders,
  COUNT(CASE WHEN delivery_date = CURRENT_DATE THEN 1 END) AS today_orders,
  COUNT(CASE WHEN order_status = 'Pending' THEN 1 END) AS pending_orders
FROM public.orders;
