import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('Auth confirm hit:', { token_hash: token_hash ? 'present' : 'missing', type, next })

  if (!token_hash || !type) {
    console.log('Missing token_hash or type')
    return NextResponse.redirect(`${request.nextUrl.origin}/login?error=auth`)
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  })

  console.log('verifyOtp result:', { error, hasData: !!data })

  if (!error) {
    return NextResponse.redirect(`${request.nextUrl.origin}${next}`)
  }

  console.log('verifyOtp error:', error)
  return NextResponse.redirect(`${request.nextUrl.origin}/login?error=auth`)
}
