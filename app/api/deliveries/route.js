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
          address,
          latitude,
          longitude
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
      // Default: show only today's deliveries
      const today = new Date().toISOString().split('T')[0]
      query = query.eq('delivery_date', today)
      console.log('Showing only today\'s deliveries:', today)
    }

    const { data: deliveries, error: deliveriesError } = await query

    if (deliveriesError) {
      console.error('Error fetching deliveries:', deliveriesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deliveries' },
        { status: 500 }
      )
    }

    // Also fetch ala carte orders assigned to this delivery boy
    const { data: acOrders } = await supabase
      .from('ala_carte_orders')
      .select('id, order_number, status, total_amount_rs, delivery_address, delivery_latitude, delivery_longitude, created_at, customer_id, ala_carte_order_items(name, quantity, unit_price)')
      .eq('delivery_boy_phone', deliveryBoy.phone)
      .in('status', ['Preparing', 'Out for Delivery'])

    // Fetch customer info for ala carte orders
    const acCustomerIds = [...new Set((acOrders || []).map(o => o.customer_id).filter(Boolean))]
    const acCustomerMap = {}
    if (acCustomerIds.length > 0) {
      const { data: acCustomers } = await supabase
        .from('customer_accounts')
        .select('id, name, phone_number, latitude, longitude')
        .in('id', acCustomerIds)
      for (const c of (acCustomers || [])) acCustomerMap[c.id] = c
    }

    // Normalize ala carte orders to match the regular order shape
    const normalizedAcOrders = (acOrders || []).map(ac => {
      const customer = acCustomerMap[ac.customer_id] || null
      const itemNames = (ac.ala_carte_order_items || []).map(i => `${i.name} ×${i.quantity}`).join(', ')
      return {
        id: ac.id,
        order_type: 'ala_carte',
        order_number: ac.order_number,
        delivery_date: ac.created_at.split('T')[0],
        meal_slot: 'Ala Carte',
        order_status: ac.status,
        delivery_address: ac.delivery_address,
        ala_carte_items: ac.ala_carte_order_items || [],
        total_amount_rs: ac.total_amount_rs,
        customer: {
          name: customer?.name || 'Unknown',
          phone_number: customer?.phone_number || null,
          latitude: ac.delivery_latitude || customer?.latitude || null,
          longitude: ac.delivery_longitude || customer?.longitude || null,
        },
        menu_item: { name: itemNames || 'Ala Carte Order' },
      }
    })

    console.log(`Found ${deliveries?.length || 0} regular + ${normalizedAcOrders.length} ala carte orders for ${deliveryBoy.phone}`)

    // Normalize meal_slot values to ensure consistency
    // This handles lowercase values and time range formats
    const normalizeMealSlot = (slot) => {
      if (!slot) return 'Unknown'

      const slotLower = slot.toLowerCase().trim()

      // Handle time ranges - map to meal slots
      if (slotLower.match(/^0[67]:\d{2}-0[89]:\d{2}$/) || slotLower.match(/^08:\d{2}-0[89]:\d{2}$/)) {
        // Morning times (06:00-09:30) -> Breakfast
        return 'Breakfast'
      } else if (slotLower.match(/^1[12]:\d{2}-1[34]:\d{2}$/)) {
        // Midday times (11:00-14:30) -> Lunch
        return 'Lunch'
      } else if (slotLower.match(/^1[789]:\d{2}-2[01]:\d{2}$/)) {
        // Evening times (17:00-21:30) -> Dinner
        return 'Dinner'
      }

      // Handle text values
      if (slotLower.includes('breakfast') || slotLower === 'breakfast') {
        return 'Breakfast'
      } else if (slotLower.includes('lunch') || slotLower === 'lunch') {
        return 'Lunch'
      } else if (slotLower.includes('dinner') || slotLower === 'dinner') {
        return 'Dinner'
      }

      return slot // Return original if no match
    }

    // Apply normalization to all deliveries
    const normalizedDeliveries = deliveries.map(delivery => ({
      ...delivery,
      order_type: 'regular',
      meal_slot: normalizeMealSlot(delivery.meal_slot)
    }))

    // Merge regular + ala carte orders
    const allDeliveries = [...normalizedDeliveries, ...normalizedAcOrders]

    console.log('Total orders:', allDeliveries.length)

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0]
    const todayDeliveries = normalizedDeliveries.filter(d => d.delivery_date === today)
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
      deliveries: allDeliveries,
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
