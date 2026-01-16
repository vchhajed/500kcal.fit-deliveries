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

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number required' },
        { status: 400 }
      )
    }

    // Check if account exists
    const { data: user, error } = await supabase
      .from('customer_accounts')
      .select('id, role')
      .eq('phone_number', phone)
      .single()

    if (error || !user) {
      return NextResponse.json({
        success: true,
        exists: false
      })
    }

    return NextResponse.json({
      success: true,
      exists: true,
      role: user.role
    })

  } catch (error) {
    console.error('Error checking account:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
