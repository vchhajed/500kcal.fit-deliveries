import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { phone, session, orderId, status, notes } = body

    if (!phone || !session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!orderId || !status) {
      return NextResponse.json(
        { success: false, error: 'Order ID and status required' },
        { status: 400 }
      )
    }

    // Valid status transitions for delivery boys
    const validStatuses = ['Out for Delivery', 'Delivered', 'Cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Map display status → DB status (meal_booking_slots uses lowercase)
    const DB_STATUS = {
      'Delivered': 'delivered',
      'Out for Delivery': 'out_for_delivery',
      'Cancelled': 'cancelled',
    }
    const dbStatus = DB_STATUS[status] || status.toLowerCase()

    // Verify session from database using delivery_boys
    const { data: deliveryBoy, error: authError } = await supabase
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

    // FALLBACK: old orders verify
    // const { data: order, error: orderError } = await supabase
    //   .from('orders')
    //   .select('id, delivery_boy_phone, order_status')
    //   .eq('id', orderId)
    //   .single()

    // NEW: Update meal_booking_slots
    const updateData = {
      status: dbStatus,
      updated_at: new Date().toISOString()
    }

    if (dbStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    const { data: updatedSlot, error: updateError } = await supabase
      .from('meal_booking_slots')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    // FALLBACK: old orders update
    // const updateDataOld = { order_status: status, updated_at: new Date().toISOString() }
    // if (notes) updateDataOld.delivery_notes = notes
    // if (status === 'Delivered') updateDataOld.delivered_at = new Date().toISOString()
    // const { data: updatedOrder, error: updateError } = await supabase
    //   .from('orders').update(updateDataOld).eq('id', orderId).select().single()

    if (updateError) {
      console.error('Error updating slot:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Slot marked as ${status}`,
      slot: updatedSlot
    })

  } catch (error) {
    console.error('Error in update-status API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
