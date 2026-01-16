# Delivery Status Update Guide

## Overview

Delivery boys can update the status of their assigned orders through the dashboard. The system supports multiple status transitions and includes mandatory photo upload for completed deliveries.

## Features Implemented

### 1. Order Status Updates
Delivery boys can mark orders with the following statuses:
- **Out for Delivery** - When the delivery boy starts the delivery
- **Delivered** - When the delivery is completed (requires photo proof)
- **Cancelled** - If the delivery cannot be completed

### 2. Mandatory Photo Upload
When marking an order as "Delivered", delivery boys MUST upload a photo as proof of delivery. The photo:
- Must be an image file (JPG, PNG, etc.)
- Maximum size: 5MB
- Gets stored in Supabase Storage bucket `delivery-photos`
- Public URL is saved to the order record in `delivery_photo_url` column

### 3. Real-time Dashboard Updates
After updating status, the dashboard automatically refreshes to show the latest delivery list and statistics.

## How It Works

### For Delivery Boys (User Interface):

1. **Login to Dashboard**
   - Go to http://localhost:3005/login
   - Enter phone number and password
   - Dashboard shows assigned deliveries

2. **View Assigned Deliveries**
   - See all orders assigned to you
   - Filter by date using date picker
   - View customer details, address, meal items

3. **Update Order Status**
   - Click status dropdown for any order
   - Select new status:
     - "Out for Delivery" - Mark when starting delivery
     - "Delivered" - Opens photo upload modal
     - "Cancelled" - Mark if delivery cannot be completed

4. **Upload Delivery Photo (Required for "Delivered")**
   - Photo upload modal appears automatically
   - Click "Choose Photo" button
   - Select photo from device
   - Preview appears
   - Click "Upload & Mark as Delivered"
   - Photo uploads to Supabase Storage
   - Order status updates to "Delivered"
   - `delivered_at` timestamp is recorded

5. **View Updated Statistics**
   - Today's Total Deliveries
   - Today's Completed Deliveries
   - Today's Pending Deliveries
   - Monthly Total Deliveries

### For Database (Technical Implementation):

#### Tables Updated:

**`orders` table:**
```sql
-- Fields updated when status changes:
order_status        -- 'Out for Delivery', 'Delivered', 'Cancelled'
updated_at          -- Timestamp of last update
delivery_notes      -- Optional notes from delivery boy

-- Additional fields for 'Delivered' status:
delivered_at        -- Timestamp when marked as delivered
delivery_photo_url  -- Public URL of uploaded photo
```

#### API Endpoints:

**1. Update Status API:**
- **Endpoint:** `POST /api/deliveries/update-status`
- **Request Body:**
```json
{
  "phone": "8087406269",
  "session": "session_token_here",
  "id": "hardcoded-user-1", // For hardcoded users
  "orderId": "order_uuid_here",
  "status": "Out for Delivery",
  "notes": "Optional delivery notes"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Order marked as Out for Delivery",
  "order": { /* updated order object */ }
}
```

**2. Upload Photo API:**
- **Endpoint:** `POST /api/deliveries/upload-photo`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `phone`: Delivery boy's phone number
  - `session`: Session token
  - `id`: User ID (for hardcoded users)
  - `orderId`: Order UUID
  - `photo`: Image file
- **Response:**
```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "photoUrl": "https://supabase.co/storage/delivery-photos/..."
}
```

## Workflow Diagram

```
┌─────────────────────────────────────────┐
│  Delivery Boy Dashboard                 │
│  - Shows assigned orders                │
│  - Filter by date                       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Select Order Status                     │
│  - Out for Delivery                     │
│  - Delivered (requires photo)           │
│  - Cancelled                            │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌─────────────┐      ┌──────────────────────┐
│  Status:    │      │  Status: Delivered   │
│  Out for    │      │  ↓                   │
│  Delivery   │      │  Photo Upload Modal  │
│  or         │      │  Opens               │
│  Cancelled  │      └──────────┬───────────┘
│  ↓          │                 │
│  Confirm    │                 ▼
│  Update     │      ┌──────────────────────┐
└──────┬──────┘      │  1. Choose Photo     │
       │             │  2. Preview Photo    │
       │             │  3. Click Upload     │
       │             └──────────┬───────────┘
       │                        │
       │                        ▼
       │             ┌──────────────────────┐
       │             │  Photo uploads to    │
       │             │  Supabase Storage    │
       │             └──────────┬───────────┘
       │                        │
       ▼                        ▼
┌──────────────────────────────────────────┐
│  Database Update:                         │
│  - order_status updated                  │
│  - updated_at timestamp set              │
│  - delivered_at set (if Delivered)       │
│  - delivery_photo_url set (if Delivered) │
│  - delivery_notes saved (if provided)    │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Dashboard Refreshes                      │
│  - Updated order list                    │
│  - Updated statistics                    │
│  - Success message shown                 │
└──────────────────────────────────────────┘
```

## Hardcoded Users Support

The status update and photo upload features work for both:
- **Database Users** - Regular users with full authentication
- **Hardcoded Test Users** - Temporary test users (hardcoded-user-1, hardcoded-user-2)

### How Hardcoded Users Work:

1. **Login:** Hardcoded credentials are checked first in login API
2. **Deliveries:** User ID passed in query parameter to skip database validation
3. **Status Update:** User ID passed in request body to skip session validation
4. **Photo Upload:** User ID passed in form data to skip authentication

This allows immediate testing without database setup or Firebase authentication.

## Security Considerations

### For Production (After Removing Hardcoded Users):

1. **Authentication:**
   - All requests verify session token against database
   - Session tokens are randomly generated 32-byte hex strings
   - Tokens are validated on every API call

2. **Authorization:**
   - Delivery boys can only update orders assigned to them
   - `delivery_boy_id` is verified before allowing status updates
   - Role verification ensures only 'delivery_boy' accounts can access

3. **Photo Storage:**
   - Photos stored in Supabase Storage with public access
   - File naming: `{orderId}-{timestamp}.{extension}`
   - Size limit: 5MB per photo
   - Only image files accepted

4. **Data Validation:**
   - Status must be one of: ['Out for Delivery', 'Delivered', 'Cancelled']
   - Order ID must be valid UUID
   - Photo is required for 'Delivered' status

## Testing the Status Update Feature

### Test Scenario 1: Mark as "Out for Delivery"

1. Login with hardcoded user:
   - Phone: `8087406269`
   - Password: `123456`

2. Assign test order to this user:
```sql
UPDATE orders
SET delivery_boy_id = 'hardcoded-user-1',
    assigned_at = NOW()
WHERE id = 'some-order-uuid';
```

3. In dashboard:
   - Find the assigned order
   - Click status dropdown
   - Select "Out for Delivery"
   - Confirm

4. Verify:
   - Order status changes to "Out for Delivery"
   - `updated_at` timestamp is set
   - Dashboard refreshes with updated status

### Test Scenario 2: Mark as "Delivered" with Photo

1. Login with hardcoded user (same as above)

2. In dashboard:
   - Find an order
   - Click status dropdown
   - Select "Delivered"
   - Photo upload modal opens

3. Upload photo:
   - Click "Choose Photo"
   - Select an image file
   - Preview appears
   - Click "Upload & Mark as Delivered"

4. Verify:
   - Photo uploads to Supabase Storage
   - Order status changes to "Delivered"
   - `delivered_at` timestamp is set
   - `delivery_photo_url` contains public URL
   - Dashboard shows updated status
   - Statistics update (completed count increases)

### Test Scenario 3: Verify Photo in Database

```sql
SELECT
  id,
  order_status,
  delivered_at,
  delivery_photo_url,
  updated_at
FROM orders
WHERE delivery_boy_id = 'hardcoded-user-1'
AND order_status = 'Delivered';
```

Check that:
- `delivery_photo_url` is not null
- URL is accessible (try opening in browser)
- Photo displays correctly

## Troubleshooting

### Issue: "Order not assigned to you"
**Cause:** Order's `delivery_boy_id` doesn't match logged-in user's ID
**Solution:**
- Verify order is assigned to correct delivery boy
- Check `delivery_boy_id` in database
- For hardcoded users, ensure order is assigned to matching ID

### Issue: "Failed to upload photo"
**Cause:** Supabase Storage bucket not configured or permissions issue
**Solution:**
1. Create `delivery-photos` bucket in Supabase Storage
2. Make bucket public
3. Verify Storage API key is correct in `.env.local`

### Issue: Photo upload shows but status doesn't update
**Cause:** Photo upload succeeded but status update failed
**Solution:** Check server logs for status update error

### Issue: "Photo size too large"
**Cause:** Selected photo exceeds 5MB limit
**Solution:**
- Compress image before uploading
- Choose a smaller photo
- Or increase size limit in code (not recommended)

## Future Enhancements

Potential improvements for production:

1. **Delivery Notes Field:**
   - Add textarea in dashboard for delivery notes
   - Save notes when updating status
   - Display notes in order history

2. **GPS Location Tracking:**
   - Capture GPS coordinates when marking as delivered
   - Store coordinates in database
   - Verify delivery location matches customer address

3. **Photo Quality Check:**
   - Validate photo quality before upload
   - Ensure photo is not blurry
   - Check if photo contains required elements

4. **Delivery Time Tracking:**
   - Calculate time taken for delivery
   - Track average delivery time per route
   - Identify optimization opportunities

5. **Customer Signature:**
   - Add signature capture feature
   - Store signature alongside photo
   - Provide stronger delivery proof

6. **Offline Support:**
   - Allow status updates offline
   - Sync when connection restored
   - Queue photo uploads for later

7. **Push Notifications:**
   - Notify delivery boy of new assignments
   - Alert admin when delivery is completed
   - Send customer delivery confirmation

---

**Last Updated:** 2026-01-16
**Status:** Fully functional with hardcoded users for testing
