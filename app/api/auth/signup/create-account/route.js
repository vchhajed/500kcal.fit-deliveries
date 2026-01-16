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
    const { phone, name, password } = await request.json()

    if (!phone || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Phone, name, and password required' },
        { status: 400 }
      )
    }

    if (phone.length !== 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if phone number already exists
    const { data: existingUser } = await supabase
      .from('customer_accounts')
      .select('id')
      .eq('phone_number', phone)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Phone number already registered' },
        { status: 400 }
      )
    }

    // Generate salt and hash password
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(password, salt)
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Create account with delivery_boy role
    const { data: newUser, error: createError } = await supabase
      .from('customer_accounts')
      .insert({
        phone_number: phone,
        name,
        password_hash: passwordHash,
        password_salt: salt,
        role: 'delivery_boy',
        session_token: sessionToken,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating account:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      )
    }

    // Also add to user_roles table
    await supabase
      .from('user_roles')
      .insert({
        phone_number: phone,
        name,
        role: 'delivery_boy',
      })

    return NextResponse.json({
      success: true,
      sessionToken,
      id: newUser.id,
      name: newUser.name,
      phone: newUser.phone_number
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
