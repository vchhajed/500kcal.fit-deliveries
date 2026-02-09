import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
}

export async function POST(request) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Phone and password required' },
        { status: 400 }
      )
    }

    // Validate credentials against delivery_boys table
    // First, let's check what columns exist by selecting all
    const { data: deliveryBoy, error: deliveryBoyError } = await supabase
      .from('delivery_boys')
      .select('*')
      .eq('phone', phone)
      .single()

    if (deliveryBoyError || !deliveryBoy) {
      console.error('Delivery boy not found:', deliveryBoyError)
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }

    console.log('Delivery boy found:', deliveryBoy)
    console.log('Available columns:', Object.keys(deliveryBoy))

    // Check if password field exists (could be 'password', 'password_hash', or hashed with salt)
    let passwordValid = false

    if (deliveryBoy.password && deliveryBoy.password === password) {
      // Plain text password match
      console.log('Plain text password match')
      passwordValid = true
    } else if (deliveryBoy.password_hash && deliveryBoy.password_salt) {
      // Hashed password with salt
      const hashedPassword = hashPassword(password, deliveryBoy.password_salt)
      if (hashedPassword === deliveryBoy.password_hash) {
        passwordValid = true
      }
    }

    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }

    // Generate session token and update delivery_boys table
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Update session token in delivery_boys table (add session_token column if needed)
    const { error: updateError } = await supabase
      .from('delivery_boys')
      .update({ session_token: sessionToken })
      .eq('id', deliveryBoy.id)

    if (updateError) {
      console.error('Error updating session (might not have session_token column):', updateError)
      // Continue anyway - session will work without storing it
    }

    console.log('Login successful for:', deliveryBoy.name)

    return NextResponse.json({
      success: true,
      sessionToken,
      id: deliveryBoy.id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
