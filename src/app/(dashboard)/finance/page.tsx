'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  TrendingUp, PiggyBank, Receipt, Wallet,
  Plus, Trash2, Download, Search, ArrowUpRight, ArrowDownRight, Minus, Pencil,
  Landmark, ShoppingBag, Zap, Wrench, Home as HomeIcon,
  MoreHorizontal, Printer, FileSpreadsheet, FileText, Calendar, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Bar, Line, Legend,
} from 'recharts'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useInvoices, useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useShopSettings } from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'
import { createClient } from '@/lib/supabase/client'
import {
  resolveFinanceRange, buildIncomeTx, buildExpenseTx, computeFinanceKpis,
  buildCashFlow, buildMonthlySeries, buildExpenseByCategory, buildIncomeByMethod,
  buildExpenseByMethod, sortTransactions, trend, todayIso, daysAgoIso,
  type FinancePreset, type FinTx,
} from './finance-utils'
import {
  exportFinancePdf, printFinance, exportFinanceExcel, type FinanceBundle,
} from './finance-pdf'

const CATEGORY_META: Record<string, { label: string; ar: string; icon: React.ElementType; color: string }> = {
  rent: { label: 'Rent', ar: 'إيجار', icon: HomeIcon, color: '#3b82f6' },
  bills: { label: 'Bills', ar: 'فواتير', icon: Zap, color: '#f59e0b' },
  supplies: { label: 'Supplies', ar: 'مستلزمات', icon: ShoppingBag, color: '#8b5cf6' },
  equipment: { label: 'Equipment', ar: 'معدات', icon: Wrench, color: '#06b6d4' },
  salaries: { label: 'Salaries', ar: 'رواتب', icon: Wallet, color: '#ec4899' },
  party: { label: 'Party Payment', ar: 'دفعة شريك', icon: Landmark, color: '#f97316' },
  marketing: { label: 'Marketing', ar: 'تسويق', icon: TrendingUp, color: '#10b981' },
  other: { label: 'Other', ar: 'أخرى', icon: MoreHorizontal, color: '#64748b' },
}

const PAYMENT_COLORS: Record<string, string> = {
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

const emptyForm = {
  title: '',
  category: 'other',
  amount: '',
  payment_method: 'cash' as string,
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
}

function TrendBadge({ value }: { value: number }) {
  if (value > 0) {
    return <span className="inline-flex items-center gap-0.5 font-medium text-green-600"><ArrowUpRight className="h-3 w-3" />{value}%</span>
  }
  if (value < 0) {
    return <span className="inline-flex items-center gap-0.5 font-medium text-red-600"><ArrowDownRight className="h-3 w-3" />{value}%</span>
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

export default function FinancePage() {
  const { t } = useLang()
  const [preset, setPreset] = useState<FinancePreset>('30days')
  const [customFrom, setCustomFrom] = useState(() => daysAgoIso(30))
  const [customTo, setCustomTo] = useState(() => todayIso())
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(emptyForm)

  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  const { data: shop } = useShopSettings()
  const { data: invoicesData } = useInvoices(1, 500)
  const { data: expenses = [] } = useExpenses()
  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()
  const deleteMutation = useDeleteExpense()

  const currency = shop?.currency || 'SAR'
  const allInvoices = (invoicesData?.data || []).filter((inv: any) => inv.invoice_type !== 'receipt')

  // ─── Date filtering ───
  const range = useMemo(() => resolveFinanceRange(preset, customFrom, customTo), [preset, customFrom, customTo])
  const { start, end, prevStart, prevEnd, label, isCustom } = range

  const inRange = (dateStr: string, fromIso: string, toIso: string) => {
    const ts = new Date(dateStr).getTime()
    if (isNaN(ts)) return false
    return ts >= new Date(fromIso + 'T00:00:00').getTime() && ts <= new Date(toIso + 'T23:59:59').getTime()
  }

  const currentInvoices = useMemo(() => allInvoices.filter((inv: any) => inRange(inv.created_at, start, end)), [allInvoices, start, end])
  const prevInvoices = useMemo(() => allInvoices.filter((inv: any) => inRange(inv.created_at, prevStart, prevEnd)), [allInvoices, prevStart, prevEnd])
  const currentExpenses = useMemo(() => expenses.filter((e: any) => inRange(e.expense_date, start, end)), [expenses, start, end])
  const prevExpenses = useMemo(() => expenses.filter((e: any) => inRange(e.expense_date, prevStart, prevEnd)), [expenses, prevStart, prevEnd])

  // ─── Transactions ───
  const incomeTx = useMemo(() => buildIncomeTx(currentInvoices), [currentInvoices])
  const expenseTx = useMemo(() => buildExpenseTx(currentExpenses), [currentExpenses])
  const prevIncomeTx = useMemo(() => buildIncomeTx(prevInvoices), [prevInvoices])
  const prevExpenseTx = useMemo(() => buildExpenseTx(prevExpenses), [prevExpenses])

  // ─── KPIs ───
  const kpis = useMemo(() => computeFinanceKpis(incomeTx, expenseTx), [incomeTx, expenseTx])
  const prevKpis = useMemo(() => computeFinanceKpis(prevIncomeTx, prevExpenseTx), [prevIncomeTx, prevExpenseTx])

  // ─── Charts ───
  const cashFlow = useMemo(() => buildCashFlow(incomeTx, expenseTx), [incomeTx, expenseTx])
  const monthly = useMemo(() => buildMonthlySeries(incomeTx, expenseTx), [incomeTx, expenseTx])
  const expenseByCategory = useMemo(() => buildExpenseByCategory(expenseTx), [expenseTx])
  const incomeByMethod = useMemo(() => buildIncomeByMethod(incomeTx), [incomeTx])
  const expenseByMethod = useMemo(() => buildExpenseByMethod(expenseTx), [expenseTx])

  const expenseChartData = useMemo(
    () => expenseByCategory.map((c) => ({ ...c, color: CATEGORY_META[c.name]?.color || '#64748b' })),
    [expenseByCategory]
  )

  const showTrend = preset !== 'all'

  // ─── Ledger ───
  const transactions = useMemo(() => sortTransactions([...incomeTx, ...expenseTx], search), [incomeTx, expenseTx, search])

  const catMeta = (key: string) => CATEGORY_META[key] || CATEGORY_META.other

  // ─── Expense actions ───
  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setShowDialog(true)
  }

  const openEdit = (tx: FinTx) => {
    if (tx.type !== 'expense') return
    const e = tx.data
    setEditId(e.id)
    setForm({
      title: e.title || '',
      category: e.category || 'other',
      amount: String(Number(e.amount || 0)),
      payment_method: e.payment_method || 'cash',
      expense_date: (e.expense_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes: e.notes || '',
    })
    setShowDialog(true)
  }

  const submitExpense = () => {
    if (!form.title.trim()) { toast.error('Please enter a title'); return }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return }
    if (!userId) { toast.error('Not signed in'); return }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount,
      payment_method: form.payment_method,
      expense_date: form.expense_date ? new Date(form.expense_date).toISOString() : new Date().toISOString(),
      notes: form.notes.trim() || null,
    }
    if (editId) {
      updateMutation.mutate({ id: editId, updates: payload }, {
        onSuccess: () => {
          setShowDialog(false)
          setForm(emptyForm)
          setEditId(null)
        },
      })
    } else {
      createMutation.mutate({ ...payload, created_by: userId }, {
        onSuccess: () => {
          setShowDialog(false)
          setForm(emptyForm)
        },
      })
    }
  }

  // ─── Export ───
  const bundle: FinanceBundle = {
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
    daily: cashFlow,
    monthly,
    expenseByCategory,
    incomeByMethod,
    expenseByMethod,
    transactions,
  }

  const handlePdf = async () => {
    await exportFinancePdf(bundle)
    toast.success('Finance report downloaded')
  }

  const handlePrint = () => {
    printFinance(bundle)
    toast.success('Preparing print view...')
  }

  const handleExcel = async () => {
    await exportFinanceExcel(bundle)
    toast.success('Excel report downloaded')
  }

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('finance.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {label}
            {isCustom ? ' (custom range)' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={(v) => v && setPreset(v as FinancePreset)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
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
              <DropdownMenuItem onClick={handlePdf}>
                <FileText className="mr-2 h-4 w-4" /> Full Report (PDF)
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

          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> {t('finance.addExpense')}
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total Income"
          value={formatCurrency(kpis.totalIncome, currency)}
          icon={ArrowDownRight}
          tint="bg-blue-500/10"
          iconColor="#2563eb"
          accent="bg-blue-600"
          trendValue={trend(kpis.totalIncome, prevKpis.totalIncome)}
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
          sub={<span>{kpis.invoiceCount} invoices</span>}
        />
        <KpiCard
          label="Total Expenses"
          value={formatCurrency(kpis.expenseTotal, currency)}
          icon={ArrowUpRight}
          tint="bg-red-500/10"
          iconColor="#ef4444"
          accent="bg-red-600"
          trendValue={trend(kpis.expenseTotal, prevKpis.expenseTotal)}
          showTrend={showTrend}
          sub={<span>{kpis.expenseCount} entries</span>}
        />
        <KpiCard
          label="Net Profit"
          value={formatCurrency(kpis.net, currency)}
          icon={PiggyBank}
          tint={kpis.net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          iconColor={kpis.net >= 0 ? '#059669' : '#ef4444'}
          accent={kpis.net >= 0 ? 'bg-emerald-600' : 'bg-red-600'}
          trendValue={trend(kpis.net, prevKpis.net)}
          showTrend={showTrend}
          sub={<span>vs prev</span>}
        />
        <KpiCard
          label="Margin"
          value={`${kpis.margin}%`}
          icon={TrendingUp}
          tint="bg-cyan-500/10"
          iconColor="#0891b2"
          accent="bg-cyan-600"
          sub={<span>{formatCurrency(kpis.avgOrder, currency)} avg order</span>}
        />
      </div>

      {/* ─── Period comparison strip ─── */}
      {showTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Period Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground">Current period vs the previous equivalent period</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Income', cur: kpis.totalIncome, prev: prevKpis.totalIncome, money: true },
                { label: 'Collected', cur: kpis.collected, prev: prevKpis.collected, money: true },
                { label: 'Expenses', cur: kpis.expenseTotal, prev: prevKpis.expenseTotal, money: true },
                { label: 'Net Profit', cur: kpis.net, prev: prevKpis.net, money: true },
                { label: 'Invoices', cur: kpis.invoiceCount, prev: prevKpis.invoiceCount, money: false },
                { label: 'Expense Entries', cur: kpis.expenseCount, prev: prevKpis.expenseCount, money: false },
                { label: 'Avg Order', cur: kpis.avgOrder, prev: prevKpis.avgOrder, money: true },
                { label: 'Collection Rate', cur: kpis.collectionRate, prev: prevKpis.collectionRate, money: false, pctValue: true },
              ].map((item: any) => (
                <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold truncate">
                      {item.money ? formatCurrency(item.cur || 0, currency) : item.pctValue ? `${item.cur || 0}%` : item.cur || 0}
                    </p>
                  </div>
                  <TrendBadge value={trend(Number(item.cur) || 0, Number(item.prev) || 0)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Charts row 1 ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">{t('finance.cashFlow')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('finance.cashFlowDesc')}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-muted-foreground">{t('finance.income')}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-muted-foreground">{t('finance.expenses')}</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashFlow.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={cashFlow}>
                  <defs>
                    <linearGradient id="fInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} tickFormatter={(v) => formatCurrency(Number(v) || 0, currency)} width={80} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0, currency), '']} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} fill="url(#fInc)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fill="url(#fExp)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty text={t('finance.noData')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('finance.expenseBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            {expenseChartData.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={expenseChartData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                      {expenseChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0, currency), '']} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-[180px] overflow-auto">
                  {expenseChartData.map((item) => {
                    const total = expenseChartData.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                    return (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="capitalize">{catMeta(item.name).label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{pct}%</span>
                          <span className="font-medium">{formatCurrency(item.value, currency)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">{t('finance.noData')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts row 2 ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Income vs expenses per month with net result</p>
          </CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} tickFormatter={(v) => formatCurrency(Number(v) || 0, currency)} width={80} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0, currency), '']} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={18} />
                  <Line dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty text={t('finance.noData')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Income by Method</CardTitle></CardHeader>
          <CardContent>
            {incomeByMethod.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={incomeByMethod} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                      {incomeByMethod.map((m, i) => <Cell key={i} fill={PAYMENT_COLORS[m.name] || '#64748b'} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0, currency), '']} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {incomeByMethod.map((m) => {
                    const total = incomeByMethod.reduce((s, d) => s + d.value, 0)
                    const p = total > 0 ? Math.round((m.value / total) * 100) : 0
                    return (
                      <div key={m.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[m.name] || '#64748b' }} />
                          <span className="capitalize">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{p}%</span>
                          <span className="font-medium">{formatCurrency(m.value, currency)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {expenseByMethod.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Expense Methods</p>
                      {expenseByMethod.map((m) => (
                        <div key={m.name} className="flex items-center justify-between text-sm py-0.5">
                          <span className="text-muted-foreground capitalize">{m.name}</span>
                          <span className="font-medium">{formatCurrency(m.value, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">{t('finance.noData')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Transaction History ─── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-purple-600" />
              {t('finance.transactionHistory')}
              <Badge variant="outline" className="ml-1">{transactions.length}</Badge>
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('finance.searchPlaceholder')}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <>
              <div className="hidden md:block scroll-x -mx-1 px-1">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('finance.date')}</TableHead>
                      <TableHead>{t('finance.type')}</TableHead>
                      <TableHead>{t('finance.reference')}</TableHead>
                      <TableHead>{t('finance.description')}</TableHead>
                      <TableHead>{t('finance.category')}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">{t('finance.amount')}</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 100).map((tx: any) => {
                      const meta = catMeta(tx.category)
                      const Icon = meta.icon
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {tx.type === 'income' ? 'Income' : 'Expense'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{tx.ref || '-'}</TableCell>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate">{tx.title || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded p-1" style={{ backgroundColor: meta.color + '1a' }}>
                                <Icon className="h-3 w-3" style={{ color: meta.color }} />
                              </span>
                              <span className="text-xs capitalize text-muted-foreground">{meta.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {tx.type === 'income' ? (
                              <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[tx.status] || ''}`}>
                                {tx.status}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">{tx.method}</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                          </TableCell>
                          <TableCell>
                            {tx.type === 'expense' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(tx)} className="cursor-pointer">
                                    <Pencil className="h-4 w-4 mr-2" /> {t('common.edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDeleteTarget(tx.data)} className="text-red-600 cursor-pointer">
                                    <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {transactions.slice(0, 100).map((tx: any) => {
                  const meta = catMeta(tx.category)
                  const Icon = meta.icon
                  return (
                    <div key={tx.id} className={`rounded-xl border p-3.5 ${tx.type === 'income' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {tx.type === 'income' ? 'Income' : 'Expense'}
                            </Badge>
                            {tx.ref && <span className="font-mono text-[11px] text-muted-foreground">{tx.ref}</span>}
                          </div>
                          <p className="font-medium text-sm truncate mt-1.5">{tx.title || '-'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(tx.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded p-1" style={{ backgroundColor: meta.color + '1a' }}>
                            <Icon className="h-3 w-3" style={{ color: meta.color }} />
                          </span>
                          <span className="text-xs capitalize text-muted-foreground">{meta.label}</span>
                        </div>
                        {tx.type === 'expense' && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tx)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(tx.data)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>{t('finance.noTransactions')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? t('common.edit') + ' ' + t('finance.expenseTitle') : t('finance.addExpense')}</DialogTitle>
            <DialogDescription>{t('finance.addExpenseDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('finance.expenseTitle')}</Label>
              <Input
                placeholder="e.g. Electricity bill"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('finance.category')}</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([key, m]) => (
                      <SelectItem key={key} value={key}>{m.label} ({m.ar})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('finance.amount')} (SAR)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('finance.paymentMethod')}</Label>
                <Select value={form.payment_method} onValueChange={(v) => v && setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['cash', 'card', 'transfer'].map((m) => (
                      <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('finance.date')}</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('finance.notes')}</Label>
              <Textarea
                placeholder={t('finance.notesPlaceholder')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={submitExpense} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('common.loading') : (editId ? t('common.save') : t('finance.saveExpense'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('finance.deleteExpense')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('finance.deleteExpenseDesc')} "{deleteTarget?.title}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              setDeleteTarget(null)
            }}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
