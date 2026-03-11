-- Script to normalize meal_slot values in the orders table
-- This fixes inconsistent data where meal_slot contains lowercase values or time ranges

-- First, let's see what we have
SELECT meal_slot, COUNT(*) as count
FROM orders
GROUP BY meal_slot
ORDER BY meal_slot;

-- Fix lowercase 'breakfast' to 'Breakfast'
UPDATE orders
SET meal_slot = 'Breakfast'
WHERE meal_slot = 'breakfast';

-- Fix lowercase 'lunch' to 'Lunch'
UPDATE orders
SET meal_slot = 'Lunch'
WHERE meal_slot = 'lunch';

-- Fix lowercase 'dinner' to 'Dinner'
UPDATE orders
SET meal_slot = 'Dinner'
WHERE meal_slot = 'dinner';

-- Fix time ranges that represent breakfast (morning times)
-- Common patterns: 06:00-08:30, 07:00-09:00, 08:00-08:30, 08:00-09:30, 09:00-09:30
UPDATE orders
SET meal_slot = 'Breakfast'
WHERE meal_slot ~ '^0[6789]:\d{2}-0[89]:\d{2}$'
   OR meal_slot ~ '^09:\d{2}-09:\d{2}$';

-- Fix time ranges that represent lunch (midday times)
-- Common patterns: 11:00-13:00, 12:00-14:00, 12:30-14:30, 13:00-14:00
UPDATE orders
SET meal_slot = 'Lunch'
WHERE meal_slot ~ '^1[12]:\d{2}-1[34]:\d{2}$';

-- Fix time ranges that represent dinner (evening times)
-- Common patterns: 17:00-19:00, 18:00-20:00, 18:30-19:00, 19:00-21:00, 20:00-21:00
UPDATE orders
SET meal_slot = 'Dinner'
WHERE meal_slot ~ '^1[789]:\d{2}-2[01]:\d{2}$';

-- Verify the changes
SELECT meal_slot, COUNT(*) as count
FROM orders
GROUP BY meal_slot
ORDER BY meal_slot;

-- Check if there are any remaining non-standard values
SELECT DISTINCT meal_slot
FROM orders
WHERE meal_slot NOT IN ('Breakfast', 'Lunch', 'Dinner')
ORDER BY meal_slot;
