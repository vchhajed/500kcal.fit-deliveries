import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Hardcoded user IDs (temporary - must match other routes)
const HARDCODED_USER_IDS = ['hardcoded-user-1', 'hardcoded-user-2']

export async function POST(request) {
  try {
    const formData = await request.formData()
    const phone = formData.get('phone')
    const session = formData.get('session')
    const orderId = formData.get('orderId')
    const photo = formData.get('photo')
    const id = formData.get('id')
    const latitude = formData.get('latitude')
    const longitude = formData.get('longitude')
    const accuracy = formData.get('accuracy')

    if (!phone || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!orderId || !photo) {
      return NextResponse.json(
        { success: false, error: 'Order ID and photo required' },
        { status: 400 }
      )
    }

    // Check if hardcoded user
    let deliveryBoy = null
    let deliveryBoyPhone = phone

    if (id && HARDCODED_USER_IDS.includes(id)) {
      // Hardcoded user - skip authentication
      deliveryBoy = {
        id: id,
        name: id === 'hardcoded-user-1' ? 'Test Delivery Boy 1' : 'Test Delivery Boy 2',
        role: 'delivery_boy',
        phone_number: phone // Add phone_number to hardcoded user object
      }
      console.log('Hardcoded user uploading photo:', deliveryBoy.name)
    } else {
      // Verify session from database
      const { data: dbUser, error: authError } = await supabase
        .from('customer_accounts')
        .select('id, name, role, phone_number')
        .eq('phone_number', phone)
        .eq('session_token', session)
        .single()

      if (authError || !dbUser) {
        return NextResponse.json(
          { success: false, error: 'Invalid session' },
          { status: 401 }
        )
      }

      if (dbUser.role !== 'delivery_boy') {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      deliveryBoy = dbUser
      deliveryBoyPhone = dbUser.phone_number
    }

    // Verify the order is assigned to this delivery boy
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, delivery_boy_phone, order_status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.delivery_boy_phone !== deliveryBoyPhone) {
      return NextResponse.json(
        { success: false, error: 'Order not assigned to you' },
        { status: 403 }
      )
    }

    // Upload photo to Supabase Storage
    const fileExt = photo.name.split('.').pop()
    const fileName = `${orderId}-${Date.now()}.${fileExt}`
    const filePath = `delivery-proofs/${fileName}`

    const arrayBuffer = await photo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('delivery-photos')
      .upload(filePath, buffer, {
        contentType: photo.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading photo:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload photo' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('delivery-photos')
      .getPublicUrl(filePath)

    const photoUrl = urlData.publicUrl

    // Update order with photo URL and location
    const updateData = {
      delivery_photo_url: photoUrl,
      updated_at: new Date().toISOString()
    }

    // Add location data if provided
    if (latitude && longitude) {
      updateData.delivery_latitude = parseFloat(latitude)
      updateData.delivery_longitude = parseFloat(longitude)
      if (accuracy) {
        updateData.delivery_location_accuracy = parseFloat(accuracy)
      }
      console.log('Saving delivery location:', { latitude, longitude, accuracy })
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update order with photo' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoUrl
    })

  } catch (error) {
    console.error('Error in upload-photo API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
