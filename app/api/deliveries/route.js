import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Hardcoded user IDs (temporary - must match login route)
const HARDCODED_USER_IDS = ['hardcoded-user-1', 'hardcoded-user-2']

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const sessionToken = searchParams.get('session')
    const date = searchParams.get('date')

    if (!phone || !sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if hardcoded user (stored in localStorage as deliveryId)
    const deliveryId = searchParams.get('id')
    let deliveryBoy = null

    if (deliveryId && HARDCODED_USER_IDS.includes(deliveryId)) {
      // Hardcoded user - skip database check
      deliveryBoy = {
        id: deliveryId,
        name: deliveryId === 'hardcoded-user-1' ? 'Test Delivery Boy 1' : 'Test Delivery Boy 2',
        role: 'delivery_boy'
      }
      console.log('Using hardcoded user:', deliveryBoy.name)
    } else {
      // Verify session from database
      const { data: dbUser, error: authError } = await supabase
        .from('customer_accounts')
        .select('id, name, role')
        .eq('phone_number', phone)
        .eq('session_token', sessionToken)
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

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        id,
        delivery_date,
        meal_slot,
        order_status,
        delivery_address,
        special_instructions,
        delivery_notes,
        assigned_at,
        delivered_at,
        customer:customer_accounts!orders_customer_id_fkey(
          name,
          phone_number,
          address
        ),
        menu_item:menu_items(
          name,
          description
        )
      `)
      .eq('delivery_boy_id', deliveryBoy.id)
      .order('delivery_date', { ascending: true })
      .order('meal_slot', { ascending: true })

    // Filter by date if provided
    if (date) {
      query = query.eq('delivery_date', date)
    } else {
      // Default: show today's and future deliveries
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('delivery_date', today)
    }

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deliveries' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0]
    const todayOrders = orders.filter(o => o.delivery_date === today)
    const completed = todayOrders.filter(o => o.order_status === 'Delivered').length
    const pending = todayOrders.filter(o =>
      o.order_status !== 'Delivered' && o.order_status !== 'Cancelled'
    ).length

    // Get monthly stats
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStart = firstDayOfMonth.toISOString().split('T')[0]

    const { data: monthlyOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: false })
      .eq('delivery_boy_id', deliveryBoy.id)
      .eq('order_status', 'Delivered')
      .gte('delivery_date', monthStart)

    return NextResponse.json({
      success: true,
      deliveries: orders,
      stats: {
        todayTotal: todayOrders.length,
        todayCompleted: completed,
        todayPending: pending,
        monthlyTotal: monthlyOrders?.length || 0
      }
    })

  } catch (error) {
    console.error('Error in deliveries API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
