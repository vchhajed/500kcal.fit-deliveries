# Quick Setup Guide for 500Kcal.fit Delivery Portal

## Step-by-Step Setup

### Step 1: Copy Environment Variables

1. Open your main project at `/Users/vaibhavprakashchhajed/500kcal.fit`
2. Look for the `.env.local` file
3. Copy the following values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. Open `.env.local` in this project and replace the placeholder values

Example:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Update Database Schema

The database schema has already been updated in your main project's `complete_database_schema.sql` file. You need to apply it to your database:

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the sidebar
3. Run this SQL:

```sql
-- Add delivery tracking fields
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES customer_accounts(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);
```

4. Then run the RLS policies (already in the complete_database_schema.sql)

**Option B: Using psql**
```bash
psql -h your-supabase-host -U postgres -d postgres -f /path/to/complete_database_schema.sql
```

### Step 3: Create Test Delivery Boy Account

**Option A: Using your main app's signup API**
1. Go to your main app
2. Use the signup endpoint to create a new account
3. Manually update the role in the database:

```sql
UPDATE customer_accounts
SET role = 'delivery_boy'
WHERE phone_number = '1234567890';

-- Also add to user_roles table
INSERT INTO user_roles (phone_number, name, role)
VALUES ('1234567890', 'Test Delivery Boy', 'delivery_boy')
ON CONFLICT (phone_number) DO UPDATE SET role = 'delivery_boy';
```

**Option B: Using SQL directly (if you have the password hashing setup)**
```sql
-- First, generate a password hash using your main app's login API
-- or manually using Node.js:
-- const crypto = require('crypto');
-- const salt = crypto.randomBytes(16).toString('hex');
-- const hash = crypto.pbkdf2Sync('your_password', salt, 10000, 64, 'sha512').toString('hex');

INSERT INTO customer_accounts (phone_number, name, password_hash, password_salt, role)
VALUES ('1234567890', 'Test Delivery Boy', 'generated_hash', 'generated_salt', 'delivery_boy');
```

### Step 4: Assign Test Orders to Delivery Boy

To test the portal, you need to assign some orders:

```sql
-- Get the delivery boy ID
SELECT id FROM customer_accounts WHERE phone_number = '1234567890';

-- Assign orders to delivery boy (replace {delivery_boy_id} with the ID from above)
UPDATE orders
SET
  delivery_boy_id = '{delivery_boy_id}',
  assigned_at = NOW(),
  order_status = 'Confirmed'
WHERE
  delivery_date >= CURRENT_DATE
  AND delivery_boy_id IS NULL
LIMIT 5;
```

### Step 5: Start the Development Server

```bash
npm run dev
```

The portal will be available at: `http://localhost:3001`

### Step 6: Test Login

1. Navigate to `http://localhost:3001`
2. You'll be redirected to the login page
3. Enter credentials:
   - Phone: `1234567890` (or your test delivery boy's phone)
   - Password: The password you set for this account
4. Click "Login"
5. You should see the dashboard with assigned deliveries

## Testing the Flow

### As Admin (in main portal):
1. Create orders for customers
2. Use the admin API to assign orders to delivery boys:
   ```javascript
   POST /api/admin/assign-delivery
   {
     phone: "admin_phone",
     session: "admin_session",
     orderIds: ["order_id_1", "order_id_2"],
     deliveryBoyId: "delivery_boy_id"
   }
   ```

### As Delivery Boy (in this portal):
1. Login at `http://localhost:3001/login`
2. View assigned deliveries on the dashboard
3. Filter by date if needed
4. Click "Out for Delivery" when starting delivery
5. Click "Mark Delivered" when completed
6. See updated statistics

## Troubleshooting

### "Invalid session" error
- Check that environment variables are correctly set
- Verify the session token is being stored in localStorage
- Check that the user has `role = 'delivery_boy'` in the database

### "No deliveries assigned"
- Verify orders are assigned to the logged-in delivery boy
- Check the `delivery_boy_id` field in the orders table
- Try using the "Show All" button to see future deliveries

### "Failed to connect to server"
- Verify the API routes are accessible
- Check browser console for errors
- Ensure Supabase credentials are correct

### Database connection errors
- Verify Supabase URL and keys in `.env.local`
- Check that RLS policies are properly configured
- Ensure the delivery boy account exists in customer_accounts

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set environment variables in your hosting platform

3. Deploy to:
   - Vercel (recommended for Next.js)
   - Railway
   - DigitalOcean App Platform
   - Or any Node.js hosting

4. Configure custom domain if needed

5. Update CORS settings in Supabase if deployed to different domain

## Next Steps

- Add push notifications for new assignments
- Implement route optimization
- Add delivery photo proof feature
- Create admin UI for assignment management
- Add real-time order tracking
- Implement delivery boy performance metrics
