const fetch = require('node-fetch')

async function testAPI() {
  console.log('=== Testing Deliveries API ===\n')

  // Test with Arman's phone number
  const phone = '8087406269'
  const session = 'test-session'

  const url = `http://localhost:3002/api/deliveries?phone=${phone}&session=${session}`

  console.log('Fetching from:', url)
  console.log('')

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      console.log('✓ API call successful')
      console.log(`Total deliveries: ${data.deliveries.length}`)
      console.log('')

      // Group by meal slot
      const breakfast = data.deliveries.filter(d => d.meal_slot === 'Breakfast')
      const lunch = data.deliveries.filter(d => d.meal_slot === 'Lunch')
      const dinner = data.deliveries.filter(d => d.meal_slot === 'Dinner')

      console.log('Meal slot breakdown:')
      console.log(`  - Breakfast: ${breakfast.length}`)
      console.log(`  - Lunch: ${lunch.length}`)
      console.log(`  - Dinner: ${dinner.length}`)
      console.log('')

      console.log('Stats:')
      console.log(`  - Today Total: ${data.stats.todayTotal}`)
      console.log(`  - Today Completed: ${data.stats.todayCompleted}`)
      console.log(`  - Today Pending: ${data.stats.todayPending}`)
      console.log(`  - Monthly Total: ${data.stats.monthlyTotal}`)
      console.log('')

      if (breakfast.length > 0) {
        console.log('Sample Breakfast Orders:')
        breakfast.slice(0, 3).forEach((order, idx) => {
          console.log(`  ${idx + 1}. ${order.customer?.name || 'N/A'} - ${order.menu_item?.name || 'N/A'}`)
          console.log(`     Meal Slot: "${order.meal_slot}"`)
          console.log(`     Status: ${order.order_status}`)
          console.log('')
        })
      }
    } else {
      console.log('✗ API call failed:', data.error)
    }
  } catch (error) {
    console.error('Error calling API:', error.message)
  }
}

testAPI()
