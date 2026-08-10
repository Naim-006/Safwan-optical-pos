'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, FileText, ShoppingCart,
  CreditCard, Download, Users, Package, ArrowUp, ArrowDown, Minus,
  Wallet, Printer, FileSpreadsheet, Search, Calendar, Boxes, Layers,
  BarChart3, Receipt, Eye, BadgePercent,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useProducts, useCustomers, useShopSettings, useInvoicesByDateRange, useProductSales,
} from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'
import {
  resolveRange, computeKpis, trend, buildDaily, buildPaymentStatus, buildPaymentMethods,
  buildWeekday, buildDiscounts,
  aggregateProducts, aggregateCategories, aggregateCustomers, sortProducts, todayIso, daysAgoIso,
  type SortKey, type SortDir, type ProductAgg, type CustomerAgg,
} from './report-utils'
import {
  exportReportPdf, printReport, exportReportExcel,
  type ReportBundle, type ReportKind,
} from './report-pdf'

type RangePreset = 'today' | '30days' | 'all' | 'custom'
type CustSortKey = 'revenue' | 'paid' | 'outstanding' | 'invoices' | 'name'
type InvSortKey = 'date' | 'amount' | 'status'

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']
const CHART_BLUE = 'hsl(217, 91%, 60%)'
const CHART_GREEN = 'hsl(142, 71%, 45%)'

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: '#22c55e',
  card: '#3b82f6',
  transfer: '#8b5cf6',
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  unpaid: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const tooltipStyle = { borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }

function TrendBadge({ value }: { value: number }) {
  if (value > 0) {
    return <span className="inline-flex items-center gap-0.5 font-medium text-green-600"><ArrowUp className="h-3 w-3" />{value}%</span>
  }
  if (value < 0) {
    return <span className="inline-flex items-center gap-0.5 font-medium text-red-600"><ArrowDown className="h-3 w-3" />{value}%</span>
  }
  return <span className="inline-flex items-center gap-0.5 font-medium text-muted-foreground"><Minus className="h-3 w-3" />0%</span>
}

function KpiCard({
  label, value, sub, icon: Icon, tint, iconColor, accent, trendValue, showTrend,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  icon: React.ElementType
  tint: string
  iconColor: string
  accent: string
  trendValue?: number
  showTrend?: boolean
}) {
  return (
    <Card size="sm" className="relative h-full overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <CardContent className="flex items-center gap-3">
        <div className={`shrink-0 grid h-9 w-9 place-items-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold leading-tight">{value}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {showTrend && trendValue != null && <TrendBadge value={trendValue} />}
            {sub}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-muted-foreground">
      <TrendingUp className="h-10 w-10 opacity-20 mr-3" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export default function ReportsPage() {
  const { t } = useLang()
  const [preset, setPreset] = useState<RangePreset>('30days')
  const [customFrom, setCustomFrom] = useState(() => daysAgoIso(30))
  const [customTo, setCustomTo] = useState(() => todayIso())
  const [prodSearch, setProdSearch] = useState('')
  const [prodSort, setProdSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'revenue', dir: 'desc' })
  const [custSort, setCustSort] = useState<{ key: CustSortKey; dir: SortDir }>({ key: 'revenue', dir: 'desc' })
  const [invSearch, setInvSearch] = useState('')
  const [invSort, setInvSort] = useState<InvSortKey>('date')
  const [drillProduct, setDrillProduct] = useState<ProductAgg | null>(null)

  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo])
  const { start, end, prevStart, prevEnd, label, isCustom } = range

  const { data: shop } = useShopSettings()
  const { data: currentInvoices = [], isLoading: invoicesLoading } = useInvoicesByDateRange(start, end)
  const { data: currentItems = [], isLoading: itemsLoading } = useProductSales(start, end)
  const { data: prevInvoices = [] } = useInvoicesByDateRange(prevStart, prevEnd)
  const { data: prevItems = [] } = useProductSales(prevStart, prevEnd)
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()

  const currency = shop?.currency || 'SAR'
  const loading = invoicesLoading || itemsLoading

  const productById = useMemo(() => {
    const m: Record<string, Record<string, any>> = {}
    products.forEach((p: any) => { m[p.id] = p })
    return m
  }, [products])

  const invoices = useMemo(
    () => currentInvoices.filter((inv: any) => inv.invoice_type !== 'receipt'),
    [currentInvoices]
  )
  const prevInvoicesFiltered = useMemo(
    () => prevInvoices.filter((inv: any) => inv.invoice_type !== 'receipt'),
    [prevInvoices]
  )

  // ─── Aggregations ───
  const kpis = useMemo(() => computeKpis(invoices, currentItems), [invoices, currentItems])
  const prevKpis = useMemo(() => computeKpis(prevInvoicesFiltered, prevItems), [prevInvoicesFiltered, prevItems])
  const daily = useMemo(() => buildDaily(invoices, currentItems), [invoices, currentItems])
  const paymentStatus = useMemo(() => buildPaymentStatus(invoices), [invoices])
  const paymentMethods = useMemo(() => buildPaymentMethods(invoices), [invoices])
  const weekday = useMemo(() => buildWeekday(invoices), [invoices])
  const discounts = useMemo(() => buildDiscounts(invoices), [invoices])

  const allProducts = useMemo(() => aggregateProducts(currentItems, productById), [currentItems, productById])
  const categories = useMemo(() => aggregateCategories(allProducts), [allProducts])
  const customersAgg = useMemo(() => aggregateCustomers(invoices), [invoices])

  const showTrend = preset !== 'all'

  // ─── Product view (search + sort) ───
  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase()
    if (!q) return allProducts
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    )
  }, [allProducts, prodSearch])

  const visibleProducts = useMemo(
    () => sortProducts(filteredProducts, prodSort.key, prodSort.dir),
    [filteredProducts, prodSort]
  )
  const topProducts = visibleProducts.slice(0, 8)
  const productsTotal = visibleProducts.reduce((s, p) => s + p.revenue, 0)

  // ─── Product drill-down (which invoices sold a product) ───
  const drillItems = useMemo(() => {
    if (!drillProduct) return []
    return currentItems
      .filter((it: any) => (drillProduct.product_id ? it.product_id === drillProduct.product_id : it.description === drillProduct.name))
      .map((it: any) => ({
        id: it.id,
        invoiceId: it.invoices?.id,
        invoiceNumber: it.invoices?.invoice_number,
        date: it.invoices?.created_at,
        customer: it.invoices?.customer_name,
        status: it.invoices?.payment_status,
        qty: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        total: Number(it.total_price || 0),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [drillProduct, currentItems])

  // ─── Customer view ───
  const visibleCustomers = useMemo(() => {
    const arr = [...customersAgg]
    const f = custSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (custSort.key) {
        case 'name': return a.name.localeCompare(b.name) * f
        case 'paid': return (a.paid - b.paid) * f
        case 'outstanding': return (a.outstanding - b.outstanding) * f
        case 'invoices': return (a.invoices - b.invoices) * f
        default: return (a.revenue - b.revenue) * f
      }
    })
    return arr
  }, [customersAgg, custSort])

  // ─── Invoice view ───
  const visibleInvoices = useMemo(() => {
    const q = invSearch.trim().toLowerCase()
    let arr = invoices
    if (q) {
      arr = invoices.filter((inv: any) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        String(inv.payment_status || '').toLowerCase().includes(q)
      )
    }
    if (invSort === 'amount') arr = [...arr].sort((a: any, b: any) => Number(b.total_amount || 0) - Number(a.total_amount || 0))
    else if (invSort === 'status') arr = [...arr].sort((a: any, b: any) => String(a.payment_status || '').localeCompare(String(b.payment_status || '')))
    else arr = [...arr].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return arr
  }, [invoices, invSearch, invSort])

  // ─── Export bundle ───
  const bundle: ReportBundle = {
    shopName: shop?.shopName || 'Safwan Opticals',
    shopAddress: shop?.address,
    shopPhone: shop?.phone,
    shopVat: shop?.vat,
    shopLogoUrl: shop?.logoUrl,
    currency,
    rangeLabel: label,
    generatedAt: new Date().toLocaleString(),
    kpis,
    prevKpis,
    daily,
    paymentStatus,
    paymentMethods,
    weekday,
    discounts,
    products: allProducts,
    productSort: prodSort,
    categories,
    customers: customersAgg,
    invoices,
  }

  const handlePdf = async (kind: ReportKind) => {
    await exportReportPdf(kind, bundle)
    toast.success('Report downloaded')
  }

  const handlePrint = () => {
    printReport(bundle)
    toast.success('Preparing print view...')
  }

  const handleExcel = async () => {
    await exportReportExcel('full', bundle)
    toast.success('Excel report downloaded')
  }

  const setProdSortKey = (v: string | null) => { if (v) setProdSort((s) => ({ ...s, key: v as SortKey })) }
  const toggleProdDir = () => setProdSort((s) => ({ ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' }))
  const setCustSortKey = (v: string | null) => { if (v) setCustSort((s) => ({ ...s, key: v as CustSortKey })) }
  const toggleCustDir = () => setCustSort((s) => ({ ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {label}
            {isCustom ? ' (custom range)' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={(v) => v && setPreset(v as RangePreset)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range...</SelectItem>
              </SelectContent>
            </Select>

            {preset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
                <span className="text-muted-foreground">—</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-[140px] text-xs" />
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Download className="mr-2 h-4 w-4" /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handlePdf('full')}>
                <FileText className="mr-2 h-4 w-4" /> Full Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf('products')}>
                <Boxes className="mr-2 h-4 w-4" /> Products Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf('categories')}>
                <Layers className="mr-2 h-4 w-4" /> Categories Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf('customers')}>
                <Users className="mr-2 h-4 w-4" /> Customers Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePdf('invoices')}>
                <Receipt className="mr-2 h-4 w-4" /> Invoice Register (PDF)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (Full)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Print Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Sales"
          value={formatCurrency(kpis.totalRevenue, currency)}
          icon={DollarSign}
          tint="bg-blue-500/10"
          iconColor="#2563eb"
          accent="bg-blue-600"
          trendValue={trend(kpis.totalRevenue, prevKpis.totalRevenue)}
          showTrend={showTrend}
          sub={<span>vs prev</span>}
        />
        <KpiCard
          label="Collected"
          value={formatCurrency(kpis.collected, currency)}
          icon={CreditCard}
          tint="bg-green-500/10"
          iconColor="#16a34a"
          accent="bg-green-600"
          sub={<span>{kpis.collectionRate}% rate</span>}
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(kpis.outstanding, currency)}
          icon={Wallet}
          tint="bg-orange-500/10"
          iconColor="#ea580c"
          accent="bg-orange-500"
          sub={<span>{kpis.invoices} invoices</span>}
        />
        <KpiCard
          label="Invoices"
          value={String(kpis.invoices)}
          icon={FileText}
          tint="bg-purple-500/10"
          iconColor="#9333ea"
          accent="bg-purple-600"
          sub={<span>{Math.round(kpis.invoices / (daily.length || 1))}/day</span>}
        />
        <KpiCard
          label="Units Sold"
          value={String(kpis.units)}
          icon={Package}
          tint="bg-cyan-500/10"
          iconColor="#0891b2"
          accent="bg-cyan-600"
          sub={<span>{formatCurrency(kpis.avgOrder, currency)} avg order</span>}
        />
        <KpiCard
          label="Avg Order"
          value={formatCurrency(kpis.avgOrder, currency)}
          icon={BarChart3}
          tint="bg-indigo-500/10"
          iconColor="#4f46e5"
          accent="bg-indigo-600"
          trendValue={trend(kpis.avgOrder, prevKpis.avgOrder)}
          showTrend={showTrend}
          sub={<span>vs prev</span>}
        />
      </div>

      {/* ─── Period comparison strip ─── */}
      {showTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BadgePercent className="h-4 w-4 text-blue-600" />
              Period Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground">Current period vs the previous equivalent period</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Total Sales', cur: kpis.totalRevenue, prev: prevKpis.totalRevenue, money: true },
                { label: 'Collected', cur: kpis.collected, prev: prevKpis.collected, money: true },
                { label: 'Invoices', cur: kpis.invoices, prev: prevKpis.invoices, money: false },
                { label: 'Units Sold', cur: kpis.units, prev: prevKpis.units, money: false },
              ].map((c) => {
                const delta = trend(c.cur, c.prev)
                const fmt = (v: number) => (c.money ? formatCurrency(v, currency) : String(Math.round(v)))
                return (
                  <div key={c.label} className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    <p className="mt-1 truncate text-base font-bold">{fmt(c.cur)}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>prev: {fmt(c.prev)}</span>
                      <TrendBadge value={delta} />
                    </div>
                  </div>
                )
              })}
              {discounts.count > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">Discounts Given</p>
                  <p className="mt-1 truncate text-base font-bold text-amber-700 dark:text-amber-400">-{formatCurrency(discounts.total, currency)}</p>
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">{discounts.count} discounted invoices</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview">
        <TabsList className="h-9 w-full max-w-2xl">
          <TabsTrigger value="overview"><TrendingUp className="mr-1 h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="products"><Boxes className="mr-1 h-3.5 w-3.5" /> Products</TabsTrigger>
          <TabsTrigger value="categories"><Layers className="mr-1 h-3.5 w-3.5" /> Categories</TabsTrigger>
          <TabsTrigger value="customers"><Users className="mr-1 h-3.5 w-3.5" /> Customers</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="mr-1 h-3.5 w-3.5" /> Invoices</TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Revenue Trend</CardTitle>
                    <p className="text-xs text-muted-foreground">Daily sales vs collections</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_BLUE }} /> Sales</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_GREEN }} /> Collected</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={daily}>
                      <defs>
                        <linearGradient id="cSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} minTickGap={30} />
                      <YAxis fontSize={11} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                      <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0, currency), name === 'sales' ? 'Sales' : 'Collected']} contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="sales" name="sales" stroke={CHART_BLUE} strokeWidth={2} fill="url(#cSales)" />
                      <Area type="monotone" dataKey="collected" name="collected" stroke={CHART_GREEN} strokeWidth={2} fill="url(#cPaid)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <ChartEmpty text="No data for this period" />}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Status</CardTitle></CardHeader>
                <CardContent>
                  {paymentStatus.length > 0 ? (
                    <div className="space-y-3">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4} dataKey="value">
                            {paymentStatus.map((_, i) => <Cell key={`s-${i}`} fill={PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0, currency), '']} contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5">
                        {paymentStatus.map((item, i) => {
                          const total = paymentStatus.reduce((s, d) => s + d.value, 0)
                          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                {item.name}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">{pct}%</span>
                                <span className="font-medium">{formatCurrency(item.value, currency)}</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : <ChartEmpty text="No data" />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Methods</CardTitle></CardHeader>
                <CardContent>
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-2">
                      {paymentMethods.map((m) => {
                        const total = paymentMethods.reduce((s, d) => s + d.value, 0)
                        const pct = total > 0 ? Math.round((m.value / total) * 100) : 0
                        const color = PAYMENT_METHOD_COLORS[m.name] || PIE_COLORS[5]
                        return (
                          <div key={m.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 capitalize">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                {m.name}
                              </span>
                              <span className="font-medium">{formatCurrency(m.value, currency)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <ChartEmpty text="No data" />}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Second row: weekday + insights */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales by Weekday</CardTitle>
                    <p className="text-xs text-muted-foreground">Which days generate the most business</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {weekday.map((w) => {
                      const total = weekday.reduce((s, d) => s + d.revenue, 0)
                      const pct = total > 0 ? Math.round((w.revenue / total) * 100) : 0
                      return (
                        <div key={w.name} className="rounded-md bg-muted px-2 py-1 text-center">
                          <p className="text-[10px] text-muted-foreground">{w.name}</p>
                          <p className="text-xs font-bold">{pct}%</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : weekday.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weekday} margin={{ left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0, currency), 'Revenue']} contentStyle={tooltipStyle} />
                      <Bar dataKey="revenue" fill={CHART_BLUE} radius={[5, 5, 0, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <ChartEmpty text="No data for this period" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BadgePercent className="h-4 w-4 text-amber-500" /> Discount & Collection</CardTitle></CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Discounts</p>
                        <p className="mt-1 truncate text-lg font-bold text-amber-600">-{formatCurrency(discounts.total, currency)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Disc. Invoices</p>
                        <p className="mt-1 text-lg font-bold">{discounts.count}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collection Rate</p>
                        <p className="mt-1 text-lg font-bold text-green-600">{kpis.collectionRate}%</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unpaid</p>
                        <p className="mt-1 truncate text-lg font-bold text-red-600">{formatCurrency(kpis.outstanding, currency)}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {paymentMethods.length > 0 ? paymentMethods.map((m) => {
                        const total = paymentMethods.reduce((s, d) => s + d.value, 0)
                        const pct = total > 0 ? Math.round((m.value / total) * 100) : 0
                        const color = PAYMENT_METHOD_COLORS[m.name] || PIE_COLORS[5]
                        return (
                          <div key={m.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 capitalize">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                {m.name}
                              </span>
                              <span className="font-medium">{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        )
                      }) : <p className="text-xs text-muted-foreground">No payment data</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ PRODUCTS ═══ */}
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Product Sales Detail</CardTitle>
                  <Badge variant="outline">{visibleProducts.length} products</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search products..." className="h-8 w-48 pl-8 text-xs" />
                  </div>
                  <Select value={prodSort.key} onValueChange={setProdSortKey}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="count">Line Items</SelectItem>
                      <SelectItem value="price">Avg Price</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={toggleProdDir} title="Toggle direction">
                    {prodSort.dir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <ChartEmpty text="Loading..." />
              ) : visibleProducts.length === 0 ? (
                <ChartEmpty text="No products sold in this period" />
              ) : (
                <>
                  {topProducts.length > 0 && (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 4, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" fontSize={11} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                        <YAxis type="category" dataKey="name" width={160} fontSize={11} tickLine={false} />
                        <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0, currency), 'Revenue']} contentStyle={tooltipStyle} />
                        <Bar dataKey="revenue" fill={CHART_BLUE} radius={[0, 5, 5, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <Separator />
                  <div className="scroll-x -mx-1 px-1">
                    <div className="max-h-[420px] overflow-auto">
                      <Table className="min-w-[720px]">
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">% Share</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleProducts.map((p: ProductAgg, i: number) => (
                            <TableRow key={p.product_id || p.name}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-muted-foreground">{p.category}</TableCell>
                              <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(p.avgPrice, currency)}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.revenue, currency)}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {productsTotal > 0 ? ((p.revenue / productsTotal) * 100).toFixed(1) : '0'}%
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="View invoices for this product" onClick={() => setDrillProduct(p)}>
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CATEGORIES ═══ */}
        <TabsContent value="categories" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sales by Category</CardTitle></CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : categories.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="revenue">
                          {categories.map((_, i) => <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0, currency), '']} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1.5">
                      {categories.map((c, i) => {
                        const total = categories.reduce((s, d) => s + d.revenue, 0)
                        const pct = total > 0 ? Math.round((c.revenue / total) * 100) : 0
                        return (
                          <div key={c.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              {c.name}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground">{pct}%</span>
                              <span className="font-medium">{formatCurrency(c.revenue, currency)}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : <ChartEmpty text="No category data" />}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : categories.length > 0 ? (
                  <div className="scroll-x -mx-1 px-1">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Line Items</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">% Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((c) => {
                          const total = categories.reduce((s, d) => s + d.revenue, 0)
                          return (
                            <TableRow key={c.name}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.quantity}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.revenue, currency)}</TableCell>
                              <TableCell className="text-right tabular-nums">{total > 0 ? ((c.revenue / total) * 100).toFixed(1) : '0'}%</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : <ChartEmpty text="No category data" />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ CUSTOMERS ═══ */}
        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Customer Performance</CardTitle>
                  <Badge variant="outline">{visibleCustomers.length} customers</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={custSort.key} onValueChange={setCustSortKey}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="outstanding">Outstanding</SelectItem>
                      <SelectItem value="invoices">Invoices</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={toggleCustDir} title="Toggle direction">
                    {custSort.dir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <ChartEmpty text="Loading..." />
              ) : visibleCustomers.length === 0 ? (
                <ChartEmpty text="No customer data" />
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top 5 by {custSort.key === 'name' ? 'revenue' : custSort.key}</p>
                      {visibleCustomers.slice(0, 5).map((c, i) => {
                        const max = visibleCustomers[0]?.revenue || 1
                        const pct = Math.round((c.revenue / max) * 100)
                        return (
                          <div key={c.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                                <span className="truncate font-medium max-w-[220px]">{c.name}</span>
                              </span>
                              <span className="font-bold tabular-nums">{formatCurrency(c.revenue, currency)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Summary</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Repeat Customers</p>
                          <p className="mt-1 text-lg font-bold">{visibleCustomers.filter((c) => c.invoices > 1).length}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Walk-in Share</p>
                          <p className="mt-1 text-lg font-bold">
                            {customersAgg.length ? Math.round((customersAgg.find((c) => c.name === 'Walk-in')?.revenue || 0) / (customersAgg.reduce((s, c) => s + c.revenue, 0) || 1) * 100) : 0}%
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Outstanding</p>
                          <p className="mt-1 truncate text-lg font-bold text-red-600">{formatCurrency(visibleCustomers.reduce((s, c) => s + c.outstanding, 0), currency)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Paid</p>
                          <p className="mt-1 truncate text-lg font-bold text-green-600">{formatCurrency(visibleCustomers.reduce((s, c) => s + c.paid, 0), currency)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="scroll-x -mx-1 px-1">
                    <div className="max-h-[380px] overflow-auto">
                      <Table className="min-w-[680px]">
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Invoices</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleCustomers.map((c: CustomerAgg) => (
                            <TableRow key={c.name}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{c.invoices}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">{formatCurrency(c.paid, currency)}</TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(c.outstanding, currency)}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.revenue, currency)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ INVOICES ═══ */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Invoice Transactions</CardTitle>
                  <Badge variant="outline">{visibleInvoices.length} invoices</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={invSearch} onChange={(e) => setInvSearch(e.target.value)} placeholder="Search #, customer, status..." className="h-8 w-56 pl-8 text-xs" />
                  </div>
                  <Select value={invSort} onValueChange={(v) => v && setInvSort(v as InvSortKey)}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date (newest)</SelectItem>
                      <SelectItem value="amount">Amount (high)</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartEmpty text="Loading..." />
              ) : visibleInvoices.length === 0 ? (
                <ChartEmpty text="No invoices in this period" />
              ) : (
                <div className="scroll-x -mx-1 px-1">
                  <div className="max-h-[520px] overflow-auto">
                    <Table className="min-w-[760px]">
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleInvoices.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-xs font-medium">{inv.invoice_number}</TableCell>
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                              {new Date(inv.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">{inv.customer_name || 'Walk-in'}</TableCell>
                            <TableCell className="capitalize text-xs text-muted-foreground">{inv.invoice_type || 'pos'}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total_amount, currency)}</TableCell>
                            <TableCell className="text-right tabular-nums text-green-600">
                              {formatCurrency(inv.payment_status === 'paid' ? inv.total_amount : inv.amount_paid, currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_BADGE[inv.payment_status] || ''}>
                                {inv.payment_status || 'unpaid'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link href={`/invoices/${inv.id}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted">
                                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Footer stats ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FooterStat icon={Package} tint="bg-cyan-500/10" color="#0891b2" value={String(products.length)} label="Products" />
        <FooterStat icon={Users} tint="bg-purple-500/10" color="#9333ea" value={String(customers.length)} label="Customers" />
        <FooterStat icon={FileText} tint="bg-blue-500/10" color="#2563eb" value={String(kpis.invoices)} label="Invoices" />
        <FooterStat icon={CreditCard} tint="bg-green-500/10" color="#16a34a" value={`${kpis.collectionRate}%`} label="Collected" />
        <FooterStat icon={ShoppingCart} tint="bg-orange-500/10" color="#ea580c" value={formatCurrency(kpis.avgOrder, currency)} label="Avg Order" />
        <FooterStat icon={Wallet} tint="bg-red-500/10" color="#dc2626" value={formatCurrency(kpis.outstanding, currency)} label="Outstanding" />
      </div>

      {/* ─── Product invoice drill-down ─── */}
      <Dialog open={!!drillProduct} onOpenChange={(open) => !open && setDrillProduct(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              {drillProduct?.name}
            </DialogTitle>
            <DialogDescription>
              {drillProduct
                ? `${drillProduct.quantity} units sold · ${formatCurrency(drillProduct.revenue, currency)} revenue · ${drillItems.length} line items across ${new Set(drillItems.map((i) => i.invoiceNumber)).size} invoices`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {drillItems.length > 0 ? (
            <div className="scroll-x -mx-1 px-1">
              <div className="max-h-[55vh] overflow-auto">
                <Table className="min-w-[640px]">
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillItems.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Link href={`/invoices/${it.invoiceId}`} className="font-mono text-xs font-medium hover:underline">
                            {it.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(it.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{it.customer || 'Walk-in'}</TableCell>
                        <TableCell className="text-right tabular-nums">{it.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(it.unitPrice, currency)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(it.total, currency)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_BADGE[it.status] || ''}>
                            {it.status || 'unpaid'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No sales found for this product in the selected period.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FooterStat({
  icon: Icon, tint, color, value, label,
}: {
  icon: React.ElementType
  tint: string
  color: string
  value: string
  label: string
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-center gap-1">
        <span className={`grid h-7 w-7 place-items-center rounded-md ${tint}`}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <span className="truncate text-sm font-bold">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}
