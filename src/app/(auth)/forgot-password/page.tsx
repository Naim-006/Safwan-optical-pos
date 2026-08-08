'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validators'
import { useLang } from '@/contexts/lang-provider'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const { t } = useLang()
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordInput) => {
    if (!supabase) { toast.error('System not configured. Please set up Supabase.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/login`,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
    toast.success('Reset link sent!')
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="space-y-1 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-2xl">{t('auth.checkEmail')}</CardTitle>
          <CardDescription>
            {t('auth.resetLinkSent')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('auth.backToSignIn')}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t('auth.forgotPassword')}</CardTitle>
        <CardDescription>
          {t('auth.resetLinkSent')}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t('auth.sendResetLink')}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            <Link href="/login" className="text-primary hover:underline">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
