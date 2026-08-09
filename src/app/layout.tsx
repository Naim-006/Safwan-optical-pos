import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from '@/contexts/theme-provider'
import { QueryProvider } from '@/contexts/query-provider'
import { LangProvider } from '@/contexts/lang-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import './globals.css'

const inter = localFont({
  src: [
    { path: './fonts/inter-7.woff2', style: 'normal', weight: '100 900' },
  ],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Safwan Opticals - Smart POS System',
  description: 'Professional optical shop management and POS system',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeProvider>
            <LangProvider>
              <TooltipProvider>
                {children}
                <Toaster richColors closeButton />
              </TooltipProvider>
            </LangProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
