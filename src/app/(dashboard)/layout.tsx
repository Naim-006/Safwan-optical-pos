'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  Package,
  BarChart3,
  MessageSquare,
  Settings,
  Receipt,
  HardDrive,
  Wallet,
  Menu,
  X,
  Glasses,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button, buttonVariants } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'
import { useShopSettings } from '@/hooks/use-data'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { t, lang } = useLang()
  const { data: shop } = useShopSettings()
  const [userEmail, setUserEmail] = useState<string>('')
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email)
    })
  }, [supabase])

  const navigation = [
    {
      title: t('common.main') || 'Main',
      items: [
        { name: t('common.dashboard'), href: '/', icon: LayoutDashboard },
        { name: t('common.pos'), href: '/pos', icon: ShoppingCart },
      ],
    },
    {
      title: t('common.management') || 'Management',
      items: [
        { name: t('common.invoices'), href: '/invoices', icon: FileText },
        { name: t('common.receipts'), href: '/receipts', icon: Receipt },
        { name: t('common.customers'), href: '/customers', icon: Users },
        { name: t('common.inventory'), href: '/inventory', icon: Package },
        { name: t('common.finance'), href: '/finance', icon: Wallet },
      ],
    },
    {
      title: t('common.tools') || 'Tools',
      items: [
        { name: t('common.reports'), href: '/reports', icon: BarChart3 },
        { name: t('common.messages'), href: '/messages', icon: MessageSquare },
      ],
    },
    {
      title: t('common.system') || 'System',
      items: [
        { name: t('common.settings'), href: '/settings', icon: Settings },
      ],
    },
  ]

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-card flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Glasses className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">{shop?.shopName || 'Safwan Opticals'}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          {navigation.map((group, i) => (
            <div key={group.title} className="px-3 mb-2">
              <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h2>
              {group.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
              {i < navigation.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="h-4 w-4 mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="h-4 w-4 mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="h-4 w-4 mr-2" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'flex items-center gap-2'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>SA</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate max-w-[180px]">{userEmail || 'Signed in'}</span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch justify-around border-t bg-card/95 backdrop-blur lg:hidden safe-bottom">
        {[
          { name: t('common.dashboard'), href: '/', icon: LayoutDashboard },
          { name: t('common.pos'), href: '/pos', icon: ShoppingCart },
          { name: t('common.invoices'), href: '/invoices', icon: FileText },
          { name: t('common.customers'), href: '/customers', icon: Users },
        ].map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'scale-110')} />
              <span className="truncate max-w-full px-1">{item.name}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="truncate max-w-full px-1">{t('common.system')}</span>
        </button>
      </nav>
    </div>
  )
}
