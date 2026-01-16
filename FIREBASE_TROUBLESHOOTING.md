# Firebase Authentication Troubleshooting

## Issues Fixed

### ✅ reCAPTCHA "recaptcha is not defined" Error

**Problem:** Firebase reCAPTCHA was not initializing properly, causing network errors.

**Solution:**
1. Created centralized Firebase config in `/lib/firebase.js`
2. Fixed Firebase initialization to prevent multiple instances
3. Added proper cleanup on component unmount
4. Fixed reCAPTCHA verifier setup with error handling

### Changes Made:

**Created `/lib/firebase.js`:**
```javascript
// Centralized Firebase initialization
// Prevents multiple Firebase app instances
// Single auth instance shared across components
```

**Updated Signup & Forgot Password Pages:**
- Proper Firebase import structure
- useEffect cleanup for reCAPTCHA
- Better error handling
- Console logging for debugging

## Testing Firebase Phone Authentication

### Prerequisites:

1. **Firebase Console Setup:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select project `kcal-83641`
   - Navigate to **Authentication** → **Sign-in method**
   - Enable **Phone** authentication if not already enabled

2. **Add Test Phone Numbers (For Development):**
   - In Firebase Console → Authentication → Sign-in method → Phone
   - Scroll to "Phone numbers for testing"
   - Add test number: `+911234567890` with OTP: `123456`
   - This allows testing without SMS charges

3. **Authorized Domains:**
   - Ensure `localhost` is in authorized domains list
   - For production, add your domain

### Test Signup Flow:

1. Navigate to http://localhost:3005/signup
2. Enter name and phone number
3. Click "Send OTP"
4. **Check browser console for logs:**
   - "Sending OTP to: +91XXXXXXXXXX"
   - "OTP sent successfully"
5. If using test number, enter test OTP: `123456`
6. Otherwise, check SMS for OTP
7. Enter OTP and verify
8. Create password
9. Account should be created

### Common Issues & Solutions:

#### 1. "reCAPTCHA verification failed"
**Cause:** Domain not authorized or reCAPTCHA quota exceeded
**Fix:**
- Check Firebase Console → Authentication → Settings → Authorized domains
- Add `localhost` if missing
- Clear browser cache and cookies
- Try incognito/private browsing mode

#### 2. "Network error" or "Failed to load resource"
**Cause:** Firebase API keys not properly loaded
**Fix:**
- Verify `.env.local` has all Firebase variables
- Restart dev server: `npm run dev`
- Check browser network tab for blocked requests

#### 3. OTP not received
**Cause:** SMS service not configured or test number not added
**Fix:**
- Add test phone number in Firebase Console
- For production, configure SMS provider in Firebase
- Check Firebase usage limits

#### 4. "Firebase app already exists"
**Cause:** Multiple Firebase initializations
**Fix:** ✅ Already fixed with centralized `/lib/firebase.js`

#### 5. "auth/invalid-phone-number"
**Cause:** Phone number format incorrect
**Fix:**
- Ensure format: `+91` prefix for India
- 10-digit number after country code
- No spaces or special characters

#### 6. "auth/too-many-requests"
**Cause:** Too many OTP attempts from same IP/device
**Fix:**
- Wait 30-60 minutes
- Use different browser/device
- Use Firebase test phone numbers

## Debugging Tips:

### Enable Verbose Logging:

Open browser console and check for:
- "Sending OTP to: ..." - Confirms OTP request sent
- "OTP sent successfully" - Confirms Firebase response
- "reCAPTCHA solved" - Confirms reCAPTCHA passed
- "OTP verified successfully" - Confirms OTP verification

### Check Network Tab:

1. Open DevTools → Network tab
2. Look for requests to:
   - `identitytoolkit.googleapis.com` - Firebase Auth API
   - `www.google.com/recaptcha` - reCAPTCHA
3. Check response status (should be 200)
4. Check response body for errors

### Firebase Console Logs:

1. Go to Firebase Console
2. Navigate to **Authentication** → **Users**
3. Check if user appears after signup
4. Check **Authentication** → **Usage** for quota limits

## Production Considerations:

### Before Going Live:

1. **SMS Provider:**
   - Firebase phone auth costs $0.06 per verification (after free tier)
   - Free tier: 10,000 verifications/month
   - Consider alternative: WhatsApp Business API, Twilio

2. **Security:**
   - Enable App Check in Firebase
   - Set up abuse prevention
   - Monitor authentication logs
   - Implement rate limiting

3. **User Experience:**
   - Add retry mechanism for failed OTPs
   - Show clear error messages
   - Add "Resend OTP" button (with cooldown)
   - Support multiple auth methods

4. **Monitoring:**
   - Set up Firebase Analytics
   - Monitor authentication success/failure rates
   - Track SMS costs
   - Alert on unusual activity

## Alternative: Use Existing MSG91 Integration

If Firebase phone auth is causing issues, you can switch to MSG91 (already configured in main project):

```javascript
// Use MSG91 API instead of Firebase
const response = await fetch('/api/auth/send-otp-msg91', {
  method: 'POST',
  body: JSON.stringify({ phone })
})
```

**Pros:**
- Already integrated in main project
- No reCAPTCHA needed
- Direct SMS control
- Potentially lower cost

**Cons:**
- Need to build OTP verification logic
- Manual OTP storage and expiry
- Security implementation needed

## Current Status:

✅ Firebase initialized properly
✅ reCAPTCHA setup fixed
✅ Signup flow ready
✅ Forgot password ready
✅ Error handling implemented
✅ Console logging for debugging

## Next Steps:

1. Test signup with real phone number
2. Test forgot password flow
3. Monitor Firebase usage
4. Implement "Resend OTP" functionality
5. Add OTP expiry timer UI
6. Implement rate limiting

## Support:

If issues persist:
1. Check browser console for errors
2. Check Firebase Console logs
3. Verify environment variables
4. Test with Firebase test phone numbers
5. Try different browser/device
