# 🚀 Quick Start Guide

Get your delivery portal running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js installed (v18 or higher)
- [ ] Access to main 500kcal.fit project
- [ ] Access to Supabase dashboard
- [ ] Database admin access

## 5-Minute Setup

### Step 1: Configure Environment (1 min)

Copy Supabase credentials from your main project to `.env.local`:

```bash
# From /Users/vaibhavprakashchhajed/500kcal.fit/.env.local
# Copy these three values to this project's .env.local

NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
```

### Step 2: Update Database (1 min)

Run in Supabase SQL Editor:

```sql
-- Add delivery tracking columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES customer_accounts(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);
```

### Step 3: Create Test Account (2 min)

Generate password hash:
```bash
node scripts/generate-password.js testpass123
```

Copy the SQL output and run it in Supabase (replace phone number and name):
```sql
INSERT INTO customer_accounts (phone_number, name, password_hash, password_salt, role)
VALUES ('1234567890', 'Test Delivery', 'HASH_FROM_SCRIPT', 'SALT_FROM_SCRIPT', 'delivery_boy');

INSERT INTO user_roles (phone_number, name, role)
VALUES ('1234567890', 'Test Delivery', 'delivery_boy');
```

### Step 4: Assign Test Orders (1 min)

```sql
-- Get delivery boy ID
SELECT id FROM customer_accounts WHERE phone_number = '1234567890';

-- Assign some orders (replace {ID} with actual ID)
UPDATE orders
SET delivery_boy_id = '{ID}', assigned_at = NOW(), order_status = 'Confirmed'
WHERE delivery_date >= CURRENT_DATE AND delivery_boy_id IS NULL
LIMIT 5;
```

### Step 5: Launch! (30 sec)

```bash
npm run dev
```

Visit: **http://localhost:3001**

Login:
- Phone: `1234567890`
- Password: `testpass123`

---

## ✅ Success Checklist

After login, you should see:
- [ ] Dashboard with statistics
- [ ] List of assigned deliveries
- [ ] Customer names and addresses
- [ ] "Out for Delivery" and "Mark Delivered" buttons

## 🔧 Troubleshooting

**"Invalid session"**
- Check `.env.local` has correct Supabase credentials
- Verify role is `delivery_boy` in database

**"No deliveries"**
- Run the assign orders SQL again
- Click "Show All" button
- Check date filter is correct

**"Failed to connect"**
- Verify `npm install` completed successfully
- Check Supabase URL is correct
- Ensure database is accessible

## 📱 Test the Full Flow

1. **Login** → Dashboard loads ✅
2. **View Deliveries** → See assigned orders ✅
3. **Click "Out for Delivery"** → Status updates ✅
4. **Click "Mark Delivered"** → Completed count increases ✅
5. **Change date filter** → See different orders ✅

## 🎯 Next Steps

Once everything works:

1. **Create Real Accounts**
   ```bash
   node scripts/generate-password.js actual_password
   ```

2. **Update Main Portal**
   - Add admin UI for assignment
   - Use APIs in `/api/admin/assign-delivery`

3. **Deploy to Production**
   - Push to GitHub
   - Deploy on Vercel
   - Set environment variables
   - Configure custom domain

4. **Train Delivery Team**
   - Show them the login page
   - Demonstrate status updates
   - Explain the workflow

## 📚 Documentation

- `README.md` - Full documentation
- `SETUP_GUIDE.md` - Detailed setup instructions
- `PROJECT_SUMMARY.md` - Architecture and features

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review `SETUP_GUIDE.md` for detailed steps
3. Check browser console for errors
4. Verify all SQL commands executed successfully
5. Ensure all environment variables are set

---

**That's it! Your delivery portal is ready to use.** 🎉
