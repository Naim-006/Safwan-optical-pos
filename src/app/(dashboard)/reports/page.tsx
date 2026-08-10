'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, FileText,
  CreditCard, Download, Users, Package, ArrowUp, ArrowDown, Minus,
  Wallet, Printer, FileSpreadsheet, Search, Calendar, Boxes, Layers,
  BarChart3, Eye, BadgePercent, GitCompareArrows, Activity,
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
  buildCompare, compareSeries,
  type SortKey, type SortDir, type ProductAgg, type CustomerAgg,
  type ComparePoint, type SeriesCompare,
} from './report-utils'
import {
  exportReportPdf, printReport, exportReportExcel,
  type ReportBundle, type ReportKind,
} from './report-pdf'

type RangePreset = 'today' | '30days' | 'all' | 'custom'
type CustSortKey = 'revenue' | 'paid' | 'outstanding' | 'invoices' | 'name'

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

function DeltaPill({ pct, positiveIsGood = true }: { pct: number; positiveIsGood?: boolean }) {
  if (pct === 0) {
    return <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Minus className="h-3 w-3" />0%</span>
  }
  const up = pct > 0
  const good = up === positiveIsGood
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${good ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  )
}

function MetricTrack({ m, currency, icon: Icon }: { m: ComparePoint; currency: string; icon: React.ElementType }) {
  const fmt = (v: number) => m.kind === 'currency'
    ? formatCurrency(v, currency)
    : m.kind === 'percent' ? `${Math.round(v)}%` : String(Math.round(v))
  const max = Math.max(Math.abs(m.current), Math.abs(m.previous), 1)
  return (
    <Card size="sm" className="relative h-full overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${m.positiveIsGood ? 'bg-green-600' : 'bg-red-500'}`} />
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{m.label}</span>
          </p>
          <DeltaPill pct={m.pct} positiveIsGood={m.positiveIsGood} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-lg font-bold leading-tight">{fmt(m.current)}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">vs {fmt(m.previous)}</span>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${(Math.abs(m.current) / max) * 100}%` }} />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-slate-400/70 dark:bg-slate-600" style={{ width: `${(Math.abs(m.previous) / max) * 100}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompareRow({ item, currency, idx }: { item: SeriesCompare; currency: string; idx: number }) {
  const up = item.delta > 0
  const max = Math.max(Math.abs(item.current), Math.abs(item.previous), 1)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="text-muted-foreground">#{idx}</span>
          <span className="truncate">{item.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`font-semibold tabular-nums ${up ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.current, currency)}</span>
          <span className="w-16 text-right text-muted-foreground tabular-nums">{formatCurrency(item.previous, currency)}</span>
          <DeltaPill pct={item.pct} positiveIsGood={item.name === 'Unpaid' ? false : true} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${up ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${(Math.abs(item.current) / max) * 100}%` }} />
        </div>
        <span className={`w-12 shrink-0 text-right text-[10px] font-bold tabular-nums ${up ? 'text-green-600' : 'text-red-600'}`}>
          {up ? '+' : ''}{Math.round(Math.abs(item.pct))}%
        </span>
      </div>
    </div>
  )
}

function CompareListCard({ title, items, currency, limit = 6 }: {
  title: string
  items: SeriesCompare[]
  currency: string
  limit?: number
}) {
  const shown = items.slice(0, limit)
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="outline">{items.length} tracked</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {shown.length > 0 ? (
          <div className="space-y-4">
            {shown.map((item, i) => <CompareRow key={item.name} item={item} currency={currency} idx={i + 1} />)}
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">No data to compare</p>
        )}
      </CardContent>
    </Card>
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

  // ─── Previous-period aggregations (for Comparison tab) ───
  const prevDaily = useMemo(() => buildDaily(prevInvoicesFiltered, prevItems), [prevInvoicesFiltered, prevItems])
  const prevProducts = useMemo(() => aggregateProducts(prevItems, productById), [prevItems, productById])
  const prevCategories = useMemo(() => aggregateCategories(prevProducts), [prevProducts])
  const prevPaymentMethods = useMemo(() => buildPaymentMethods(prevInvoicesFiltered), [prevInvoicesFiltered])
  const prevPaymentStatus = useMemo(() => buildPaymentStatus(prevInvoicesFiltered), [prevInvoicesFiltered])
  const prevDiscounts = useMemo(() => buildDiscounts(prevInvoicesFiltered), [prevInvoicesFiltered])

  const metricList = useMemo(() => [
    buildCompare('sales', 'Total Sales', kpis.totalRevenue, prevKpis.totalRevenue, 'currency'),
    buildCompare('collected', 'Collected', kpis.collected, prevKpis.collected, 'currency'),
    buildCompare('outstanding', 'Outstanding', kpis.outstanding, prevKpis.outstanding, 'currency', false),
    buildCompare('invoices', 'Invoices', kpis.invoices, prevKpis.invoices, 'number'),
    buildCompare('units', 'Units Sold', kpis.units, prevKpis.units, 'number'),
    buildCompare('avg', 'Avg Order', kpis.avgOrder, prevKpis.avgOrder, 'currency'),
    buildCompare('rate', 'Collection Rate', kpis.collectionRate, prevKpis.collectionRate, 'percent'),
    buildCompare('discounts', 'Discounts Given', discounts.total, prevDiscounts.total, 'currency', false),
  ], [kpis, prevKpis, discounts, prevDiscounts])

  const compareDaily = useMemo(
    () => daily.map((d, i) => ({ date: d.date, current: d.sales, previous: prevDaily[i]?.sales || 0 })),
    [daily, prevDaily]
  )
  const categoryComp = useMemo(
    () => compareSeries(categories.map((c) => ({ name: c.name, value: c.revenue })), prevCategories.map((c) => ({ name: c.name, value: c.revenue }))),
    [categories, prevCategories]
  )
  const methodComp = useMemo(() => compareSeries(paymentMethods, prevPaymentMethods), [paymentMethods, prevPaymentMethods])
  const statusComp = useMemo(() => compareSeries(paymentStatus, prevPaymentStatus), [paymentStatus, prevPaymentStatus])
  const productComp = useMemo(
    () => compareSeries(allProducts.map((p) => ({ name: p.name, value: p.revenue })), prevProducts.map((p) => ({ name: p.name, value: p.revenue }))),
    [allProducts, prevProducts]
  )

  const METRIC_ICONS: Record<string, React.ElementType> = {
    sales: DollarSign, collected: CreditCard, outstanding: Wallet, invoices: FileText,
    units: Package, avg: BarChart3, rate: Activity, discounts: BadgePercent,
  }

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Sales"
          value={formatCurrency(kpis.totalRevenue, currency)}
          icon={DollarSign}
          tint="bg-blue-500/10"
          iconColor="#2563eb"
          accent="bg-blue-600"
          
          
        />
        <KpiCard
          label="Collected"
          value={formatCurrency(kpis.collected, currency)}
          icon={CreditCard}
          tint="bg-green-500/10"
          iconColor="#16a34a"
          accent="bg-green-600"
         
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(kpis.outstanding, currency)}
          icon={Wallet}
          tint="bg-orange-500/10"
          iconColor="#ea580c"
          accent="bg-orange-500"
          
        />
        <KpiCard
          label="Invoices"
          value={String(kpis.invoices)}
          icon={FileText}
          tint="bg-purple-500/10"
          iconColor="#9333ea"
          accent="bg-purple-600"
        
        />
        <KpiCard
          label="Units Sold"
          value={String(kpis.units)}
          icon={Package}
          tint="bg-cyan-500/10"
          iconColor="#0891b2"
          accent="bg-cyan-600"
        
        />
        <KpiCard
          label="Avg Order"
          value={formatCurrency(kpis.avgOrder, currency)}
          icon={BarChart3}
          tint="bg-indigo-500/10"
          iconColor="#4f46e5"
          accent="bg-indigo-600"
         
          
        />
        <KpiCard
          label="Products"
          value={String(products.length)}
          icon={Boxes}
          tint="bg-slate-500/10"
          iconColor="#64748b"
          accent="bg-slate-600"
          
        />
        <KpiCard
          label="Customers"
          value={String(customers.length)}
          icon={Users}
          tint="bg-emerald-500/10"
          iconColor="#059669"
          accent="bg-emerald-600"
          
        />
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview">
        <TabsList className="h-9 w-full max-w-2xl">
          <TabsTrigger value="overview"><TrendingUp className="mr-1 h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="products"><Boxes className="mr-1 h-3.5 w-3.5" /> Products</TabsTrigger>
          <TabsTrigger value="categories"><Layers className="mr-1 h-3.5 w-3.5" /> Categories</TabsTrigger>
          <TabsTrigger value="customers"><Users className="mr-1 h-3.5 w-3.5" /> Customers</TabsTrigger>
          <TabsTrigger value="comparison"><GitCompareArrows className="mr-1 h-3.5 w-3.5" /> Comparison</TabsTrigger>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BadgePercent className="h-4 w-4 text-amber-500" /> Discounts & Payments</CardTitle></CardHeader>
              <CardContent>
                {loading ? <ChartEmpty text="Loading..." /> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Discounts Given</p>
                        <p className="mt-1 truncate text-lg font-bold text-amber-600">-{formatCurrency(discounts.total, currency)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Discounted Invoices</p>
                        <p className="mt-1 text-lg font-bold">{discounts.count}</p>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Payment Methods</p>
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
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">{pct}%</span>
                                <span className="font-medium">{formatCurrency(m.value, currency)}</span>
                              </span>
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

        {/* ═══ COMPARISON (Period Tracker) ═══ */}
        <TabsContent value="comparison" className="mt-4 space-y-4">
          {preset === 'all' ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <GitCompareArrows className="h-10 w-10 text-muted-foreground opacity-30" />
                <div>
                  <p className="text-sm font-medium">No previous period to compare</p>
                  <p className="text-xs text-muted-foreground">Switch to Today, Last 30 Days, or a Custom Range to see the full tracker.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Period strip */}
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-500/10">
                      <GitCompareArrows className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Period Tracker</p>
                      <p className="text-xs text-muted-foreground">Everything at a glance — products, cash, payments & progress vs previous period</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current Period</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{start} — {end}</p>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Previous Period</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{prevStart} — {prevEnd}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metric tracker */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {metricList.map((m) => <MetricTrack key={m.key} m={m} currency={currency} icon={METRIC_ICONS[m.key]} />)}
              </div>

              {/* Dual-period revenue chart */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Daily Revenue — Current vs Previous</CardTitle>
                      <p className="text-xs text-muted-foreground">Aligned by day of period</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_BLUE }} /> Current</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Previous</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? <ChartEmpty text="Loading..." /> : compareDaily.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={compareDaily}>
                        <defs>
                          <linearGradient id="cCur" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="cPrev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={11} tickLine={false} minTickGap={30} />
                        <YAxis fontSize={11} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                        <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0, currency), name === 'current' ? 'Current' : 'Previous']} contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="previous" name="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" fill="url(#cPrev)" />
                        <Area type="monotone" dataKey="current" name="current" stroke={CHART_BLUE} strokeWidth={2} fill="url(#cCur)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <ChartEmpty text="No data to compare" />}
                </CardContent>
              </Card>

              {/* Categories + Payment methods */}
              <div className="grid gap-4 lg:grid-cols-2">
                <CompareListCard title="Category Revenue" items={categoryComp} currency={currency} />
                <CompareListCard title="Payment Methods" items={methodComp} currency={currency} />
              </div>

              {/* Payment status + Product movers */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Status</CardTitle></CardHeader>
                  <CardContent>
                    {statusComp.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {statusComp.map((s, i) => {
                          const color = ['#22c55e', '#f59e0b', '#ef4444'][i] || PIE_COLORS[3]
                          return (
                            <div key={s.name} className="rounded-lg border p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.name}</p>
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                              </div>
                              <p className="mt-1 truncate text-lg font-bold">{formatCurrency(s.current, currency)}</p>
                              <div className="mt-1 flex items-center justify-between gap-1">
                                <span className="truncate text-[10px] text-muted-foreground">prev {formatCurrency(s.previous, currency)}</span>
                                <DeltaPill pct={s.pct} positiveIsGood={s.name !== 'Unpaid'} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : <p className="py-8 text-center text-xs text-muted-foreground">No payment data</p>}
                  </CardContent>
                </Card>
                <CompareListCard title="Top Product Movers" items={productComp} currency={currency} limit={7} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Product invoice drill-down ─── */}      <Dialog open={!!drillProduct} onOpenChange={(open) => !open && setDrillProduct(null)}>
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
