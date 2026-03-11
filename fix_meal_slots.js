const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mcboyeyzneazwgfwvzzx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jYm95ZXl6bmVhendnZnd2enp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIwODYwOSwiZXhwIjoyMDc2Nzg0NjA5fQ.eJqzcLOBaru1TUqSeehJLvhuKLtk7VP4AgIaJEZ4uis'
)

const normalizeMealSlot = (slot) => {
  if (!slot) return 'Unknown'

  const slotLower = slot.toLowerCase().trim()

  // Handle time ranges - map to meal slots
  if (slotLower.match(/^0[67]:\d{2}-0[89]:\d{2}$/) || slotLower.match(/^08:\d{2}-0[89]:\d{2}$/) || slotLower.match(/^09:\d{2}-09:\d{2}$/)) {
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

async function fixMealSlots() {
  console.log('=== Starting Meal Slot Normalization ===\n')

  // 1. Check current state
  console.log('1. Checking current meal_slot values...')
  const { data: allOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, meal_slot, delivery_date')

  if (fetchError) {
    console.error('Error fetching orders:', fetchError)
    return
  }

  console.log(`Total orders found: ${allOrders.length}\n`)

  // Group by meal slot
  const slotCounts = {}
  allOrders.forEach(order => {
    const slot = order.meal_slot || 'NULL'
    slotCounts[slot] = (slotCounts[slot] || 0) + 1
  })

  console.log('Current meal_slot distribution:')
  Object.entries(slotCounts).sort().forEach(([slot, count]) => {
    console.log(`  - "${slot}": ${count}`)
  })

  // 2. Identify orders that need fixing
  const ordersToFix = allOrders.filter(order => {
    const normalized = normalizeMealSlot(order.meal_slot)
    return normalized !== order.meal_slot
  })

  console.log(`\nOrders that need fixing: ${ordersToFix.length}`)

  if (ordersToFix.length === 0) {
    console.log('\n✓ All meal_slot values are already normalized!')
    return
  }

  // 3. Show what will be changed
  console.log('\nSample changes that will be made:')
  ordersToFix.slice(0, 10).forEach((order, idx) => {
    console.log(`  ${idx + 1}. "${order.meal_slot}" → "${normalizeMealSlot(order.meal_slot)}"`)
  })

  // 4. Ask for confirmation
  console.log(`\n⚠️  About to update ${ordersToFix.length} orders`)
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n')

  await new Promise(resolve => setTimeout(resolve, 5000))

  // 5. Perform the update
  console.log('Updating orders...')
  let successCount = 0
  let errorCount = 0

  for (const order of ordersToFix) {
    const normalized = normalizeMealSlot(order.meal_slot)

    const { error } = await supabase
      .from('orders')
      .update({ meal_slot: normalized })
      .eq('id', order.id)

    if (error) {
      console.error(`Error updating order ${order.id}:`, error)
      errorCount++
    } else {
      successCount++
      if (successCount % 10 === 0) {
        console.log(`  Updated ${successCount} orders...`)
      }
    }
  }

  console.log(`\n✓ Update complete!`)
  console.log(`  - Successfully updated: ${successCount}`)
  console.log(`  - Errors: ${errorCount}`)

  // 6. Verify the changes
  console.log('\n6. Verifying changes...')
  const { data: updatedOrders } = await supabase
    .from('orders')
    .select('meal_slot')

  const newSlotCounts = {}
  updatedOrders.forEach(order => {
    const slot = order.meal_slot || 'NULL'
    newSlotCounts[slot] = (newSlotCounts[slot] || 0) + 1
  })

  console.log('\nNew meal_slot distribution:')
  Object.entries(newSlotCounts).sort().forEach(([slot, count]) => {
    console.log(`  - "${slot}": ${count}`)
  })

  // Check for any remaining non-standard values
  const nonStandard = Object.keys(newSlotCounts).filter(
    slot => !['Breakfast', 'Lunch', 'Dinner'].includes(slot)
  )

  if (nonStandard.length > 0) {
    console.log('\n⚠️  Warning: Non-standard meal_slot values still exist:')
    nonStandard.forEach(slot => {
      console.log(`  - "${slot}": ${newSlotCounts[slot]}`)
    })
  } else {
    console.log('\n✓ All meal_slot values are now standardized!')
  }
}

fixMealSlots().catch(console.error)
