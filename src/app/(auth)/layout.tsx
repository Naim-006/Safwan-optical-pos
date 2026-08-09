'use client'

import { Glasses } from 'lucide-react'
import Link from 'next/link'
import { useShopSettings } from '@/hooks/use-data'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: shop } = useShopSettings()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 bg-primary items-center justify-center p-12">
        <div className="text-center text-primary-foreground">
          <Glasses className="mx-auto h-16 w-16 mb-6" />
          <h1 className="text-3xl font-bold mb-2">{shop?.shopName || 'Safwan Opticals'}</h1>
          <p className="text-lg opacity-90">Smart POS &amp; Management System</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="md:hidden text-center mb-8">
            <Glasses className="mx-auto h-12 w-12 text-primary mb-3" />
            <h1 className="text-2xl font-bold">{shop?.shopName || 'Safwan Opticals'}</h1>
          </div>
          {children}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
