# URGENT: Firebase Phone Authentication Setup Required

## Current Issue

**Error:** `auth/invalid-app-credential`

**Cause:** Firebase Phone Authentication is not properly configured in Firebase Console

## Required Steps to Fix

### Step 1: Enable Phone Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/project/kcal-83641)
2. Click on **Authentication** in the left sidebar
3. Click on **Sign-in method** tab
4. Find **Phone** in the list of providers
5. Click on **Phone**
6. Toggle **Enable** to ON
7. Click **Save**

### Step 2: Add Authorized Domains

1. Still in **Authentication** → **Settings** tab
2. Scroll to **Authorized domains**
3. Ensure these domains are listed:
   - `localhost` (for development)
   - Your production domain (when deploying)

If `localhost` is missing:
1. Click **Add domain**
2. Enter: `localhost`
3. Click **Add**

### Step 3: Configure reCAPTCHA (IMPORTANT!)

Firebase Phone Auth requires reCAPTCHA configuration:

1. In Firebase Console → **Authentication** → **Settings**
2. Scroll to **Phone** section
3. You'll see **App verification** settings

**For Development/Testing:**
- Add test phone numbers (no SMS cost, instant verification)
- Phone numbers for testing: `+911234567890`
- Test verification code: `123456`

**For Production:**
- reCAPTCHA will work automatically
- SMS will be sent to real numbers
- Costs: $0.06 per verification (after free tier of 10,000/month)

### Step 4: Add Test Phone Numbers (Recommended for Development)

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to bottom → **Phone numbers for testing**
3. Click **Add phone number**
4. Enter:
   - Phone number: `+911234567890`
   - SMS verification code: `123456`
5. Click **Add**

Now you can test with:
- Phone: `1234567890`
- OTP: `123456`
- No SMS will be sent (saves cost)

### Step 5: Verify Firebase Project Settings

1. In Firebase Console, click on **Project settings** (gear icon)
2. Verify your project ID is: `kcal-83641`
3. Check **General** tab:
   - Make sure project is active
   - Check Web API Key matches your `.env.local`

### Step 6: Enable Firebase Authentication API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `kcal-83641`
3. Go to **APIs & Services** → **Library**
4. Search for "**Identity Toolkit API**"
5. Click on it and ensure it's **ENABLED**
6. Also search for "**Firebase Authentication**"
7. Ensure it's **ENABLED**

## Changes Made to Fix reCAPTCHA

✅ Added reCAPTCHA script to layout
✅ Changed reCAPTCHA size from 'invisible' to 'normal' (visible checkbox)
✅ Added proper error handling
✅ reCAPTCHA now renders visibly on signup page

## Testing After Setup

1. Refresh http://localhost:3005/signup
2. Fill in name and phone number
3. You should see a **reCAPTCHA checkbox**
4. Check the box
5. Click "Send OTP"
6. If using test number (+911234567890), enter OTP: 123456
7. If using real number, enter OTP from SMS

## Verification Checklist

Before testing, ensure:
- [ ] Phone authentication is ENABLED in Firebase Console
- [ ] `localhost` is in authorized domains
- [ ] Test phone number added (optional but recommended)
- [ ] Identity Toolkit API is enabled
- [ ] Firebase Authentication API is enabled
- [ ] Project ID matches: `kcal-83641`
- [ ] API keys in `.env.local` are correct

## Alternative: Use MSG91 Instead

If Firebase setup is too complex, we can switch to MSG91 (already configured in main project):

**Pros:**
- Already set up
- No Firebase dependencies
- Direct SMS control
- Lower cost potentially

**Cons:**
- Need custom OTP logic
- More code to maintain

Let me know if you want to switch to MSG91!

## Current Status

🔴 **Firebase Phone Auth NOT configured**
⚠️ **Action Required:** Complete steps above
⏱️ **Time needed:** 5-10 minutes

Once configured, the signup and forgot password flows will work perfectly!

## Support

If you need help with Firebase setup:
1. Check Firebase Console error messages
2. Verify all steps above are completed
3. Check browser console for detailed errors
4. Try with test phone number first
