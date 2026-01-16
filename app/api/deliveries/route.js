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

    // Step 1: Get delivery boy details by phone number
    const deliveryId = searchParams.get('id')
    let deliveryBoy = null

    if (deliveryId && HARDCODED_USER_IDS.includes(deliveryId)) {
      // Hardcoded user - for testing only
      deliveryBoy = {
        id: deliveryId,
        name: deliveryId === 'hardcoded-user-1' ? 'Test Delivery Boy 1' : 'Test Delivery Boy 2',
        role: 'delivery_boy',
        phone_number: deliveryId === 'hardcoded-user-1' ? '8087406269' : '9730425526'
      }
      console.log('Using hardcoded user:', deliveryBoy.name, 'Phone:', deliveryBoy.phone_number)
    } else {
      // Fetch delivery boy from database by phone number
      const { data: dbUser, error: authError } = await supabase
        .from('customer_accounts')
        .select('id, name, role, phone_number')
        .eq('phone_number', phone)
        .eq('session_token', sessionToken)
        .single()

      if (authError || !dbUser) {
        console.error('Auth error:', authError)
        return NextResponse.json(
          { success: false, error: 'Invalid session. Please login again.' },
          { status: 401 }
        )
      }

      if (dbUser.role !== 'delivery_boy') {
        return NextResponse.json(
          { success: false, error: 'Access denied. This portal is for delivery personnel only.' },
          { status: 403 }
        )
      }

      deliveryBoy = dbUser
      console.log('Found delivery boy:', deliveryBoy.name, 'ID:', deliveryBoy.id, 'Phone:', deliveryBoy.phone_number)
    }

    // Step 2: Fetch orders assigned to this delivery boy
    // WHERE clause: delivery_boy_id = deliveryBoy.id
    // This ensures delivery boy only sees their own deliveries
    console.log('Fetching orders for delivery_boy_id:', deliveryBoy.id)

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
        delivery_boy_id,
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
      .eq('delivery_boy_id', deliveryBoy.id) // IMPORTANT: Filter by delivery boy ID
      .order('delivery_date', { ascending: true })
      .order('meal_slot', { ascending: true })

    // Filter by date if provided
    if (date) {
      query = query.eq('delivery_date', date)
      console.log('Filtering by date:', date)
    } else {
      // Default: show today's and future deliveries
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('delivery_date', today)
      console.log('Showing deliveries from today onwards:', today)
    }

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deliveries' },
        { status: 500 }
      )
    }

    console.log(`Found ${orders?.length || 0} orders for delivery boy ${deliveryBoy.name}`)

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
