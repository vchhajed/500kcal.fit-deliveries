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
    const body = await request.json()
    const { phone, session, orderId, status, notes, id } = body

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

    // Check if hardcoded user
    let deliveryBoy = null

    if (id && HARDCODED_USER_IDS.includes(id)) {
      // Hardcoded user - skip authentication
      deliveryBoy = {
        id: id,
        name: id === 'hardcoded-user-1' ? 'Test Delivery Boy 1' : 'Test Delivery Boy 2',
        role: 'delivery_boy'
      }
      console.log('Hardcoded user updating order:', deliveryBoy.name)
    } else {
      // Verify session from database
      const { data: dbUser, error: authError } = await supabase
        .from('customer_accounts')
        .select('id, name, role')
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
    }

    // Verify the delivery is assigned to this delivery boy
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select('id, delivery_boy_phone, status')
      .eq('id', orderId)
      .single()

    if (deliveryError || !delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      )
    }

    if (delivery.delivery_boy_phone !== deliveryBoy.phone_number) {
      return NextResponse.json(
        { success: false, error: 'Delivery not assigned to you' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    }

    if (notes) {
      updateData.delivery_notes = notes
    }

    if (status === 'Delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    // Update the delivery
    const { data: updatedDelivery, error: updateError } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating delivery:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update delivery status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Delivery marked as ${status}`,
      delivery: updatedDelivery
    })

  } catch (error) {
    console.error('Error in update-status API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
