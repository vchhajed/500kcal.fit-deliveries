# SQL Guide: Assigning Deliveries to Delivery Boys

## Overview

This guide shows you how to assign orders to delivery boys in the database so they can see and update their deliveries in the portal.

## Database Schema

### Key Tables:

**`customer_accounts` table:**
- `id` (UUID) - Primary key
- `phone_number` (TEXT) - Delivery boy's phone number
- `name` (TEXT) - Delivery boy's name
- `role` (TEXT) - Must be 'delivery_boy'
- `session_token` (TEXT) - For authentication

**`orders` table:**
- `id` (UUID) - Primary key
- `customer_id` (UUID) - Customer who placed the order
- `delivery_boy_id` (UUID) - **Delivery boy assigned to this order**
- `delivery_date` (DATE) - Date of delivery
- `meal_slot` (TEXT) - Breakfast, Lunch, Dinner
- `order_status` (TEXT) - Pending, Out for Delivery, Delivered, Cancelled
- `delivery_address` (TEXT) - Where to deliver
- `assigned_at` (TIMESTAMP) - When assigned to delivery boy
- `delivered_at` (TIMESTAMP) - When marked as delivered
- `delivery_photo_url` (TEXT) - Photo proof of delivery
- `delivery_notes` (TEXT) - Notes from delivery boy

## How the System Works

### Flow:

1. **Login:** Delivery boy logs in with phone number + password
2. **Authentication:** System finds delivery boy by phone number in `customer_accounts`
3. **Fetch Deliveries:** System queries `orders` table with:
   ```sql
   WHERE delivery_boy_id = <delivery_boy_id>
   ```
4. **Display:** Only orders assigned to this delivery boy are shown
5. **Update:** Delivery boy can mark orders as delivered

## Assigning Deliveries

### Method 1: Assign to Hardcoded Test Users

For immediate testing with hardcoded users (8087406269 and 9730425526):

```sql
-- Assign 5 orders to Test Delivery Boy 1
UPDATE orders
SET
  delivery_boy_id = 'hardcoded-user-1',
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_date >= CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 5;

-- Assign 5 orders to Test Delivery Boy 2
UPDATE orders
SET
  delivery_boy_id = 'hardcoded-user-2',
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_date >= CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 5;
```

**Note:** Hardcoded users use string IDs, not UUIDs. This works but is temporary for testing only.

### Method 2: Assign to Real Delivery Boys

First, find the delivery boy's ID:

```sql
-- Find delivery boy by phone number
SELECT id, name, phone_number, role
FROM customer_accounts
WHERE phone_number = '8087406269'  -- Replace with actual phone
AND role = 'delivery_boy';
```

Then assign orders:

```sql
-- Assign orders to specific delivery boy
UPDATE orders
SET
  delivery_boy_id = '00000000-0000-0000-0000-000000000001',  -- Replace with actual UUID
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_date >= CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 10;
```

### Method 3: Assign Specific Orders

```sql
-- Assign specific order IDs to delivery boy
UPDATE orders
SET
  delivery_boy_id = '00000000-0000-0000-0000-000000000001',  -- Delivery boy UUID
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
```

### Method 4: Assign by Date and Meal Slot

```sql
-- Assign all breakfast orders for tomorrow to delivery boy
UPDATE orders
SET
  delivery_boy_id = '00000000-0000-0000-0000-000000000001',
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_date = (CURRENT_DATE + INTERVAL '1 day')
  AND meal_slot = 'Breakfast'
  AND delivery_boy_id IS NULL;
```

### Method 5: Bulk Assignment by Area/Location

```sql
-- Assign all orders in specific area to delivery boy
UPDATE orders
SET
  delivery_boy_id = '00000000-0000-0000-0000-000000000001',
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_address ILIKE '%Koregaon Park%'  -- Replace with area name
  AND delivery_date >= CURRENT_DATE
  AND delivery_boy_id IS NULL;
```

## Checking Assignments

### View all deliveries for a specific delivery boy:

```sql
SELECT
  o.id,
  o.delivery_date,
  o.meal_slot,
  o.order_status,
  o.delivery_address,
  c.name AS customer_name,
  c.phone_number AS customer_phone,
  m.name AS menu_item,
  db.name AS delivery_boy_name
FROM orders o
JOIN customer_accounts c ON o.customer_id = c.id
LEFT JOIN menu_items m ON o.menu_item_id = m.id
JOIN customer_accounts db ON o.delivery_boy_id = db.id
WHERE db.phone_number = '8087406269'  -- Delivery boy's phone
ORDER BY o.delivery_date, o.meal_slot;
```

### Count deliveries per delivery boy:

```sql
SELECT
  db.name AS delivery_boy,
  db.phone_number,
  COUNT(o.id) AS total_deliveries,
  SUM(CASE WHEN o.order_status = 'Delivered' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN o.order_status = 'Pending' THEN 1 ELSE 0 END) AS pending
FROM customer_accounts db
LEFT JOIN orders o ON o.delivery_boy_id = db.id
WHERE db.role = 'delivery_boy'
GROUP BY db.id, db.name, db.phone_number
ORDER BY total_deliveries DESC;
```

### View unassigned orders:

```sql
SELECT
  id,
  delivery_date,
  meal_slot,
  delivery_address,
  order_status
FROM orders
WHERE delivery_boy_id IS NULL
AND delivery_date >= CURRENT_DATE
ORDER BY delivery_date, meal_slot;
```

## Creating Real Delivery Boys

If you need to create delivery boy accounts in the database:

```sql
-- Create a delivery boy account
INSERT INTO customer_accounts (
  id,
  phone_number,
  name,
  password_hash,
  password_salt,
  role,
  email,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '9876543210',  -- Phone number
  'John Delivery Boy',  -- Name
  'hash_here',  -- Use generate-password.js script to generate
  'salt_here',  -- Use generate-password.js script to generate
  'delivery_boy',  -- Role
  'john@example.com',  -- Email (optional)
  NOW(),
  NOW()
);
```

**To generate password hash:**
```bash
cd /Users/vaibhavprakashchhajed/500kcal.fit-deliveries
node scripts/generate-password.js your_password_here
```

This will output the hash and salt to use in the INSERT statement.

## Testing the Flow

### Complete Test Scenario:

#### Step 1: Assign orders to hardcoded user

```sql
-- Assign 3 orders for today
UPDATE orders
SET
  delivery_boy_id = 'hardcoded-user-1',
  assigned_at = NOW(),
  order_status = 'Pending'
WHERE
  delivery_date = CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 3;
```

#### Step 2: Login to portal

1. Go to http://localhost:3005/login
2. Phone: `8087406269`
3. Password: `123456`

#### Step 3: View deliveries

- Dashboard should show 3 assigned orders
- Each order shows:
  - Customer name and phone
  - Delivery address
  - Menu item
  - Current status

#### Step 4: Update delivery status

1. Click status dropdown on an order
2. Select "Out for Delivery"
3. Order status updates in database

#### Step 5: Mark as delivered (with photo)

1. Select "Delivered" from dropdown
2. Photo upload modal opens
3. Upload photo
4. Photo saves to Supabase Storage
5. Order marked as delivered in database

#### Step 6: Verify in database

```sql
SELECT
  id,
  order_status,
  delivery_notes,
  delivered_at,
  delivery_photo_url
FROM orders
WHERE delivery_boy_id = 'hardcoded-user-1'
AND order_status = 'Delivered';
```

Should show:
- `order_status` = 'Delivered'
- `delivered_at` = timestamp
- `delivery_photo_url` = URL to photo

## Advanced Queries

### Assign orders intelligently by distance (requires location data):

```sql
-- This is a conceptual example
-- Assumes you have lat/lng stored for delivery addresses
UPDATE orders o
SET
  delivery_boy_id = (
    SELECT db.id
    FROM customer_accounts db
    WHERE db.role = 'delivery_boy'
    ORDER BY
      -- Calculate distance between delivery boy and customer
      earth_distance(
        ll_to_earth(db.latitude, db.longitude),
        ll_to_earth(o.latitude, o.longitude)
      )
    LIMIT 1
  ),
  assigned_at = NOW()
WHERE
  o.delivery_date = CURRENT_DATE
  AND o.delivery_boy_id IS NULL;
```

### Auto-assign based on workload:

```sql
-- Assign to delivery boy with least orders
UPDATE orders
SET
  delivery_boy_id = (
    SELECT db.id
    FROM customer_accounts db
    LEFT JOIN orders o ON o.delivery_boy_id = db.id
      AND o.delivery_date = CURRENT_DATE
    WHERE db.role = 'delivery_boy'
    GROUP BY db.id
    ORDER BY COUNT(o.id) ASC
    LIMIT 1
  ),
  assigned_at = NOW()
WHERE
  delivery_date = CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 1;
```

## Troubleshooting

### Issue: Delivery boy sees no orders after login

**Check:**
```sql
-- Verify delivery boy exists
SELECT * FROM customer_accounts
WHERE phone_number = '8087406269'
AND role = 'delivery_boy';

-- Check if orders are assigned
SELECT COUNT(*) FROM orders
WHERE delivery_boy_id = 'hardcoded-user-1'
AND delivery_date >= CURRENT_DATE;
```

**Solution:** Make sure orders are assigned to the correct delivery_boy_id

### Issue: Wrong delivery boy sees the orders

**Check:**
```sql
-- See what delivery_boy_id is being used
SELECT delivery_boy_id FROM orders
WHERE id = 'order_uuid_here';

-- Compare with actual delivery boy ID
SELECT id FROM customer_accounts
WHERE phone_number = '8087406269';
```

**Solution:** Update orders with correct delivery_boy_id

### Issue: Orders from past dates showing up

**Check:**
```sql
-- See all orders for delivery boy
SELECT delivery_date, COUNT(*)
FROM orders
WHERE delivery_boy_id = 'hardcoded-user-1'
GROUP BY delivery_date
ORDER BY delivery_date;
```

**Solution:** The dashboard only shows today and future by default, but you can filter by specific date

## Best Practices

1. **Always set `assigned_at` timestamp** when assigning orders
2. **Set initial `order_status` to 'Pending'** when assigning
3. **Don't reassign completed deliveries** - check status first
4. **Balance workload** across delivery boys
5. **Consider geographic proximity** when assigning
6. **Track assignment history** for analytics

## Production Recommendations

### Create assignment tracking table:

```sql
CREATE TABLE delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  delivery_boy_id UUID REFERENCES customer_accounts(id),
  assigned_by UUID REFERENCES customer_accounts(id),  -- Admin who assigned
  assigned_at TIMESTAMP DEFAULT NOW(),
  reassigned_from UUID REFERENCES customer_accounts(id),  -- Previous delivery boy
  reason TEXT,  -- Reason for assignment/reassignment
  created_at TIMESTAMP DEFAULT NOW()
);
```

This tracks:
- Who assigned each delivery
- When it was assigned
- If it was reassigned
- Why it was reassigned

---

**Last Updated:** 2026-01-16
**Status:** Ready for production use with real delivery boys
