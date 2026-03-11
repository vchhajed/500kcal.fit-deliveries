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
    const session = searchParams.get('session')

    if (!phone || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('delivery_boys')
      .select('id, name, phone, bike_model, bike_mileage, avg_distance_per_order, petrol_rate, pan_card_url, aadhar_card_url')
      .eq('phone', phone)
      .single()

    if (error || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { phone, session, bike_model, bike_mileage, avg_distance_per_order, petrol_rate } = body

    if (!phone || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { data: deliveryBoy, error: authError } = await supabase
      .from('delivery_boys')
      .select('id')
      .eq('phone', phone)
      .single()

    if (authError || !deliveryBoy) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    const updateData = {}
    if (bike_model !== undefined) updateData.bike_model = bike_model
    if (bike_mileage !== undefined) updateData.bike_mileage = parseFloat(bike_mileage)
    if (avg_distance_per_order !== undefined) updateData.avg_distance_per_order = parseFloat(avg_distance_per_order)
    if (petrol_rate !== undefined) updateData.petrol_rate = parseFloat(petrol_rate)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('delivery_boys')
      .update(updateData)
      .eq('phone', phone)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
