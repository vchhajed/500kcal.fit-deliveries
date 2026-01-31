-- SQL Script: Assign Orders to Delivery Boys Using Phone Numbers
-- This script helps you assign orders from the orders table to delivery boys

-- ============================================================================
-- STEP 1: First, run the ADD_DELIVERY_BOY_PHONE_TO_ORDERS.sql script
-- to add the delivery_boy_phone column if it doesn't exist
-- ============================================================================

-- ============================================================================
-- STEP 2: Assign orders to delivery boys by phone number
-- ============================================================================

-- Option A: Assign to Test Delivery Boy 1 (hardcoded user)
UPDATE orders
SET
  delivery_boy_phone = '8087406269',
  assigned_at = NOW(),
  order_status = 'Pending',
  updated_at = NOW()
WHERE
  delivery_date >= CURRENT_DATE
  AND (delivery_boy_phone IS NULL OR delivery_boy_phone = '')
LIMIT 5;

-- Option B: Assign to Test Delivery Boy 2 (hardcoded user)
UPDATE orders
SET
  delivery_boy_phone = '9730425526',
  assigned_at = NOW(),
  order_status = 'Pending',
  updated_at = NOW()
WHERE
  delivery_date >= CURRENT_DATE
  AND (delivery_boy_phone IS NULL OR delivery_boy_phone = '')
LIMIT 5;

-- ============================================================================
-- STEP 3: Verify the assignments
-- ============================================================================

-- Check orders assigned to Test Delivery Boy 1
SELECT
  id,
  delivery_date,
  meal_slot,
  delivery_address,
  order_status,
  delivery_boy_phone,
  assigned_at
FROM orders
WHERE delivery_boy_phone = '8087406269'
ORDER BY delivery_date, meal_slot;

-- Check orders assigned to Test Delivery Boy 2
SELECT
  id,
  delivery_date,
  meal_slot,
  delivery_address,
  order_status,
  delivery_boy_phone,
  assigned_at
FROM orders
WHERE delivery_boy_phone = '9730425526'
ORDER BY delivery_date, meal_slot;

-- ============================================================================
-- HELPFUL QUERIES
-- ============================================================================

-- Count total orders by delivery boy
SELECT
  delivery_boy_phone,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN order_status = 'Delivered' THEN 1 END) as completed,
  COUNT(CASE WHEN order_status = 'Pending' THEN 1 END) as pending
FROM orders
WHERE delivery_boy_phone IS NOT NULL
GROUP BY delivery_boy_phone;

-- View all unassigned orders
SELECT
  id,
  delivery_date,
  meal_slot,
  delivery_address,
  order_status
FROM orders
WHERE (delivery_boy_phone IS NULL OR delivery_boy_phone = '')
  AND delivery_date >= CURRENT_DATE
ORDER BY delivery_date, meal_slot;

-- Assign orders for a specific date
UPDATE orders
SET
  delivery_boy_phone = '8087406269',
  assigned_at = NOW(),
  order_status = 'Pending',
  updated_at = NOW()
WHERE
  delivery_date = '2026-01-31'  -- Change to your target date
  AND (delivery_boy_phone IS NULL OR delivery_boy_phone = '')
LIMIT 3;

-- Assign orders for a specific meal slot
UPDATE orders
SET
  delivery_boy_phone = '8087406269',
  assigned_at = NOW(),
  order_status = 'Pending',
  updated_at = NOW()
WHERE
  meal_slot = 'Lunch'  -- Options: Breakfast, Lunch, Dinner
  AND delivery_date >= CURRENT_DATE
  AND (delivery_boy_phone IS NULL OR delivery_boy_phone = '')
LIMIT 5;

-- Reassign orders from one delivery boy to another
UPDATE orders
SET
  delivery_boy_phone = '9730425526',  -- New delivery boy
  assigned_at = NOW(),
  updated_at = NOW()
WHERE
  delivery_boy_phone = '8087406269'  -- Old delivery boy
  AND order_status NOT IN ('Delivered', 'Cancelled')
  AND delivery_date >= CURRENT_DATE;

-- Clear assignment (unassign)
UPDATE orders
SET
  delivery_boy_phone = NULL,
  assigned_at = NULL,
  updated_at = NOW()
WHERE
  delivery_boy_phone = '8087406269'
  AND order_status = 'Pending';
