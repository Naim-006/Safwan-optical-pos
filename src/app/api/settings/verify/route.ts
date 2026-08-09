import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storeCode, verifyCode } from '@/lib/verify-codes'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  // VERIFY mode — user submitted a code
  if (body.action === 'verify' && body.code) {
    const valid = verifyCode(user.email, body.code)
    return NextResponse.json({ success: valid, error: valid ? null : 'Invalid code' })
  }

  // SEND mode — generate and send code
  const code = storeCode(user.email)

  // Show the code in response (for UI display)
  return NextResponse.json({
    success: true,
    message: 'Enter the verification code from your email',
    maskedEmail: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
    code, // Include code so the frontend can verify client-side OR show it
  })
}
