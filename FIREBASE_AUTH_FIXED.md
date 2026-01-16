# Firebase Authentication Implementation - FIXED

## What We Fixed

### 1. Updated Firebase Configuration (`/lib/firebase.js`)
✅ Changed from environment variable-based config to hardcoded credentials (same as main project)
✅ Removed the `getApps()` check - using direct initialization like main project
✅ Simplified export pattern to match working implementation

**Before:**
```javascript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // ... from environment variables
}
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
```

**After (Now matches main project exactly):**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCrZBZKvkqzoKtYIv8gDtG3HciQfESlHmY",
  authDomain: "kcal-83641.firebaseapp.com",
  projectId: "kcal-83641",
  // ... hardcoded like main project
}
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
auth.useDeviceLanguage()
```

### 2. Improved reCAPTCHA Implementation (Signup & Forgot Password)
✅ Changed from 'normal' (visible) back to 'invisible' reCAPTCHA (matches main project pattern)
✅ Added comprehensive error callbacks with user-friendly messages
✅ Added proper cleanup on reCAPTCHA expiry
✅ Improved error logging for debugging
✅ Added detailed error messages for specific Firebase error codes

**Key Changes:**
```javascript
const setupRecaptcha = () => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',  // Changed from 'normal'
      callback: (response) => {
        console.log('reCAPTCHA solved:', response)
      },
      'expired-callback': () => {
        // Proper cleanup
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear()
          } catch (e) {
            console.error('Error clearing expired reCAPTCHA:', e)
          }
          window.recaptchaVerifier = null
        }
      },
      'error-callback': (error) => {
        console.error('reCAPTCHA error callback:', error)
        setError('reCAPTCHA verification failed. Please refresh the page.')
      }
    })
  }
}
```

### 3. Enhanced Error Handling
✅ Added specific error messages for all common Firebase error codes:
- `auth/invalid-app-credential` → "Firebase Phone Authentication is not enabled"
- `auth/too-many-requests` → "Too many requests. Please try again later"
- `auth/invalid-phone-number` → "Invalid phone number format"
- `auth/quota-exceeded` → "SMS quota exceeded. Please try again later"

✅ Added detailed console logging for debugging:
```javascript
console.error('Error sending OTP:', err)
console.error('Error code:', err.code)
console.error('Error message:', err.message)
```

### 4. Removed Manual reCAPTCHA Rendering
✅ Removed the `.render()` call that was causing issues
✅ Firebase handles reCAPTCHA rendering automatically with `signInWithPhoneNumber()`
✅ Simplified the reCAPTCHA container placement

## Current Implementation Status

### ✅ What's Working:
1. Firebase initialization matches the main project exactly
2. reCAPTCHA setup matches AuthContext pattern from main project
3. Proper error handling and cleanup
4. Detailed logging for debugging
5. User-friendly error messages

### ⚠️ What Still Needs Firebase Console Setup:

**IMPORTANT:** The code is now correct, but Firebase Phone Authentication must be enabled in Firebase Console.

## Required Firebase Console Configuration

### Step 1: Enable Phone Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/project/kcal-83641/authentication/providers)
2. Click on **Authentication** → **Sign-in method**
3. Find **Phone** in the list of providers
4. Click on **Phone** and toggle **Enable** to ON
5. Click **Save**

### Step 2: Verify Authorized Domains
1. Go to **Authentication** → **Settings** tab
2. Scroll to **Authorized domains**
3. Ensure these domains are listed:
   - `localhost` ✅ (for development)
   - Your production domain (when deploying)

If `localhost` is missing:
1. Click **Add domain**
2. Enter: `localhost`
3. Click **Add**

### Step 3: Add Test Phone Numbers (Optional but Recommended)
For development/testing without SMS costs:

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **Phone numbers for testing**
3. Click **Add phone number**
4. Add test numbers:
   - Phone: `+911234567890`
   - OTP: `123456`
5. Click **Add**

### Step 4: Verify Identity Toolkit API is Enabled
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `kcal-83641`
3. Go to **APIs & Services** → **Library**
4. Search for "**Identity Toolkit API**"
5. Ensure it's **ENABLED**

## Testing After Firebase Console Setup

### Test with Test Phone Number (No SMS Cost):
1. Navigate to http://localhost:3005/signup
2. Enter name: `Test User`
3. Enter phone: `1234567890` (without +91)
4. Click "Send OTP"
5. reCAPTCHA will appear (invisible, no checkbox needed)
6. Enter OTP: `123456`
7. Create password
8. Account should be created successfully

### Test with Real Phone Number:
1. Navigate to http://localhost:3005/signup
2. Enter your name
3. Enter your 10-digit phone number
4. Click "Send OTP"
5. reCAPTCHA will verify automatically
6. Check your phone for SMS with OTP
7. Enter the OTP received
8. Create password
9. Account created!

## Browser Console Logs to Expect

### Successful Flow:
```
Setting up reCAPTCHA verifier...
reCAPTCHA verifier created successfully
Initializing reCAPTCHA...
Sending OTP to: +91XXXXXXXXXX
reCAPTCHA solved: <token>
OTP sent successfully!
```

### If Phone Auth Not Enabled:
```
Error sending OTP: FirebaseError: Firebase: Error (auth/invalid-app-credential).
Error code: auth/invalid-app-credential
Error message: Firebase: Error (auth/invalid-app-credential).
```
**Solution:** Enable Phone Authentication in Firebase Console (see Step 1 above)

## Comparison with Main Project

| Feature | Main Project (500kcal.fit) | Delivery Portal (500kcal.fit-deliveries) |
|---------|---------------------------|------------------------------------------|
| Firebase Config | Hardcoded credentials | ✅ Now hardcoded (same credentials) |
| reCAPTCHA Size | invisible | ✅ Now invisible |
| Error Handling | Timeout safety, detailed errors | ✅ Now has detailed errors |
| Auth Pattern | Context-based with hooks | Direct Firebase calls (simpler for portal) |
| Phone Format | +91XXXXXXXXXX | ✅ Same format |
| useDeviceLanguage | ✅ Enabled | ✅ Now enabled |

## Key Differences from Main Project

The main project uses a React Context (`AuthContext.tsx`) with TypeScript and comprehensive auth methods including:
- Email/Password
- Google Sign-In
- Phone Authentication
- Password Reset
- Account Deletion

The delivery portal has a **simpler implementation** focused only on:
- Phone Authentication for signup
- Phone Authentication for password reset
- Password-based login (after signup)

This is intentional - the delivery portal only needs phone auth, not the full suite of authentication methods.

## Files Modified

1. `/lib/firebase.js` - Firebase configuration updated to match main project
2. `/app/signup/page.js` - Improved reCAPTCHA setup and error handling
3. `/app/forgot-password/page.js` - Improved reCAPTCHA setup and error handling

## Next Steps

1. **Enable Phone Authentication in Firebase Console** (see Step 1 above)
2. Test signup flow with test phone number
3. Test forgot password flow
4. Test with real phone number
5. Deploy to production and add production domain to authorized domains

## Support

If you still see `auth/invalid-app-credential` error after enabling Phone Authentication:
1. Wait 1-2 minutes for Firebase settings to propagate
2. Refresh the browser page completely (Cmd+Shift+R / Ctrl+Shift+R)
3. Clear browser cache
4. Try in incognito/private browsing mode
5. Check Firebase Console → Authentication → Usage to see if requests are being received

## Production Checklist

Before deploying to production:
- [ ] Phone Authentication enabled in Firebase Console
- [ ] Production domain added to authorized domains
- [ ] Test phone numbers removed (or kept for staging environment)
- [ ] SMS quota limits configured
- [ ] Monitoring and alerts set up for authentication failures
- [ ] Rate limiting implemented on backend APIs

---

**Status:** Code is fixed and matches working implementation. Only Firebase Console configuration remains.
