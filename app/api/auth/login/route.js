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

// Hardcoded test credentials (temporary - will be removed later)
const HARDCODED_USERS = [
  {
    phone: '8087406269',
    password: '123456', // 6-digit password
    name: 'Test Delivery Boy 1',
    id: 'hardcoded-user-1'
  },
  {
    phone: '9730425526',
    password: '12345', // 5-digit password
    name: 'Test Delivery Boy 2',
    id: 'hardcoded-user-2'
  }
]

export async function POST(request) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Phone and password required' },
        { status: 400 }
      )
    }

    // Check hardcoded credentials first
    const hardcodedUser = HARDCODED_USERS.find(u => u.phone === phone)
    if (hardcodedUser) {
      if (hardcodedUser.password === password) {
        // Generate session token for hardcoded user
        const sessionToken = crypto.randomBytes(32).toString('hex')

        console.log('Hardcoded user login successful:', hardcodedUser.name)

        return NextResponse.json({
          success: true,
          sessionToken,
          id: hardcodedUser.id,
          name: hardcodedUser.name,
          phone: hardcodedUser.phone
        })
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid phone number or password' },
          { status: 401 }
        )
      }
    }

    // If not hardcoded, check database
    const { data: user, error: userError } = await supabase
      .from('customer_accounts')
      .select('id, name, phone_number, password_hash, password_salt, role')
      .eq('phone_number', phone)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }

    // Verify role
    if (user.role !== 'delivery_boy') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Delivery personnel only.' },
        { status: 403 }
      )
    }

    // Verify password
    const hashedPassword = hashPassword(password, user.password_salt)
    if (hashedPassword !== user.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Update session token
    const { error: updateError } = await supabase
      .from('customer_accounts')
      .update({ session_token: sessionToken })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating session:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionToken,
      id: user.id,
      name: user.name,
      phone: user.phone_number
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
