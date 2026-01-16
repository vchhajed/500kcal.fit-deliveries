# Vercel Deployment Guide for 500kcal.fit Delivery Portal

## Overview

This guide will help you deploy the delivery portal to Vercel with proper configuration for environment variables and production settings.

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- GitHub repository connected to Vercel
- All environment variables ready

## Files Created for Deployment

### 1. `vercel.json`
Configuration file for Vercel deployment:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 2. `public/` Directory
Created with `robots.txt` to satisfy Vercel's requirements and provide SEO configuration.

## Environment Variables Setup

**CRITICAL:** You must add all environment variables from `.env.local` to Vercel.

### Required Environment Variables:

#### Firebase Configuration:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCrZBZKvkqzoKtYIv8gDtG3HciQfESlHmY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kcal-83641.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kcal-83641
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kcal-83641.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=232588569886
NEXT_PUBLIC_FIREBASE_APP_ID=1:232588569886:web:e6a1260e9adcc800cbed0f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QZRPHCH386
```

#### Firebase Admin SDK:
```
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kcal-83641.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

#### Supabase Configuration:
```
NEXT_PUBLIC_SUPABASE_URL=https://mcboyeyzneazwgfwvzzx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### PostgreSQL Database:
```
DATABASE_URL=postgresql://postgres:KNCBjSUI9q0WLdED@db.mcboyeyzneazwgfwvzzx.supabase.co:5432/postgres
DATABASE_HOST=db.mcboyeyzneazwgfwvzzx.supabase.co
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=KNCBjSUI9q0WLdED
```

#### MSG91 SMS (Optional):
```
MSG91_AUTH_KEY=486592AylsLHSGD6961033aP1
MSG91_SENDER_ID=500KCL
```

#### Admin Configuration:
```
NEXT_PUBLIC_ALLOWED_ADMIN_EMAIL=vaibhav787845@gmail.com,asthachhajed02@gmail.com
ADMIN_VIEW_KEY=500kcal_admin_2026
```

#### OpenAI (if used):
```
OPENAI_API_KEY=sk-proj-...
```

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. **Import Project:**
   - Go to https://vercel.com/new
   - Select "Import Git Repository"
   - Choose: `vchhajed/500kcal.fit-deliveries`
   - Click "Import"

2. **Configure Project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

3. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add ALL variables from `.env.local` (see list above)
   - **IMPORTANT:** For `FIREBASE_PRIVATE_KEY`, paste the entire key including `\n` newlines
   - Set environment: **Production, Preview, Development** (all three)

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete (2-3 minutes)
   - Deployment URL will be provided (e.g., `500kcal-fit-deliveries.vercel.app`)

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time - will prompt for configuration)
vercel

# Deploy to production
vercel --prod
```

## Post-Deployment Configuration

### 1. Update Firebase Authorized Domains

After deployment, add your Vercel domain to Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/project/kcal-83641)
2. Navigate to **Authentication** → **Settings** → **Authorized domains**
3. Click "Add domain"
4. Add your Vercel domain: `your-project.vercel.app`
5. Click "Add"

### 2. Update Supabase Allowed URLs (if using RLS)

If you have Row Level Security policies:

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add your Vercel domain to allowed URLs

### 3. Test Production Deployment

1. **Visit deployment URL**
2. **Test login page:**
   - Go to `/login`
   - Try hardcoded credentials
   - Verify login works

3. **Test dashboard:**
   - Should load without errors
   - Check if API calls work

4. **Test Firebase Phone Auth (if enabled):**
   - Go to `/signup`
   - Try sending OTP
   - Verify reCAPTCHA works

## Troubleshooting

### Build Fails with "Module not found"

**Solution:** Check that all dependencies are in `package.json`:
```bash
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### Environment Variables Not Working

**Symptoms:** API calls fail, Firebase errors, database connection errors

**Solution:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify ALL variables are added
3. Check for typos in variable names
4. Ensure `NEXT_PUBLIC_` prefix for client-side variables
5. Redeploy after adding/updating variables

### Firebase Phone Auth Not Working in Production

**Solution:**
1. Add Vercel domain to Firebase Authorized Domains
2. Ensure Firebase credentials are correct in Vercel
3. Check browser console for specific errors
4. Verify `NEXT_PUBLIC_FIREBASE_*` variables are set

### Supabase Connection Errors

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not just anon key)
2. Check database connection string is correct
3. Ensure Supabase project is not paused
4. Verify SSL is enabled in connection string

### "Cannot find module" Error for Firebase Admin

**Solution:**
This happens if `FIREBASE_PRIVATE_KEY` has newlines incorrectly formatted.

In Vercel environment variables, the private key should be:
```
"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADA...\n-----END PRIVATE KEY-----\n"
```

Make sure:
- Entire key is in double quotes
- Newlines are `\n` (not actual newlines)
- No extra spaces

### Hardcoded Users Don't Work in Production

**Expected Behavior:** This is normal - hardcoded users are for testing only.

**Solution for Production:**
1. Remove hardcoded user logic from all APIs
2. Use proper Firebase authentication
3. Create real delivery boy accounts in database

## Performance Optimization

### Enable Caching

Add to `next.config.js`:
```javascript
module.exports = {
  // ... existing config

  headers: async () => [
    {
      source: '/:all*(svg|jpg|png)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
}
```

### Enable Analytics

In Vercel Dashboard:
1. Go to Project Settings → Analytics
2. Enable Web Analytics
3. Add analytics script to `app/layout.js`

### Enable Speed Insights

```bash
npm install @vercel/speed-insights
```

Then add to `app/layout.js`:
```javascript
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

## Custom Domain Setup

### Add Custom Domain:

1. Go to Vercel Dashboard → Project Settings → Domains
2. Click "Add"
3. Enter your domain: `deliveries.500kcal.fit`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (up to 48 hours)

### Required DNS Records:

**For root domain:**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For subdomain:**
```
Type: CNAME
Name: deliveries
Value: cname.vercel-dns.com
```

### Update Firebase & Supabase:

After adding custom domain:
1. Add custom domain to Firebase Authorized Domains
2. Add custom domain to Supabase Allowed URLs

## Monitoring & Logs

### View Deployment Logs:

1. Go to Vercel Dashboard → Deployments
2. Click on specific deployment
3. View "Build Logs" and "Function Logs"

### Real-time Function Logs:

1. Go to Project → Settings → Functions
2. Enable "Real-time Logs"
3. View live logs as API calls happen

### Error Tracking:

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Datadog for APM

## Security Considerations

### Production Checklist:

Before going live:
- [ ] Remove hardcoded test users from all APIs
- [ ] Enable Firebase Phone Authentication
- [ ] Set up proper rate limiting
- [ ] Configure CORS properly
- [ ] Enable Vercel Authentication (if needed)
- [ ] Set up IP allowlisting (if needed)
- [ ] Review all environment variables
- [ ] Test all authentication flows
- [ ] Verify database RLS policies
- [ ] Enable SSL/TLS everywhere
- [ ] Set up monitoring and alerts

### Environment Variables Security:

- Never commit `.env.local` to git ✅ (already in .gitignore)
- Use different credentials for production
- Rotate secrets regularly
- Limit database user permissions
- Use Vercel's secret management

## Cost Considerations

### Vercel Pricing:

- **Free Tier:**
  - 100 GB bandwidth/month
  - Unlimited deployments
  - Good for testing/staging

- **Pro Tier ($20/month):**
  - 1 TB bandwidth/month
  - Custom domains
  - Team collaboration
  - Better for production

### Supabase Pricing:

- **Free Tier:**
  - 500 MB database
  - 1 GB file storage
  - 50,000 monthly active users

- **Pro Tier ($25/month):**
  - 8 GB database
  - 100 GB storage
  - Better performance

### Firebase Pricing:

- **Phone Auth:** $0.06 per verification (after 10,000 free/month)
- **Storage:** $0.026 per GB
- Monitor usage in Firebase Console

## Support

### Getting Help:

1. **Vercel Issues:**
   - Check Vercel Status: https://vercel-status.com
   - Vercel Docs: https://vercel.com/docs
   - Community: https://github.com/vercel/vercel/discussions

2. **Firebase Issues:**
   - Firebase Console logs
   - Firebase Support: https://firebase.google.com/support
   - Stack Overflow with `firebase` tag

3. **Supabase Issues:**
   - Supabase Dashboard health checks
   - Supabase Docs: https://supabase.com/docs
   - Discord: https://discord.supabase.com

---

**Last Updated:** 2026-01-16
**Deployment Status:** Ready for production deployment
