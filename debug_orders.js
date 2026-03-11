const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mcboyeyzneazwgfwvzzx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jYm95ZXl6bmVhendnZnd2enp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwODYwOSwiZXhwIjoyMDc2Nzg0NjA5fQ.eJqzcLOBaru1TUqSeehJLvhuKLtk7VP4AgIaJEZ4uis'
)

async function debugOrders() {
  const today = '2026-03-02' // March 2nd, 2026
  console.log('=== Debugging Orders for:', today, '===\n')

  // 1. Check all orders for today
  console.log('1. Fetching ALL orders for today...')
  const { data: allTodayOrders, error: error1 } = await supabase
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
    .eq('delivery_date', today)
    .order('meal_slot', { ascending: true })

  if (error1) {
    console.error('Error fetching all orders:', error1)
  } else {
    console.log(`Total orders for today: ${allTodayOrders?.length || 0}`)

    // Check unique meal_slot values
    const uniqueSlots = [...new Set(allTodayOrders?.map(o => o.meal_slot))]
    console.log('\nUnique meal_slot values found:')
    uniqueSlots.forEach(slot => {
      const count = allTodayOrders.filter(o => o.meal_slot === slot).length
      console.log(`  - "${slot}": ${count} orders`)
    })

    // Group by meal slot
    const breakfast = allTodayOrders?.filter(o => o.meal_slot === 'Breakfast') || []
    const lunch = allTodayOrders?.filter(o => o.meal_slot === 'Lunch') || []
    const dinner = allTodayOrders?.filter(o => o.meal_slot === 'Dinner') || []

    console.log(`\nExpected meal slots:`)
    console.log(`  - Breakfast: ${breakfast.length}`)
    console.log(`  - Lunch: ${lunch.length}`)
    console.log(`  - Dinner: ${dinner.length}\n`)

    // Show first 5 orders with their actual meal_slot values
    console.log('Sample orders (showing actual meal_slot values):')
    allTodayOrders.slice(0, 5).forEach((order, idx) => {
      console.log(`  ${idx + 1}. Order ID: ${order.id}`)
      console.log(`     Customer: ${order.customer?.name || 'N/A'}`)
      console.log(`     Menu Item: ${order.menu_item?.name || 'N/A'}`)
      console.log(`     Status: ${order.order_status}`)
      console.log(`     Meal Slot: "${order.meal_slot}"`)
      console.log(`     Delivery Boy Phone: ${order.delivery_boy_phone || 'NOT ASSIGNED'}`)
      console.log('')
    })
  }

  // 2. Check delivery boys
  console.log('\n2. Fetching all delivery boys...')
  const { data: deliveryBoys, error: error2 } = await supabase
    .from('delivery_boys')
    .select('*')

  if (error2) {
    console.error('Error fetching delivery boys:', error2)
  } else {
    console.log(`Total delivery boys: ${deliveryBoys?.length || 0}`)
    deliveryBoys?.forEach(db => {
      console.log(`  - ${db.name} (Phone: ${db.phone})`)
    })
  }

  // 3. Check orders assigned to each delivery boy for today
  console.log('\n3. Orders by delivery boy for today...')
  if (deliveryBoys && deliveryBoys.length > 0) {
    for (const db of deliveryBoys) {
      const { data: dbOrders, error: error3 } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customer_accounts!orders_customer_id_fkey(name),
          menu_item:recipes(name)
        `)
        .eq('delivery_boy_phone', db.phone)
        .eq('delivery_date', today)
        .order('meal_slot', { ascending: true })

      if (error3) {
        console.error(`Error fetching orders for ${db.name}:`, error3)
      } else {
        console.log(`\n  ${db.name} (${db.phone}): ${dbOrders?.length || 0} orders`)

        if (dbOrders && dbOrders.length > 0) {
          const breakfast = dbOrders.filter(o => o.meal_slot === 'Breakfast')
          const lunch = dbOrders.filter(o => o.meal_slot === 'Lunch')
          const dinner = dbOrders.filter(o => o.meal_slot === 'Dinner')

          console.log(`    - Breakfast: ${breakfast.length}`)
          console.log(`    - Lunch: ${lunch.length}`)
          console.log(`    - Dinner: ${dinner.length}`)

          if (breakfast.length > 0) {
            console.log('\n    Breakfast Orders:')
            breakfast.forEach((order, idx) => {
              console.log(`      ${idx + 1}. ${order.customer?.name || 'N/A'} - ${order.menu_item?.name || 'N/A'} (${order.order_status})`)
            })
          }
        }
      }
    }
  }

  // 4. Check for orders without delivery boy assigned
  console.log('\n\n4. Orders without delivery boy assigned for today...')
  const { data: unassignedOrders, error: error4 } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customer_accounts!orders_customer_id_fkey(name),
      menu_item:recipes(name)
    `)
    .eq('delivery_date', today)
    .or('delivery_boy_phone.is.null,delivery_boy_phone.eq.')
    .order('meal_slot', { ascending: true })

  if (error4) {
    console.error('Error fetching unassigned orders:', error4)
  } else {
    console.log(`Total unassigned orders: ${unassignedOrders?.length || 0}`)

    if (unassignedOrders && unassignedOrders.length > 0) {
      unassignedOrders.forEach((order, idx) => {
        console.log(`  ${idx + 1}. ${order.meal_slot} - ${order.customer?.name || 'N/A'} - ${order.menu_item?.name || 'N/A'}`)
      })
    }
  }
}

debugOrders().catch(console.error)
