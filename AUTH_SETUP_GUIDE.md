# Authentication & Photo Upload Setup Guide

## Overview

The delivery portal now includes:
- ✅ **Phone Authentication with OTP** (Firebase)
- ✅ **Signup Flow** - New delivery personnel can create accounts
- ✅ **Login with Phone + Password**
- ✅ **Forgot Password** - Reset password with phone verification
- ✅ **Photo Upload** - Mandatory delivery proof photos
- ✅ **Supabase Storage** - For delivery photos

## Database Schema Updates

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Add photo URL column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;

-- Create storage bucket for delivery photos (if not exists)
-- Note: This is done via Supabase Dashboard → Storage → New Bucket
```

## Supabase Storage Setup

### Step 1: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Bucket name: `delivery-photos`
4. Make it **Public** (so delivery photos can be viewed)
5. Click "Create bucket"

### Step 2: Set Storage Policies

1. Click on the `delivery-photos` bucket
2. Go to "Policies" tab
3. Add these policies:

**Policy 1: Allow authenticated delivery boys to upload**
```sql
CREATE POLICY "Delivery boys can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos' AND
  auth.uid() IN (
    SELECT id::text FROM customer_accounts WHERE role = 'delivery_boy'
  )
);
```

**Policy 2: Allow public read access**
```sql
CREATE POLICY "Anyone can view delivery photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'delivery-photos');
```

## Firebase Configuration

Your Firebase config is already set up in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCrZBZKvkqzoKtYIv8gDtG3HciQfESlHmY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kcal-83641.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kcal-83641
# ... etc
```

### Enable Phone Authentication in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`kcal-83641`)
3. Go to **Authentication** → **Sign-in method**
4. Enable **Phone** authentication
5. Add your domain to authorized domains:
   - `localhost` (for development)
   - Your production domain (e.g., `delivery.500kcal.fit`)

## New Features

### 1. Signup Flow (`/signup`)

**Flow:**
1. Enter name and phone number
2. Receive OTP via SMS (Firebase)
3. Verify OTP
4. Create password
5. Account created with `delivery_boy` role
6. Auto-login to dashboard

**API Endpoint:**
- `POST /api/auth/signup/create-account`

### 2. Login (`/login`)

**Standard login:**
- Phone + Password authentication
- Session token stored in localStorage

**Links:**
- "Forgot Password?" → `/forgot-password`
- "Sign Up" → `/signup`

### 3. Forgot Password (`/forgot-password`)

**Flow:**
1. Enter phone number
2. Verify account exists with `delivery_boy` role
3. Receive OTP via SMS
4. Verify OTP
5. Create new password
6. Redirect to login

**API Endpoints:**
- `GET /api/auth/check-account?phone={phone}`
- `POST /api/auth/forgot-password/reset`

### 4. Photo Upload on Delivery

**When marking as delivered:**
1. Click "Mark Delivered"
2. Photo upload modal opens
3. Take or select photo (max 5MB)
4. Preview photo
5. Click "Confirm & Mark Delivered"
6. Photo uploads to Supabase Storage
7. Order status updates to "Delivered"
8. Photo URL saved in `orders.delivery_photo_url`

**API Endpoint:**
- `POST /api/deliveries/upload-photo`

**Features:**
- Mobile camera access (`capture="environment"`)
- 5MB file size limit
- Image format validation
- Preview before upload
- Photo visible in delivery history

## Testing the Flow

### Test Signup

1. Navigate to http://localhost:3005/signup
2. Enter test name: "Test Delivery Boy"
3. Enter test phone: "YOUR_PHONE_NUMBER"
4. Click "Send OTP"
5. Enter OTP from SMS
6. Click "Verify OTP"
7. Create password: "test123"
8. Confirm password: "test123"
9. Click "Create Account"
10. Should redirect to dashboard

### Test Login

1. Navigate to http://localhost:3005/login
2. Enter phone and password
3. Click "Login"
4. Should see dashboard

### Test Forgot Password

1. Navigate to http://localhost:3005/forgot-password
2. Enter registered phone number
3. Receive OTP
4. Enter OTP
5. Create new password
6. Should redirect to login

### Test Photo Upload

1. Login to dashboard
2. Find a delivery with status "Out for Delivery"
3. Click "Mark Delivered"
4. Photo modal opens
5. Click "Take or Select Photo"
6. Select/capture photo
7. See preview
8. Click "Confirm & Mark Delivered"
9. Photo uploads and order marked delivered
10. Refresh - see "View Photo" link in delivery details

## Important Notes

### Security

- All photos are stored in public Supabase Storage bucket
- Only delivery boys can upload photos
- Photos are accessible via public URL
- Session tokens validated on all API calls

### Firebase Phone Auth

- Requires test phone numbers in Firebase Console for testing
- SMS charges may apply in production
- Consider adding test mode phone numbers for development

### Photo Storage

- Photos stored in `delivery-photos/` bucket
- File naming: `{order-id}-{timestamp}.{extension}`
- No automatic cleanup (implement later if needed)

### Mobile Optimization

- Camera access: `capture="environment"` for rear camera
- Touch-friendly UI
- Responsive design for all screen sizes

## Troubleshooting

### "reCAPTCHA failed" error
- Check Firebase authorized domains
- Ensure localhost is allowed
- Clear browser cache

### "Failed to upload photo"
- Check Supabase storage bucket exists
- Verify bucket is public
- Check storage policies
- Ensure file size < 5MB

### OTP not received
- Check Firebase phone authentication is enabled
- Verify phone number format (+91 for India)
- Check Firebase Console → Authentication → Users for test accounts
- Add test phone numbers in Firebase Console for development

### "Account not found"
- User must signup first
- Check `customer_accounts` table for account
- Verify role is set to `delivery_boy`

## Production Deployment

### Before Deploying:

1. **Firebase Setup:**
   - Add production domain to authorized domains
   - Configure SMS provider settings
   - Review Firebase quotas and pricing

2. **Supabase Storage:**
   - Verify storage bucket is public
   - Check storage policies
   - Review storage limits

3. **Environment Variables:**
   - Set all Firebase variables
   - Set Supabase variables
   - Test in staging environment

4. **Testing:**
   - Test complete signup flow
   - Test forgot password
   - Test photo upload
   - Test on mobile devices

### After Deployment:

- Monitor Firebase authentication logs
- Monitor Supabase storage usage
- Check error logs for failed uploads
- Test with real delivery personnel

## Cost Considerations

### Firebase:
- **Phone Authentication**: $0.06 per verification (after free tier)
- **Free Tier**: 10,000 verifications/month

### Supabase:
- **Storage**: First 1GB free
- **Bandwidth**: First 2GB free
- Check pricing for overages

## Future Enhancements

- [ ] Photo compression before upload
- [ ] Multiple photos per delivery
- [ ] Geolocation tagging
- [ ] Automatic photo cleanup (old photos)
- [ ] WhatsApp OTP integration
- [ ] Biometric authentication
- [ ] Offline photo queue

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Check Firebase authentication logs
4. Verify all environment variables are set
5. Test API endpoints with Postman/Insomnia
