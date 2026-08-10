# 500Kcal.fit - Delivery Portal

A standalone delivery management portal for 500Kcal.fit delivery personnel.

## Features

- Secure login for delivery personnel only.
- Real-time delivery list with customer details
- Status tracking (Out for Delivery, Delivered)
- Daily and monthly statistics dashboard
- Date filtering and search
- Mobile-responsive design

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the environment variables from your main 500kcal.fit project to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Update Database Schema

Apply the following schema changes to your database (already in the main project's `complete_database_schema.sql`):

```sql
-- Add delivery tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES customer_accounts(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);

-- Add RLS policies for delivery boys
DROP POLICY IF EXISTS "Delivery boys can view assigned orders" ON orders;
CREATE POLICY "Delivery boys can view assigned orders" ON orders
    FOR SELECT USING (
        delivery_boy_id IN (
            SELECT id FROM customer_accounts
            WHERE phone_number = current_setting('app.current_user_phone', true)
            AND role = 'delivery_boy'
        )
    );

DROP POLICY IF EXISTS "Delivery boys can update assigned orders" ON orders;
CREATE POLICY "Delivery boys can update assigned orders" ON orders
    FOR UPDATE USING (
        delivery_boy_id IN (
            SELECT id FROM customer_accounts
            WHERE phone_number = current_setting('app.current_user_phone', true)
            AND role = 'delivery_boy'
        )
    );
```

### 4. Create Delivery Boy Account

Create a delivery boy account in your main application's `user_roles` and `customer_accounts` tables:

```sql
-- Add to user_roles table
INSERT INTO user_roles (phone_number, name, role)
VALUES ('1234567890', 'Test Delivery Boy', 'delivery_boy');

-- Create account with password
-- Note: Use your main app's signup API to create the account with proper password hashing
```

### 5. Run Development Server

```bash
npm run dev
```

The portal will run on `http://localhost:3001`

### 6. Login

Use the delivery boy credentials:
- Phone: The phone number you registered
- Password: The password you set

## Project Structure

```
500kcal.fit-deliveries/
├── app/
│   ├── api/
│   │   ├── auth/login/         # Authentication endpoint
│   │   └── deliveries/         # Delivery data endpoints
│   ├── dashboard/              # Main delivery dashboard
│   ├── login/                  # Login page
│   ├── globals.css             # Global styles
│   ├── layout.js               # Root layout
│   └── page.js                 # Home page (redirects)
├── lib/
│   └── supabase.js            # Supabase client setup
├── package.json
├── next.config.js
└── .env.local                 # Environment variables (not in git)
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login for delivery personnel

### Deliveries
- `GET /api/deliveries` - Get assigned deliveries (with optional date filter)
- `POST /api/deliveries/update-status` - Update delivery status

## Admin Integration

To assign deliveries to delivery boys from your main portal, use the admin API endpoints in the main project:

```javascript
// Get list of delivery boys
GET /api/admin/assign-delivery?phone={admin_phone}&session={admin_session}

// Assign orders to delivery boy
POST /api/admin/assign-delivery
{
  phone: admin_phone,
  session: admin_session,
  orderIds: [order_id_1, order_id_2],
  deliveryBoyId: delivery_boy_id
}

// Get orders (with filters)
GET /api/admin/orders?phone={admin_phone}&session={admin_session}&unassigned=true&date=2024-01-20
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment

Make sure to set all environment variables in your production environment.

### Port Configuration

The portal runs on port 3001 by default. Change this in `package.json` if needed:

```json
"scripts": {
  "dev": "next dev -p 3001"
}
```

## Security Notes

- Only users with `role = 'delivery_boy'` can access this portal
- All API endpoints verify session tokens
- Delivery boys can only view and update their assigned orders
- Session tokens are stored in localStorage
- RLS policies enforce data access control at database level

## Support

For issues or questions, contact the system administrator.
