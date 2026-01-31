# Delivery Location Tracking Feature

## Overview

The delivery portal now captures GPS coordinates when a delivery boy marks an order as delivered. This provides proof of delivery location and allows customers to verify where their order was delivered.

## Features

### 1. Automatic GPS Capture
- When the delivery boy opens the photo upload modal, the app automatically requests location permission
- GPS coordinates are captured with high accuracy
- Location accuracy (in meters) is recorded
- Works on both mobile and desktop browsers

### 2. Visual Feedback
The photo upload modal shows real-time location status:
- **🔍 Getting location...** - Location request in progress
- **📍 Location captured (±Xm)** - Success with accuracy displayed
- **⚠️ Location not available** - Permission denied or unavailable

### 3. Graceful Degradation
- If location permission is denied, the photo can still be uploaded
- Delivery continues without GPS data
- No blocking or errors

### 4. Location Display
For delivered orders, the dashboard shows:
- **"View on Map"** link that opens Google Maps
- Displays accuracy (±X meters)
- Only visible for completed deliveries with location data

## Database Schema

### New Columns Added to `orders` Table:

```sql
delivery_latitude DECIMAL(10, 8)          -- GPS latitude (-90 to 90)
delivery_longitude DECIMAL(11, 8)         -- GPS longitude (-180 to 180)
delivery_location_accuracy DECIMAL(10, 2) -- Accuracy in meters
delivery_address_verified TEXT            -- Reserved for reverse geocoding
```

## Setup Instructions

### Step 1: Run Database Migration

Execute in Supabase SQL Editor:

```sql
-- Add location columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS delivery_location_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS delivery_address_verified TEXT;

-- Add comments
COMMENT ON COLUMN public.orders.delivery_latitude IS 'GPS latitude where order was delivered';
COMMENT ON COLUMN public.orders.delivery_longitude IS 'GPS longitude where order was delivered';
COMMENT ON COLUMN public.orders.delivery_location_accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN public.orders.delivery_address_verified IS 'Reverse geocoded address at delivery location';
```

Or run the provided script: `ADD_DELIVERY_LOCATION.sql`

### Step 2: Deploy Code Changes

The following files have been updated:
- `app/api/deliveries/upload-photo/route.js` - Backend API
- `app/dashboard/page.js` - Frontend logic
- `app/dashboard/dashboard.module.css` - Styles
- `CREATE_ORDERS_TABLE.sql` - Schema definition

### Step 3: Test Location Capture

1. Login as delivery boy (8087406269 / 123456)
2. Click "Mark Delivered" on an order
3. Grant location permission when prompted
4. Verify location status shows green checkmark
5. Upload photo and complete delivery
6. Check dashboard shows "View on Map" link

## How It Works

### Frontend Flow:

1. **Modal Opens** → Auto-request GPS location
2. **User Takes Photo** → Photo selected
3. **User Clicks Confirm** → Check if location is available
4. **Upload** → Send photo + GPS coordinates to API
5. **Success** → Order marked as delivered with location

### Backend Flow:

1. **Receive FormData** with photo + latitude + longitude + accuracy
2. **Upload Photo** to Supabase Storage
3. **Update Order** with:
   - `delivery_photo_url`
   - `delivery_latitude`
   - `delivery_longitude`
   - `delivery_location_accuracy`
4. **Return Success**

### Display Flow:

1. **Fetch Orders** with location data
2. **For Delivered Orders** → Check if coordinates exist
3. **Show Link** → Generate Google Maps URL
4. **Click** → Opens map in new tab

## API Changes

### Upload Photo Endpoint

**Before:**
```javascript
formData.append('photo', file)
```

**After:**
```javascript
formData.append('photo', file)
formData.append('latitude', location.latitude)
formData.append('longitude', location.longitude)
formData.append('accuracy', location.accuracy)
```

### Response Format (unchanged)

```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "photoUrl": "https://..."
}
```

## Privacy & Security

### Browser Permissions
- Location permission is requested per-session
- User can deny permission without affecting delivery
- Permission prompt only appears when needed

### Data Storage
- Coordinates stored in database with order
- Accuracy level recorded for transparency
- No continuous tracking - only capture on delivery

### Data Access
- Only visible to:
  - Delivery boy who completed the delivery
  - Customer who placed the order
  - Admin/support staff

## Testing

### Test Scenarios:

#### 1. Happy Path (Location Allowed)
```
1. Open photo modal
2. Grant location permission
3. See "📍 Location captured (±Xm)"
4. Take photo
5. Click "Confirm & Mark Delivered"
6. Verify location saved in database
7. Check "View on Map" link appears
```

#### 2. Location Denied
```
1. Open photo modal
2. Deny location permission
3. See "⚠️ Location not available"
4. Take photo
5. Click "Confirm & Mark Delivered"
6. Delivery completes without GPS
```

#### 3. Location Timeout
```
1. Open photo modal in poor signal area
2. Wait 10 seconds
3. Location request times out
4. Warning message appears
5. Can still upload photo
```

### Verify Location Data:

```sql
-- Check deliveries with location
SELECT
  id,
  order_status,
  delivery_latitude,
  delivery_longitude,
  delivery_location_accuracy,
  delivered_at
FROM orders
WHERE delivery_latitude IS NOT NULL
ORDER BY delivered_at DESC;
```

## Future Enhancements

### 1. Reverse Geocoding
Convert GPS coordinates to human-readable address:
```javascript
const address = await reverseGeocode(latitude, longitude)
// Save to delivery_address_verified column
```

### 2. Geofencing Validation
Verify delivery boy is at correct location:
```javascript
if (distance(gps, customerAddress) > 100) {
  alert('You seem far from delivery address')
}
```

### 3. Route Tracking
Track delivery boy's route throughout the day:
- Store waypoints during "Out for Delivery" status
- Display route on map
- Calculate total distance traveled

### 4. Location History
Keep audit log of all location captures:
```sql
CREATE TABLE delivery_location_history (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(10, 2),
  captured_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Location Not Captured

**Possible Causes:**
- Browser doesn't support geolocation
- Permission denied by user
- Device location services disabled
- Poor GPS signal

**Solutions:**
- Check browser compatibility (Chrome, Safari, Firefox, Edge)
- Ensure HTTPS connection (required for geolocation)
- Enable location services on device
- Move to area with better GPS signal

### Inaccurate Location

**Possible Causes:**
- Poor GPS signal
- Indoor delivery
- Using WiFi location (less accurate)

**Solutions:**
- Wait for better signal
- Use mobile data GPS (more accurate)
- Delivery can still complete with low accuracy

### Map Link Not Working

**Check:**
```sql
SELECT delivery_latitude, delivery_longitude
FROM orders
WHERE id = 'order-uuid';
```

**Verify:**
- Coordinates are not NULL
- Latitude between -90 and 90
- Longitude between -180 and 180

## Browser Compatibility

| Browser | GPS Support | Notes |
|---------|-------------|-------|
| Chrome | ✅ | Full support |
| Safari | ✅ | Requires HTTPS |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Mobile Safari | ✅ | Full support |
| Chrome Mobile | ✅ | Full support |

**Requirements:**
- HTTPS connection
- User permission
- Device location services enabled

---

**Feature Status:** ✅ Production Ready
**Last Updated:** 2026-01-31
**Version:** 1.0
