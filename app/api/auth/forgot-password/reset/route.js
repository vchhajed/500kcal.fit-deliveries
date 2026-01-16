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
    const { phone, newPassword } = await request.json()

    if (!phone || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Phone and new password required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Get user account
    const { data: user, error: userError } = await supabase
      .from('customer_accounts')
      .select('id, role')
      .eq('phone_number', phone)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    if (user.role !== 'delivery_boy') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Generate new salt and hash
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(newPassword, salt)

    // Update password
    const { error: updateError } = await supabase
      .from('customer_accounts')
      .update({
        password_hash: passwordHash,
        password_salt: salt,
        session_token: null, // Clear session token
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
