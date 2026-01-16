# Hardcoded Test Users - Temporary Login Credentials

## Overview

Two test users have been hardcoded into the system for immediate testing without requiring Firebase Phone Authentication or database setup. These credentials will be removed once the Firebase authentication is properly configured.

## Test User Credentials

### User 1:
- **Phone Number:** `8087406269`
- **Password:** `123456` (6 digits)
- **Name:** Test Delivery Boy 1
- **User ID:** `hardcoded-user-1`

### User 2:
- **Phone Number:** `9730425526`
- **Password:** `12345` (5 digits)
- **Name:** Test Delivery Boy 2
- **User ID:** `hardcoded-user-2`

## How to Login

1. Navigate to: http://localhost:3005/login
2. Enter phone number (without country code):
   - `8087406269` OR
   - `9730425526`
3. Enter password:
   - `123456` (for first user) OR
   - `12345` (for second user)
4. Click "Login"
5. You'll be redirected to the dashboard

## Implementation Details

### Files Modified:

#### 1. `/app/api/auth/login/route.js`
Added hardcoded user check before database query:

```javascript
const HARDCODED_USERS = [
  {
    phone: '8087406269',
    password: '123456',
    name: 'Test Delivery Boy 1',
    id: 'hardcoded-user-1'
  },
  {
    phone: '9730425526',
    password: '12345',
    name: 'Test Delivery Boy 2',
    id: 'hardcoded-user-2'
  }
]
```

The login flow:
1. First checks if the phone number matches a hardcoded user
2. If yes, validates password directly (no hashing)
3. If no match, falls back to database authentication with password hashing

#### 2. `/app/api/deliveries/route.js`
Added support for hardcoded user IDs:

```javascript
const HARDCODED_USER_IDS = ['hardcoded-user-1', 'hardcoded-user-2']
```

The deliveries fetch flow:
1. Checks if the request includes a hardcoded user ID
2. If yes, skips database session validation
3. If no, performs normal database session verification

#### 3. `/app/dashboard/page.js`
Updated to pass user ID parameter when fetching deliveries:

```javascript
const idParam = localStorage.getItem('deliveryId')
if (idParam) {
  url += `&id=${idParam}`
}
```

## Current Behavior

### Hardcoded Users:
- ✅ Can login immediately with phone + password
- ✅ Session token is generated (random 32-byte hex)
- ✅ User info stored in localStorage
- ✅ Can access dashboard
- ⚠️ Will see empty delivery list (no orders assigned to hardcoded IDs in database)
- ⚠️ Cannot see real delivery data unless orders are manually assigned to these user IDs

### Database Users:
- ✅ Can still login with phone + password
- ✅ Full session validation with database
- ✅ Password is hashed using PBKDF2
- ✅ Role verification (must be 'delivery_boy')
- ✅ Can see assigned deliveries

## Testing the System

### Test Login Flow:
1. Open http://localhost:3005/login
2. Login with hardcoded credentials (see above)
3. Verify redirect to dashboard
4. Check browser console for: "Hardcoded user login successful: Test Delivery Boy X"

### Test Dashboard:
1. Dashboard should load with user name displayed
2. Stats will show zeros (no deliveries assigned)
3. No deliveries will appear in list
4. To test with real data, you need to assign orders to these user IDs in the database

### Test Logout:
1. Click logout button
2. localStorage should be cleared
3. Should redirect to login page

## Adding Real Deliveries for Testing

To assign deliveries to hardcoded users, run this SQL in Supabase:

```sql
-- Assign some existing orders to test user 1
UPDATE orders
SET delivery_boy_id = 'hardcoded-user-1',
    assigned_at = NOW()
WHERE delivery_date >= CURRENT_DATE
AND delivery_boy_id IS NULL
LIMIT 5;

-- Assign some existing orders to test user 2
UPDATE orders
SET delivery_boy_id = 'hardcoded-user-2',
    assigned_at = NOW()
WHERE delivery_date >= CURRENT_DATE
AND delivery_boy_id IS NULL
LIMIT 5;
```

**Note:** The `delivery_boy_id` field in orders table expects a UUID, but we're using string IDs for hardcoded users. This works in PostgreSQL but may need to be addressed when moving to production.

## Removing Hardcoded Users Later

When Firebase Phone Authentication is fully configured and working:

### Step 1: Remove from Login API
In `/app/api/auth/login/route.js`:
- Remove the `HARDCODED_USERS` array
- Remove the hardcoded user check logic
- Keep only the database authentication flow

### Step 2: Remove from Deliveries API
In `/app/api/deliveries/route.js`:
- Remove the `HARDCODED_USER_IDS` array
- Remove the hardcoded ID check logic
- Keep only the database session verification

### Step 3: Clean Up Dashboard
In `/app/dashboard/page.js`:
- The `id` parameter will still work for database users
- No changes needed

### Step 4: Delete This Document
- Remove `HARDCODED_TEST_USERS.md` from the project

## Security Notes

⚠️ **IMPORTANT SECURITY CONSIDERATIONS:**

1. **Passwords are NOT hashed** for hardcoded users (stored in plain text in code)
2. **No session persistence** - sessions are only in memory, not stored in database
3. **No role verification** - hardcoded users bypass all security checks
4. **User IDs are strings** instead of UUIDs (may cause issues with foreign key constraints)
5. **These credentials are visible in source code** - never deploy to production with hardcoded users

### Before Production Deployment:
- [ ] Remove all hardcoded user logic
- [ ] Verify Firebase Phone Authentication is working
- [ ] Test real user signup flow
- [ ] Test real user login flow
- [ ] Test delivery assignment to real users
- [ ] Verify all security checks are in place
- [ ] Review all authentication/authorization code
- [ ] Remove this documentation file

## Current Status

✅ Hardcoded users implemented
✅ Login working with hardcoded credentials
✅ Dashboard accessible with hardcoded sessions
⚠️ No real delivery data (empty list)
⚠️ Firebase Phone Auth still needs to be enabled in Firebase Console
⚠️ These users are **TEMPORARY** and must be removed before production

---

**Last Updated:** 2026-01-16
**Status:** Temporary testing solution - DO NOT DEPLOY TO PRODUCTION
