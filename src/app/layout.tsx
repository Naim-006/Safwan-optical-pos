import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/contexts/theme-provider'
import { QueryProvider } from '@/contexts/query-provider'
import { LangProvider } from '@/contexts/lang-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Safwan Opticals - Smart POS System',
  description: 'Professional optical shop management and POS system',
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
