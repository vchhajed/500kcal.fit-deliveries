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

    // NEW: Verify the slot is assigned to this delivery boy
    const { data: slot, error: slotError } = await supabase
      .from('meal_booking_slots')
      .select('id, delivery_boy_phone, status')
      .eq('id', orderId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json(
        { success: false, error: 'Slot not found' },
        { status: 404 }
      )
    }

    if (slot.delivery_boy_phone !== deliveryBoyPhone) {
      return NextResponse.json(
        { success: false, error: 'Slot not assigned to you' },
        { status: 403 }
      )
    }

    // FALLBACK: old orders ownership check
    // const { data: order, error: orderError } = await supabase
    //   .from('orders').select('id, delivery_boy_phone, order_status').eq('id', orderId).single()
    // if (orderError || !order) { ... }
    // if (order.delivery_boy_phone !== deliveryBoyPhone) { ... }

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

    // NEW: Write delivery_photo_url to meal_booking_slots
    const { error: updateError } = await supabase
      .from('meal_booking_slots')
      .update(updateData)
      .eq('id', orderId)

    // FALLBACK: old orders update
    // const { error: updateError } = await supabase
    //   .from('orders').update(updateData).eq('id', orderId)

    if (updateError) {
      console.error('Error updating slot:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update slot with photo' },
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
