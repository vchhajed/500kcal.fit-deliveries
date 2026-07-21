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

    // Check if phone already exists in delivery_boys (the active auth table)
    const { data: existing } = await supabase
      .from('delivery_boys')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Phone number already registered' },
        { status: 400 }
      )
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(password, salt)
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Insert into delivery_boys — the table used by login + all delivery APIs
    const { data: newBoy, error: insertError } = await supabase
      .from('delivery_boys')
      .insert({
        name,
        phone,
        password_hash: passwordHash,
        password_salt: salt,
        session_token: sessionToken,
      })
      .select('id, name, phone')
      .single()

    if (insertError) {
      console.error('Error creating delivery boy account:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      )
    }

    console.log('New delivery boy registered:', newBoy.name, newBoy.phone)

    return NextResponse.json({
      success: true,
      sessionToken,
      id: newBoy.id,
      name: newBoy.name,
      phone: newBoy.phone,
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
