import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request) {
  try {
    const formData = await request.formData()
    const phone = formData.get('phone')
    const session = formData.get('session')
    const docType = formData.get('doc_type') // 'pan_card' or 'aadhar_card'
    const file = formData.get('file')

    if (!phone || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!docType || !['pan_card', 'aadhar_card'].includes(docType)) {
      return NextResponse.json({ success: false, error: 'Invalid document type. Must be pan_card or aadhar_card' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPG, PNG, and PDF files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File size must be less than 5MB' }, { status: 400 })
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

    const fileExt = file.name.split('.').pop().toLowerCase()
    const fileName = `${docType}-${phone}-${Date.now()}.${fileExt}`
    const filePath = `delivery-boy-docs/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('delivery-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading document:', uploadError)
      return NextResponse.json({ success: false, error: 'Failed to upload document' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('delivery-photos')
      .getPublicUrl(filePath)

    const docUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('delivery_boys')
      .update({ [`${docType}_url`]: docUrl })
      .eq('phone', phone)

    if (updateError) {
      console.error('Error saving document URL:', updateError)
      return NextResponse.json({ success: false, error: 'Failed to save document URL' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: docUrl, message: 'Document uploaded successfully' })
  } catch (error) {
    console.error('Error in upload-documents API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
