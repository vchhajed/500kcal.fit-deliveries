import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const STATUS_DISPLAY = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function normalizeStatus(s) {
  return STATUS_DISPLAY[s?.toLowerCase()] || s || 'Unknown'
}

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

    // Fetch delivery boy from database by phone number
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

    console.log('Found delivery boy:', deliveryBoy.name, 'Phone:', deliveryBoy.phone)

    // Determine target date
    const targetDate = date || new Date().toISOString().split('T')[0]
    console.log('Fetching slots for date:', targetDate)

    // NEW: Query meal_booking_slots joined with meal_bookings + customer_accounts
    const { data: slots, error: slotsError } = await supabase
      .from('meal_booking_slots')
      .select(`
        id,
        slot_number,
        meal_type,
        status,
        credits,
        delivery_address,
        delivery_boy_phone,
        delivery_photo_url,
        meal_bookings!inner(
          delivery_date,
          booking_number,
          customer_accounts!inner(
            name,
            phone_number,
            latitude,
            longitude
          )
        )
      `)
      .eq('delivery_boy_phone', deliveryBoy.phone)
      .eq('meal_bookings.delivery_date', targetDate)
      .neq('status', 'cancelled')
      .order('slot_number', { ascending: true })

    if (slotsError) {
      console.error('Error fetching slots:', slotsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deliveries' },
        { status: 500 }
      )
    }

    // FALLBACK (old orders query — kept for reference until verified live)
    // let query = supabase
    //   .from('orders')
    //   .select(`
    //     *,
    //     customer:customer_accounts!orders_customer_id_fkey(name, phone_number, address, latitude, longitude),
    //     menu_item:recipes(name)
    //   `)
    //   .eq('delivery_boy_phone', deliveryBoy.phone)
    //   .order('delivery_date', { ascending: true })
    //   .order('meal_slot', { ascending: true })
    // if (date) { query = query.eq('delivery_date', date) }
    // else { query = query.eq('delivery_date', today) }
    // const { data: deliveries, error: deliveriesError } = await query

    console.log(`Found ${slots?.length || 0} slots for delivery boy ${deliveryBoy.phone} on ${targetDate}`)

    // Normalize meal_type values
    const normalizeMealType = (type) => {
      if (!type) return 'Unknown'
      const t = type.toLowerCase().trim()
      if (t.includes('breakfast')) return 'Breakfast'
      if (t.includes('lunch')) return 'Lunch'
      if (t.includes('dinner')) return 'Dinner'
      return type
    }

    // Map to flat response shape
    const deliveries = (slots || []).map(slot => ({
      slot_id: slot.id,
      id: slot.id,                                                   // alias — used as React key + orderId
      slot_number: slot.slot_number,
      meal_type: normalizeMealType(slot.meal_type),                  // replaces meal_slot
      status: normalizeStatus(slot.status),                          // replaces order_status
      credits: slot.credits,
      delivery_address: slot.delivery_address,
      delivery_photo_url: slot.delivery_photo_url,
      delivery_date: slot.meal_bookings?.delivery_date,
      booking_number: slot.meal_bookings?.booking_number,
      customer_name: slot.meal_bookings?.customer_accounts?.name,
      customer_phone: slot.meal_bookings?.customer_accounts?.phone_number,
      delivery_latitude: slot.meal_bookings?.customer_accounts?.latitude ?? null,
      delivery_longitude: slot.meal_bookings?.customer_accounts?.longitude ?? null,
    }))

    // Stats
    const today = new Date().toISOString().split('T')[0]
    const todayDeliveries = targetDate === today ? deliveries : []
    const completed = todayDeliveries.filter(d => d.status === 'Delivered').length
    const pending = todayDeliveries.filter(d =>
      d.status !== 'Delivered' && d.status !== 'Cancelled'
    ).length

    // Monthly delivered count
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStart = firstDayOfMonth.toISOString().split('T')[0]

    const { data: monthlySlots } = await supabase
      .from('meal_booking_slots')
      .select(`id, meal_bookings!inner(delivery_date)`)
      .eq('delivery_boy_phone', deliveryBoy.phone)
      .eq('status', 'delivered')
      .gte('meal_bookings.delivery_date', monthStart)

    // FALLBACK monthly query
    // const { data: monthlyDeliveries } = await supabase
    //   .from('orders')
    //   .select('id', { count: 'exact', head: false })
    //   .eq('delivery_boy_phone', deliveryBoy.phone)
    //   .eq('order_status', 'Delivered')
    //   .gte('delivery_date', monthStart)

    return NextResponse.json({
      success: true,
      deliveries,
      stats: {
        todayTotal: todayDeliveries.length,
        todayCompleted: completed,
        todayPending: pending,
        monthlyTotal: monthlySlots?.length || 0
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
