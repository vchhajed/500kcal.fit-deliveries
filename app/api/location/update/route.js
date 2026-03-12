import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { phone, session, lat, lng } = await request.json()

    if (!phone || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (lat == null || lng == null) {
      return NextResponse.json({ success: false, error: 'lat and lng required' }, { status: 400 })
    }

    // Verify delivery boy exists
    const { data: deliveryBoy, error: authError } = await supabase
      .from('delivery_boys')
      .select('id')
      .eq('phone', phone)
      .single()

    if (authError || !deliveryBoy) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const { error } = await supabase
      .from('delivery_boys')
      .update({
        current_lat: lat,
        current_lng: lng,
        location_updated_at: new Date().toISOString(),
      })
      .eq('phone', phone)

    if (error) {
      console.error('Error updating location:', error)
      return NextResponse.json({ success: false, error: 'Failed to update location' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Location update error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
