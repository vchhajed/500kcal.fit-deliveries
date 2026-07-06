import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const phone = formData.get('phone')
    const session = formData.get('session')
    const orderId = formData.get('orderId')
    const photo = formData.get('photo')
    const latitude = formData.get('latitude')
    const longitude = formData.get('longitude')
    const accuracy = formData.get('accuracy')
    const orderType = formData.get('orderType')

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

    // Verify session from database using delivery_boys
    const { data: deliveryBoy, error: authError} = await supabase
      .from('delivery_boys')
      .select('id, name, phone')
      .eq('phone', phone)
      .single()

    if (authError || !deliveryBoy) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Session validation is skipped since session_token column doesn't exist

    const deliveryBoyPhone = deliveryBoy.phone

    // For ala carte orders, verify via ala_carte_orders table
    if (orderType === 'ala_carte') {
      const { data: acOrder, error: acErr } = await supabase
        .from('ala_carte_orders').select('id, delivery_boy_phone').eq('id', orderId).single()
      if (acErr || !acOrder) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      if (acOrder.delivery_boy_phone !== deliveryBoyPhone) {
        return NextResponse.json({ success: false, error: 'Order not assigned to you' }, { status: 403 })
      }
    } else {
      // Verify the order is assigned to this delivery boy (regular orders)
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

    const tableName = orderType === 'ala_carte' ? 'ala_carte_orders' : 'orders'
    const { error: updateError } = await supabase
      .from(tableName)
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
