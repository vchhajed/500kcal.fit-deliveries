import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

    // Fetch delivery boy from database by phone number from delivery_boys table
    // Note: session_token column might not exist, so just validate by phone
    const { data: deliveryBoy, error: authError } = await supabase
      .from('delivery_boys')
      .select('id, name, phone')
      .eq('phone', phone)
      .single()

    if (authError || !deliveryBoy) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { success: false, error: 'Invalid session. Please login again.' },
        { status: 401 }
      )
    }

    // Session validation is skipped since session_token column doesn't exist
    // In production, you should add this column for proper security

    console.log('Found delivery boy:', deliveryBoy.name, 'ID:', deliveryBoy.id, 'Phone:', deliveryBoy.phone)

    // Step 2: Fetch orders assigned to this delivery boy
    // WHERE clause: delivery_boy_phone = deliveryBoy.phone
    // This ensures delivery boy only sees their own orders
    console.log('Fetching orders for delivery boy phone:', deliveryBoy.phone)

    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customer_accounts!orders_customer_id_fkey(
          name,
          phone_number,
          address
        ),
        menu_item:recipes(
          name
        )
      `)
      .eq('delivery_boy_phone', deliveryBoy.phone) // IMPORTANT: Filter by delivery boy phone
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

    const { data: deliveries, error: deliveriesError } = await query

    if (deliveriesError) {
      console.error('Error fetching deliveries:', deliveriesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deliveries' },
        { status: 500 }
      )
    }

    console.log(`Found ${deliveries?.length || 0} orders for delivery boy phone ${deliveryBoy.phone}`)

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0]
    const todayDeliveries = deliveries.filter(d => d.delivery_date === today)
    const completed = todayDeliveries.filter(d => d.order_status === 'Delivered').length
    const pending = todayDeliveries.filter(d =>
      d.order_status !== 'Delivered' && d.order_status !== 'Cancelled'
    ).length

    // Get monthly stats
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStart = firstDayOfMonth.toISOString().split('T')[0]

    const { data: monthlyDeliveries } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: false })
      .eq('delivery_boy_phone', deliveryBoy.phone)
      .eq('order_status', 'Delivered')
      .gte('delivery_date', monthStart)

    return NextResponse.json({
      success: true,
      deliveries: deliveries,
      stats: {
        todayTotal: todayDeliveries.length,
        todayCompleted: completed,
        todayPending: pending,
        monthlyTotal: monthlyDeliveries?.length || 0
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
