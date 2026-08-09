'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  TrendingUp, PiggyBank, Receipt,
  Plus, Trash2, Download, Search, ArrowUpRight, ArrowDownRight,
  Landmark, ShoppingBag, Zap, Wrench, Home as HomeIcon,
  MoreHorizontal, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useInvoices, useExpenses, useCreateExpense, useDeleteExpense } from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'
import { createClient } from '@/lib/supabase/client'

type DateRange = 'today' | '7days' | '30days' | '90days' | 'all'

const CATEGORY_META: Record<string, { label: string; ar: string; icon: any; color: string }> = {
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
  cash: '#16a34a',
  card: '#2563eb',
  transfer: '#8b5cf6',
}

export default function FinancePage() {
  const { t } = useLang()
  const [range, setRange] = useState<DateRange>('30days')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({
    title: '',
    category: 'other',
    amount: '',
    payment_method: 'cash' as string,
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  const { data: invoicesData } = useInvoices(1, 500)
  const { data: expenses = [] } = useExpenses()
  const createMutation = useCreateExpense()
  const deleteMutation = useDeleteExpense()

  const allInvoices = (invoicesData?.data || []).filter((inv: any) => inv.invoice_type !== 'receipt')

  // ─── Date filtering ───
  const getRangeStart = (r: DateRange) => {
    if (r === 'all') return new Date(2020, 0, 1)
    const d = new Date()
    const days = r === 'today' ? 0 : r === '7days' ? 7 : r === '30days' ? 30 : 90
    if (r === 'today') d.setHours(0, 0, 0, 0)
    else d.setDate(d.getDate() - days)
    return d
  }

  const rangeStart = useMemo(() => getRangeStart(range), [range])

  const filteredInvoices = useMemo(() => allInvoices.filter((inv: any) =>
    new Date(inv.created_at) >= rangeStart
  ), [allInvoices, rangeStart])

  const filteredExpenses = useMemo(() => expenses.filter((e: any) =>
    new Date(e.expense_date) >= rangeStart
  ), [expenses, rangeStart])

  // ─── Totals ───
  const income = filteredInvoices.reduce((s: number, i: any) => s + Number(i.amount_paid || i.total_amount || 0), 0)
  const totalIncome = filteredInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
  const expenseTotal = filteredExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const net = totalIncome - expenseTotal
  const netPct = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0

  // ─── Cash flow chart (income vs expenses per day) ───
  const chartData = useMemo(() => {
    const map: Record<string, any> = {}
    filteredInvoices.forEach((inv: any) => {
      const d = inv.created_at?.slice(0, 10)
      if (!d) return
      if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
      map[d].income += Number(inv.amount_paid || inv.total_amount || 0)
    })
    filteredExpenses.forEach((e: any) => {
      const d = e.expense_date?.slice(0, 10)
      if (!d) return
      if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
      map[d].expense += Number(e.amount || 0)
    })
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }, [filteredInvoices, filteredExpenses])

  // ─── Expense breakdown by category ───
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach((e: any) => {
      const c = e.category || 'other'
      map[c] = (map[c] || 0) + Number(e.amount || 0)
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: CATEGORY_META[key]?.label || key,
        value,
        color: CATEGORY_META[key]?.color || '#64748b',
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  // ─── Payment method breakdown ───
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredInvoices.forEach((inv: any) => {
      const m = inv.payment_method || 'cash'
      map[m] = (map[m] || 0) + Number(inv.amount_paid || inv.total_amount || 0)
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: key, value }))
  }, [filteredInvoices])

  // ─── Combined transaction ledger ───
  const transactions = useMemo(() => {
    const incomeTx = filteredInvoices.map((inv: any) => ({
      id: 'inv-' + inv.id,
      type: 'income' as const,
      date: inv.created_at,
      ref: inv.invoice_number,
      title: inv.customer_name || 'Walk-in',
      category: inv.invoice_type,
      amount: Number(inv.amount_paid || inv.total_amount || 0),
      method: inv.payment_method,
      status: inv.payment_status,
      data: inv,
    }))
    const expenseTx = filteredExpenses.map((e: any) => ({
      id: 'exp-' + e.id,
      type: 'expense' as const,
      date: e.expense_date,
      ref: 'EXP',
      title: e.title,
      category: e.category,
      amount: Number(e.amount || 0),
      method: e.payment_method,
      status: 'paid',
      data: e,
    }))
    return [...incomeTx, ...expenseTx]
      .filter((tx) => {
        if (!search) return true
        const q = search.toLowerCase()
        return tx.title?.toLowerCase().includes(q) ||
          tx.ref?.toLowerCase().includes(q) ||
          String(tx.category || '').toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredInvoices, filteredExpenses, search])

  // ─── Actions ───
  const submitExpense = () => {
    if (!form.title.trim()) { toast.error('Please enter a title'); return }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return }
    if (!userId) { toast.error('Not signed in'); return }
    createMutation.mutate({
      title: form.title.trim(),
      category: form.category,
      amount,
      payment_method: form.payment_method,
      expense_date: form.expense_date ? new Date(form.expense_date).toISOString() : new Date().toISOString(),
      notes: form.notes.trim() || null,
      created_by: userId,
    }, {
      onSuccess: () => {
        setShowAdd(false)
        setForm({ title: '', category: 'other', amount: '', payment_method: 'cash', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
      },
    })
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, doc.internal.pageSize.width, 32, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.text('Finance Report', 14, 20)
    doc.setFontSize(11)
    doc.text('Safwan Opticals — Cash Flow & Transactions', 14, 28)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)
    doc.text(`Total Income: ${formatCurrency(totalIncome)}`, 14, 44)
    doc.text(`Total Expenses: ${formatCurrency(expenseTotal)}`, 14, 52)
    doc.text(`Net Profit: ${formatCurrency(net)}`, 14, 60)

    autoTable(doc, {
      startY: 70,
      head: [['Date', 'Type', 'Reference', 'Description', 'Amount']],
      body: transactions.slice(0, 50).map((tx: any) => [
        new Date(tx.date).toLocaleDateString(),
        tx.type === 'income' ? 'Income' : 'Expense',
        tx.ref || '-',
        tx.title || '-',
        (tx.type === 'income' ? '' : '-') + formatCurrency(tx.amount),
      ]),
    })

    doc.save(`finance_report_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('Finance report downloaded')
  }

  const catMeta = (key: string) => CATEGORY_META[key] || CATEGORY_META.other

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('finance.title')}</h1>
          <p className="text-muted-foreground">{t('finance.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto no-scrollbar">
            {(['today', '7days', '30days', '90days', 'all'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'ghost'}
                size="sm"
                className="rounded-md text-xs whitespace-nowrap"
                onClick={() => setRange(r)}
              >
                {r === 'today' ? 'Today' : r === '7days' ? '7D' : r === '30days' ? '30D' : r === '90days' ? '90D' : 'All'}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-2" /> {t('finance.exportPdf')}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t('finance.addExpense')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card className="overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('finance.totalIncome')}</CardTitle>
            <div className="rounded-lg bg-green-500/10 p-1.5"><ArrowDownRight className="h-4 w-4 text-green-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('finance.collected')} {formatCurrency(income)}</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('finance.totalExpenses')}</CardTitle>
            <div className="rounded-lg bg-red-500/10 p-1.5"><ArrowUpRight className="h-4 w-4 text-red-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600 truncate">{formatCurrency(expenseTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">{filteredExpenses.length} {t('finance.expenses')}</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('finance.netProfit')}</CardTitle>
            <div className="rounded-lg bg-blue-500/10 p-1.5"><PiggyBank className="h-4 w-4 text-blue-600" /></div>
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold truncate ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</div>
            <p className="text-xs text-muted-foreground mt-1">{netPct}% margin</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('finance.transactions')}</CardTitle>
            <div className="rounded-lg bg-purple-500/10 p-1.5"><Receipt className="h-4 w-4 text-purple-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold truncate">{transactions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('finance.allTransactions')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t('finance.cashFlow')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('finance.cashFlowDesc')}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-muted-foreground">{t('finance.income')}</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-muted-foreground">{t('finance.expenses')}</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
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
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0), '']} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} fill="url(#fInc)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fill="url(#fExp)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 opacity-20 mr-3" /><span>{t('finance.noData')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t('finance.expenseBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {expenseByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [formatCurrency(Number(v) || 0), '']} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {expenseByCategory.map((item) => {
                    const total = expenseByCategory.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                    return (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="capitalize">{item.name}</span>
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
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">{t('finance.noData')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-purple-600" />
              {t('finance.transactionHistory')}
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
                      <TableHead className="text-right">{t('finance.amount')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
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
                            <Badge className={tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} variant="outline">
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
                          <TableCell className={`text-right font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell>
                            {tx.type === 'expense' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setDeleteTarget(tx.data)} className="text-red-600 cursor-pointer">
                                    <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
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
                            <Badge className={tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} variant="outline">
                              {tx.type === 'income' ? 'Income' : 'Expense'}
                            </Badge>
                            {tx.ref && <span className="font-mono text-[11px] text-muted-foreground">{tx.ref}</span>}
                          </div>
                          <p className="font-medium text-sm truncate mt-1.5">{tx.title || '-'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteTarget(tx.data)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Add Expense Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('finance.addExpense')}</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            <Button onClick={submitExpense} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('finance.saveExpense')}
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
