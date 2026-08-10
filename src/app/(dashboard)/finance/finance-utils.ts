// Shared types + pure aggregation helpers for the Finance page.

export type FinancePreset = 'today' | '7days' | '30days' | '90days' | 'all' | 'custom'

export interface FinanceRange {
  start: string
  end: string
  prevStart: string
  prevEnd: string
  label: string
  isCustom: boolean
}

export interface IncomeTx {
  id: string
  type: 'income'
  date: string
  ref: string
  title: string
  category: string
  amount: number
  collected: number
  method: string
  status: string
  data: Record<string, any>
}

export interface ExpenseTx {
  id: string
  type: 'expense'
  date: string
  ref: string
  title: string
  category: string
  amount: number
  method: string
  notes: string
  data: Record<string, any>
}

export type FinTx = IncomeTx | ExpenseTx

export interface FinanceKpis {
  totalIncome: number
  collected: number
  outstanding: number
  expenseTotal: number
  net: number
  margin: number
  invoiceCount: number
  expenseCount: number
  txCount: number
  avgOrder: number
  collectionRate: number
  discount: number
}

export interface CashFlowPoint {
  date: string
  income: number
  expense: number
  net: number
}

export interface MonthlyPoint {
  month: string
  label: string
  income: number
  expense: number
  net: number
}

export interface SlicePoint {
  name: string
  value: number
  color: string
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return isoDate(new Date())
}

export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return isoDate(d)
}

export function resolveFinanceRange(preset: FinancePreset, customFrom: string, customTo: string): FinanceRange {
  const end = new Date()
  let start = new Date()

  switch (preset) {
    case 'today':
      start = new Date()
      start.setHours(0, 0, 0, 0)
      break
    case '7days':
      start.setDate(end.getDate() - 7)
      break
    case '90days':
      start.setDate(end.getDate() - 90)
      break
    case 'all':
      start = new Date(2020, 0, 1)
      break
    case 'custom': {
      const s = customFrom || daysAgoIso(30)
      const e = customTo || todayIso()
      const prev = shiftPeriod(s, e)
      return { start: s, end: e, prevStart: prev.prevStart, prevEnd: prev.prevEnd, label: `${s} — ${e}`, isCustom: true }
    }
    default:
      start.setDate(end.getDate() - 30)
  }

  const s = isoDate(start)
  const e = isoDate(end)
  if (preset === 'all') {
    return { start: s, end: e, prevStart: s, prevEnd: s, label: 'All time', isCustom: false }
  }
  const prev = shiftPeriod(s, e)
  return { start: s, end: e, prevStart: prev.prevStart, prevEnd: prev.prevEnd, label: `${s} — ${e}`, isCustom: false }
}

function shiftPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T23:59:59')
  const len = e.getTime() - s.getTime() + 1
  const pe = new Date(s.getTime() - 1000)
  const ps = new Date(pe.getTime() - len + 1)
  return { prevStart: isoDate(ps), prevEnd: isoDate(pe) }
}

export function buildIncomeTx(invoices: Record<string, any>[]): IncomeTx[] {
  return invoices.map((inv) => {
    const total = Number(inv.total_amount || 0)
    const collected = inv.payment_status === 'paid' ? total : Number(inv.amount_paid || 0)
    return {
      id: 'inv-' + inv.id,
      type: 'income' as const,
      date: inv.created_at,
      ref: inv.invoice_number,
      title: inv.customer_name || 'Walk-in',
      category: inv.invoice_type || 'pos',
      amount: total,
      collected,
      method: inv.payment_method || 'cash',
      status: inv.payment_status || 'unpaid',
      data: inv,
    }
  })
}

export function buildExpenseTx(expenses: Record<string, any>[]): ExpenseTx[] {
  return expenses.map((e) => ({
    id: 'exp-' + e.id,
    type: 'expense' as const,
    date: e.expense_date,
    ref: 'EXP',
    title: e.title,
    category: e.category || 'other',
    amount: Number(e.amount || 0),
    method: e.payment_method || 'cash',
    notes: e.notes || '',
    data: e,
  }))
}

export function computeFinanceKpis(income: IncomeTx[], expense: ExpenseTx[]): FinanceKpis {
  let totalIncome = 0
  let collected = 0
  let discount = 0
  let expenseTotal = 0
  for (const tx of income) {
    totalIncome += tx.amount
    collected += tx.collected
    discount += Number(tx.data?.discount || 0)
  }
  for (const tx of expense) expenseTotal += tx.amount
  const net = totalIncome - expenseTotal
  const margin = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0
  const collectionRate = totalIncome > 0 ? Math.round((collected / totalIncome) * 100) : 0
  return {
    totalIncome,
    collected,
    outstanding: totalIncome - collected,
    expenseTotal,
    net,
    margin,
    invoiceCount: income.length,
    expenseCount: expense.length,
    txCount: income.length + expense.length,
    avgOrder: income.length ? totalIncome / income.length : 0,
    collectionRate,
    discount,
  }
}

export function buildCashFlow(income: IncomeTx[], expense: ExpenseTx[]): CashFlowPoint[] {
  const map: Record<string, CashFlowPoint> = {}
  income.forEach((tx) => {
    const d = tx.date?.slice(0, 10)
    if (!d) return
    if (!map[d]) map[d] = { date: d, income: 0, expense: 0, net: 0 }
    map[d].income += tx.collected
  })
  expense.forEach((tx) => {
    const d = tx.date?.slice(0, 10)
    if (!d) return
    if (!map[d]) map[d] = { date: d, income: 0, expense: 0, net: 0 }
    map[d].expense += tx.amount
  })
  return Object.values(map)
    .map((p) => ({ ...p, net: p.income - p.expense }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function buildMonthlySeries(income: IncomeTx[], expense: ExpenseTx[]): MonthlyPoint[] {
  const map: Record<string, MonthlyPoint> = {}
  const push = (key: string, label: string, field: 'income' | 'expense', value: number) => {
    if (!map[key]) map[key] = { month: key, label, income: 0, expense: 0, net: 0 }
    map[key][field] += value
  }
  income.forEach((tx) => {
    const d = new Date(tx.date)
    if (isNaN(d.getTime())) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    push(key, label, 'income', tx.collected)
  })
  expense.forEach((tx) => {
    const d = new Date(tx.date)
    if (isNaN(d.getTime())) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    push(key, label, 'expense', tx.amount)
  })
  return Object.values(map)
    .map((p) => ({ ...p, net: p.income - p.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function buildExpenseByCategory(expense: ExpenseTx[]): SlicePoint[] {
  const map: Record<string, number> = {}
  expense.forEach((tx) => {
    const c = tx.category || 'other'
    map[c] = (map[c] || 0) + tx.amount
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: '' }))
    .sort((a, b) => b.value - a.value)
}

export function buildIncomeByMethod(income: IncomeTx[]): SlicePoint[] {
  const map: Record<string, number> = {}
  income.forEach((tx) => {
    const m = tx.method || 'cash'
    map[m] = (map[m] || 0) + tx.collected
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: '' }))
    .sort((a, b) => b.value - a.value)
}

export function buildExpenseByMethod(expense: ExpenseTx[]): SlicePoint[] {
  const map: Record<string, number> = {}
  expense.forEach((tx) => {
    const m = tx.method || 'cash'
    map[m] = (map[m] || 0) + tx.amount
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: '' }))
    .sort((a, b) => b.value - a.value)
}

export function trend(cur: number, prev: number): number {
  if (!prev) return cur === 0 ? 0 : 100
  return Math.round(((cur - prev) / prev) * 100)
}

export function sortTransactions(list: FinTx[], search: string): FinTx[] {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? list.filter(
        (tx) =>
          tx.title?.toLowerCase().includes(q) ||
          tx.ref?.toLowerCase().includes(q) ||
          String(tx.category || '').toLowerCase().includes(q) ||
          (tx.type === 'expense' && (tx.notes || '').toLowerCase().includes(q))
      )
    : list
  return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
