'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, FileText, ShoppingCart,
  CreditCard, Download, Calendar, Users, Package, ArrowUp,
  ArrowDown, Minus, Receipt,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  Legend,
} from 'recharts'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSalesReport, useInvoices, useProducts, useCustomers } from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'

type DateRange = 'today' | '7days' | '30days' | 'all'

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
const CHART_BLUE = 'hsl(217, 91%, 60%)'
const CHART_GREEN = 'hsl(142, 71%, 45%)'
const CHART_RED = 'hsl(0, 84%, 60%)'

export default function ReportsPage() {
  const { t } = useLang()
  const [range, setRange] = useState<DateRange>('30days')

  const getRange = (r: DateRange) => {
    const end = new Date()
    const start = new Date()
    switch (r) {
      case 'today': start.setHours(0, 0, 0, 0); break
      case '7days': start.setDate(end.getDate() - 7); break
      case '30days': start.setDate(end.getDate() - 30); break
      case 'all': start.setFullYear(2020); break
    }
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }

  const { start, end } = getRange(range)
  const { data: report } = useSalesReport(start, end)
  const { data: invoicesData } = useInvoices(1, 200)
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()

  const allData = (invoicesData?.data || []).filter((inv: any) => inv.invoice_type !== 'receipt')

  // ─── Chart data ───
  const chartData = useMemo(() => {
    const map: Record<string, any> = {}
    allData.forEach((inv: any) => {
      const d = inv.created_at?.slice(0, 10)
      if (!d) return
      if (!map[d]) map[d] = { date: d, sales: 0, paid: 0, invoices: 0 }
      map[d].sales += Number(inv.total_amount || 0)
      if (inv.payment_status === 'paid') map[d].paid += Number(inv.total_amount || 0)
      map[d].invoices += 1
    })
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }, [allData])

  // ─── Payment status breakdown ───
  const statusData = useMemo(() => {
    const map: Record<string, number> = { paid: 0, partial: 0, unpaid: 0 }
    allData.forEach((inv: any) => {
      const s = inv.payment_status || 'unpaid'
      map[s] = (map[s] || 0) + Number(inv.total_amount || 0)
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
  }, [allData])

  // ─── Top products ───
  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    const itemData = invoicesData?.data || []
    itemData.forEach((inv: any) => {
      if (inv.invoice_type === 'receipt') return
      const name = inv.customer_name || 'Walk-in'
      map[name] = (map[name] || 0) + Number(inv.total_amount || 0)
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }))
  }, [invoicesData])

  // ─── Revenue vs Collection ───
  const totalRevenue = allData.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
  const totalCollected = allData.reduce((s: number, i: any) =>
    s + (i.payment_status === 'paid' ? Number(i.total_amount || 0) : Number(i.amount_paid || 0)), 0
  )
  const collectionRate = totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0

  // ─── Trend calculation ───
  const prevRange = useMemo(() => {
    const last = chartData.length
    if (last < 2) return 0
    const prev = chartData.slice(0, Math.max(1, last - 1)).reduce((s: number, d: any) => s + d.sales, 0)
    const curr = chartData[last - 1]?.sales || 0
    return prev > 0 ? Math.round(((curr - prev / (last - 1)) / (prev / (last - 1))) * 100) : 0
  }, [chartData])

  // ─── PDF Export ───
  const handlePDF = () => {
    const doc = new jsPDF()
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.text('Sales Report', 14, 20)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.text(`${start} to ${end}`, 14, 38)

    doc.setFontSize(12)
    doc.text(`Total Sales: ${formatCurrency(totalRevenue)}`, 14, 48)
    doc.text(`Total Invoices: ${allData.length}`, 14, 56)
    doc.text(`Average Order: ${formatCurrency(allData.length ? totalRevenue / allData.length : 0)}`, 14, 64)
    doc.text(`Collection Rate: ${collectionRate}%`, 14, 72)

    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Sales', 'Invoices', 'Collected']],
      body: chartData.map((d: any) => [
        d.date, formatCurrency(d.sales), String(d.invoices), formatCurrency(d.paid),
      ]),
    })

    doc.save(`sales_report_${start}_${end}.pdf`)
    toast.success('Report downloaded')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('reports.title')}</h1>
          <p className="text-muted-foreground">
            {start} — {end}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto no-scrollbar">
            {(['today', '7days', '30days', 'all'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'ghost'}
                size="sm"
                className="rounded-md text-xs whitespace-nowrap"
                onClick={() => setRange(r)}
              >
                {r === 'today' ? 'Today' : r === '7days' ? '7D' : r === '30days' ? '30D' : 'All'}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-blue-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <div className="rounded-lg bg-blue-500/10 p-1.5">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{formatCurrency(totalRevenue)}</div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {prevRange > 0 ? (
                <><ArrowUp className="h-3 w-3 text-green-600" /><span className="text-green-600">+{prevRange}%</span></>
              ) : prevRange < 0 ? (
                <><ArrowDown className="h-3 w-3 text-red-600" /><span className="text-red-600">{prevRange}%</span></>
              ) : (
                <><Minus className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">0%</span></>
              )}
              <span className="text-muted-foreground">from previous</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-green-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <div className="rounded-lg bg-green-500/10 p-1.5">
              <CreditCard className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{formatCurrency(totalCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">{collectionRate}% collection rate</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-purple-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <div className="rounded-lg bg-purple-500/10 p-1.5">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{allData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Avg: {formatCurrency(allData.length ? totalRevenue / allData.length : 0)}</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-orange-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <div className="rounded-lg bg-orange-500/10 p-1.5">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{formatCurrency(totalRevenue - totalCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Revenue Trend</CardTitle>
                <p className="text-sm text-muted-foreground">Daily sales vs collections</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_BLUE }} />
                  <span className="text-muted-foreground">Sales</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_GREEN }} />
                  <span className="text-muted-foreground">Collected</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke={CHART_BLUE} strokeWidth={2} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="paid" stroke={CHART_GREEN} strokeWidth={2} fill="url(#colorPaid)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 opacity-20 mr-3" />
                <span>No data for this period</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((item, i) => {
                    const total = statusData.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                    return (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{pct}%</span>
                          <span className="font-medium">{formatCurrency(item.value)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <span>No data</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Top Customers by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((item, i) => {
                  const max = topProducts[0]?.total || 1
                  const pct = Math.round((item.total / max) * 100)
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                          <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                        </div>
                        <span className="font-bold">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No customer data</div>
            )}
          </CardContent>
        </Card>

        {/* Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allData.length > 0 ? (
              <div className="scroll-x -mx-1 px-1">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allData.slice(0, 8).map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm">{inv.customer_name || 'Walk-in'}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">
                            {inv.payment_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No transactions</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <Package className="h-5 w-5 text-cyan-600" />
            <span className="text-lg font-bold">{products.length}</span>
            <span className="text-[10px] text-muted-foreground">Products</span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <Users className="h-5 w-5 text-purple-600" />
            <span className="text-lg font-bold">{customers.length}</span>
            <span className="text-[10px] text-muted-foreground">Customers</span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-bold">{allData.length}</span>
            <span className="text-[10px] text-muted-foreground">Invoices</span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            <span className="text-lg font-bold">{collectionRate}%</span>
            <span className="text-[10px] text-muted-foreground">Collected</span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <DollarSign className="h-5 w-5 text-orange-600" />
            <span className="text-lg font-bold">{formatCurrency(allData.length ? totalRevenue / allData.length : 0)}</span>
            <span className="text-[10px] text-muted-foreground">Avg Order</span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex flex-col items-center gap-1 p-2">
            <ShoppingCart className="h-5 w-5 text-red-600" />
            <span className="text-lg font-bold">{formatCurrency(totalRevenue - totalCollected)}</span>
            <span className="text-[10px] text-muted-foreground">Pending</span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
