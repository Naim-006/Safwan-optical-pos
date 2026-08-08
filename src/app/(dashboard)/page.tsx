'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingCart, FileText, Users, Package, TrendingUp,
  DollarSign, CreditCard, Banknote, Receipt, ArrowUpRight,
  ArrowDownRight, Eye, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { useProducts, useCustomers, useInvoices } from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useLang()
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 200)
  const allInvoices = invoicesData?.data || []

  // ─── Today's stats ───
  const today = new Date().toISOString().slice(0, 10)
  const todayInvoices = allInvoices.filter((inv: any) =>
    inv.created_at?.startsWith(today) && inv.invoice_type !== 'receipt'
  )
  const todaySales = todayInvoices.reduce((sum: number, inv: any) =>
    sum + Number(inv.total_amount || 0), 0
  )
  const todayCount = todayInvoices.length

  // ─── Pending balance ───
  const pendingBalance = allInvoices
    .filter((inv: any) => inv.payment_status !== 'paid' && inv.invoice_type !== 'receipt')
    .reduce((sum: number, inv: any) => sum + Number(inv.balance_due || 0), 0)

  // ─── Weekly chart data ───
  const last7Days = useMemo(() => {
    const days: Record<string, { date: string; sales: number; invoices: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days[key] = { date: d.toLocaleDateString('en-SA', { weekday: 'short', day: 'numeric' }), sales: 0, invoices: 0 }
    }

    allInvoices.forEach((inv: any) => {
      const d = inv.created_at?.slice(0, 10)
      if (d && days[d] && inv.invoice_type !== 'receipt') {
        days[d].sales += Number(inv.total_amount || 0)
        days[d].invoices += 1
      }
    })

    return Object.values(days)
  }, [allInvoices])

  // ─── Recent transactions ───
  const recentTransactions = allInvoices
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // ─── Quick stats ───
  const totalSales = allInvoices
    .filter((inv: any) => inv.invoice_type !== 'receipt')
    .reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0)

  const paidTotal = allInvoices
    .filter((inv: any) => inv.payment_status === 'paid' && inv.invoice_type !== 'receipt')
    .reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0)

  // ─── Payment breakdown ───
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    allInvoices
      .filter((inv: any) => inv.invoice_type !== 'receipt')
      .forEach((inv: any) => {
        const m = inv.payment_method || 'cash'
        map[m] = (map[m] || 0) + Number(inv.total_amount || 0)
      })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [allInvoices])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('common.dashboard')}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">{t('common.welcomeBack')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push('/pos')}>
            <ShoppingCart className="h-4 w-4 mr-2" /> New Sale
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
            <div className="rounded-lg bg-green-500/10 p-1.5">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todaySales)}</div>
            <p className="text-xs text-muted-foreground mt-1">{todayCount} invoices today</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <div className="rounded-lg bg-blue-500/10 p-1.5">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground mt-1">In inventory</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <div className="rounded-lg bg-purple-500/10 p-1.5">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active members</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <div className="rounded-lg bg-red-500/10 p-1.5">
              <CreditCard className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Weekly Sales Overview</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Total: <strong>{formatCurrency(totalSales)}</strong></span>
                <span>Paid: <strong className="text-green-600">{formatCurrency(paidTotal)}</strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {last7Days.some((d: any) => d.sales > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Sales'] as [string, string]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="sales" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 opacity-20 mr-3" />
                <span>No sales data yet</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => router.push('/invoices')}>
              View all <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((inv: any) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className={`rounded-full p-2 ${inv.invoice_type === 'receipt' ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                    {inv.invoice_type === 'receipt'
                      ? <Receipt className="h-4 w-4 text-orange-600" />
                      : <FileText className="h-4 w-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inv.customer_name || 'Walk-in'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.invoice_number} &middot; {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(inv.total_amount)}</p>
                    <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">
                      {inv.payment_status}
                    </Badge>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Sales and invoices will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Payment Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/pos" className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-blue-500/10 p-3 group-hover:bg-blue-500/20 transition-colors">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-semibold">New Sale</span>
              <span className="text-xs text-muted-foreground">POS billing</span>
            </Link>
            <Link href="/invoices/new" className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-green-500/10 p-3 group-hover:bg-green-500/20 transition-colors">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm font-semibold">New Invoice</span>
              <span className="text-xs text-muted-foreground">Optical Rx invoice</span>
            </Link>
            <Link href="/receipts/new" className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-orange-500/10 p-3 group-hover:bg-orange-500/20 transition-colors">
                <Receipt className="h-6 w-6 text-orange-600" />
              </div>
              <span className="text-sm font-semibold">New Receipt</span>
              <span className="text-xs text-muted-foreground">Payment voucher</span>
            </Link>
            <Link href="/customers" className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-purple-500/10 p-3 group-hover:bg-purple-500/20 transition-colors">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-semibold">Customers</span>
              <span className="text-xs text-muted-foreground">Manage members</span>
            </Link>
            <Link href="/inventory" className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-cyan-500/10 p-3 group-hover:bg-cyan-500/20 transition-colors">
                <Package className="h-6 w-6 text-cyan-600" />
              </div>
              <span className="text-sm font-semibold">Inventory</span>
              <span className="text-xs text-muted-foreground">Stock management</span>
            </Link>
            <Link href="/reports" className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="rounded-full bg-rose-500/10 p-3 group-hover:bg-rose-500/20 transition-colors">
                <TrendingUp className="h-6 w-6 text-rose-600" />
              </div>
              <span className="text-sm font-semibold">Reports</span>
              <span className="text-xs text-muted-foreground">Analytics & charts</span>
            </Link>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length > 0 ? (
              <div className="space-y-3">
                {paymentBreakdown.map((item) => {
                  const total = paymentBreakdown.reduce((s, i) => s + i.value, 0)
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                  const colors: Record<string, string> = {
                    cash: 'bg-green-500',
                    card: 'bg-blue-500',
                    transfer: 'bg-purple-500',
                  }
                  const labels: Record<string, string> = {
                    cash: 'Cash', card: 'Card', transfer: 'Transfer',
                  }
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{labels[item.name] || item.name}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors[item.name] || 'bg-gray-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.value)}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Banknote className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No payment data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
