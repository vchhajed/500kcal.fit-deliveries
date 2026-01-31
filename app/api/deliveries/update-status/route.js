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
    let deliveryBoyPhone = phone

    if (id && HARDCODED_USER_IDS.includes(id)) {
      // Hardcoded user - skip authentication
      deliveryBoy = {
        id: id,
        name: id === 'hardcoded-user-1' ? 'Test Delivery Boy 1' : 'Test Delivery Boy 2',
        role: 'delivery_boy',
        phone_number: phone // Add phone_number to hardcoded user object
      }
      console.log('Hardcoded user updating order:', deliveryBoy.name)
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

    // Prepare update data
    const updateData = {
      order_status: status,
      updated_at: new Date().toISOString()
    }

    if (notes) {
      updateData.delivery_notes = notes
    }

    if (status === 'Delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating order:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update order status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Order marked as ${status}`,
      order: updatedOrder
    })

  } catch (error) {
    console.error('Error in update-status API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
