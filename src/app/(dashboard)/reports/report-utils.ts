// Shared types + pure aggregation helpers for the Reports page.

export interface RangeInfo {
  start: string
  end: string
  prevStart: string
  prevEnd: string
  label: string
  isCustom: boolean
}

export type SortKey = 'revenue' | 'quantity' | 'count' | 'name' | 'price'
export type SortDir = 'asc' | 'desc'

export interface ProductAgg {
  product_id: string | null
  name: string
  category: string
  quantity: number
  revenue: number
  count: number
  avgPrice: number
}

export interface CategoryAgg {
  name: string
  revenue: number
  quantity: number
  count: number
}

export interface CustomerAgg {
  name: string
  revenue: number
  paid: number
  outstanding: number
  invoices: number
}

export interface DailyPoint {
  date: string
  sales: number
  collected: number
  invoices: number
  units: number
}

export interface Kpis {
  totalRevenue: number
  collected: number
  outstanding: number
  invoices: number
  units: number
  avgOrder: number
  collectionRate: number
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

export function resolveRange(preset: string, customFrom: string, customTo: string): RangeInfo {
  const now = new Date()
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
    case '30days':
      start.setDate(end.getDate() - 30)
      break
    case '90days':
      start.setDate(end.getDate() - 90)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      start = new Date(now.getFullYear(), 0, 1)
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

// ─── Aggregation ───

export function computeKpis(invoices: Record<string, any>[], items: Record<string, any>[]): Kpis {
  let totalRevenue = 0
  let collected = 0
  let units = 0
  for (const inv of invoices) {
    const total = Number(inv.total_amount || 0)
    totalRevenue += total
    collected += inv.payment_status === 'paid' ? total : Number(inv.amount_paid || 0)
  }
  for (const it of items) units += Number(it.quantity || 0)
  const avgOrder = invoices.length ? totalRevenue / invoices.length : 0
  const collectionRate = totalRevenue > 0 ? Math.round((collected / totalRevenue) * 100) : 0
  return {
    totalRevenue,
    collected,
    outstanding: totalRevenue - collected,
    invoices: invoices.length,
    units,
    avgOrder,
    collectionRate,
  }
}

export function trend(cur: number, prev: number): number {
  if (!prev) return cur === 0 ? 0 : 100
  return Math.round(((cur - prev) / prev) * 100)
}

export function buildDaily(invoices: Record<string, any>[], items: Record<string, any>[]): DailyPoint[] {
  const map: Record<string, DailyPoint> = {}
  invoices.forEach((inv) => {
    const d = inv.created_at?.slice(0, 10)
    if (!d) return
    if (!map[d]) map[d] = { date: d, sales: 0, collected: 0, invoices: 0, units: 0 }
    map[d].sales += Number(inv.total_amount || 0)
    map[d].invoices += 1
    map[d].collected += inv.payment_status === 'paid' ? Number(inv.total_amount || 0) : Number(inv.amount_paid || 0)
  })
  items.forEach((it) => {
    const d = it.invoices?.created_at?.slice(0, 10)
    if (!d) return
    if (!map[d]) map[d] = { date: d, sales: 0, collected: 0, invoices: 0, units: 0 }
    map[d].units += Number(it.quantity || 0)
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildPaymentStatus(invoices: Record<string, any>[]): { name: string; value: number }[] {
  const map: Record<string, number> = { paid: 0, partial: 0, unpaid: 0 }
  invoices.forEach((inv) => {
    const s = inv.payment_status || 'unpaid'
    map[s] = (map[s] || 0) + Number(inv.total_amount || 0)
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
}

export function buildPaymentMethods(invoices: Record<string, any>[]): { name: string; value: number }[] {
  const map: Record<string, number> = {}
  invoices.forEach((inv) => {
    const m = inv.payment_method || 'cash'
    map[m] = (map[m] || 0) + Number(inv.payment_status === 'paid' ? inv.total_amount : inv.amount_paid || 0)
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export interface WeekdayPoint {
  name: string
  revenue: number
  invoices: number
}

export function buildWeekday(invoices: Record<string, any>[]): WeekdayPoint[] {
  const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days: WeekdayPoint[] = order.map((name) => ({ name, revenue: 0, invoices: 0 }))
  invoices.forEach((inv) => {
    const d = new Date(inv.created_at)
    if (isNaN(d.getTime())) return
    const idx = d.getDay()
    days[idx].revenue += Number(inv.total_amount || 0)
    days[idx].invoices += 1
  })
  return days.filter((d) => d.invoices > 0)
}

export function buildDiscounts(invoices: Record<string, any>[]): { total: number; count: number } {
  let total = 0
  let count = 0
  invoices.forEach((inv) => {
    const d = Number(inv.discount || 0)
    if (d > 0) {
      total += d
      count += 1
    }
  })
  return { total, count }
}

export function aggregateProducts(
  items: Record<string, any>[],
  productById: Record<string, Record<string, any>>
): ProductAgg[] {
  const map = new Map<string, ProductAgg>()
  for (const it of items) {
    const pid = it.product_id as string | null
    const prod = pid ? productById[pid] : undefined
    const name = it.description || prod?.name || 'Unknown item'
    const key = pid || name
    const qty = Number(it.quantity || 0)
    const revenue = Number(it.total_price || Number(it.unit_price || 0) * qty)
    let agg = map.get(key)
    if (!agg) {
      agg = {
        product_id: pid,
        name,
        category: prod?.category || 'Uncategorized',
        quantity: 0,
        revenue: 0,
        count: 0,
        avgPrice: 0,
      }
      map.set(key, agg)
    }
    agg.quantity += qty
    agg.revenue += revenue
    agg.count += 1
  }
  return [...map.values()].map((p) => ({
    ...p,
    avgPrice: p.quantity > 0 ? p.revenue / p.quantity : 0,
  }))
}

export function aggregateCategories(products: ProductAgg[]): CategoryAgg[] {
  const map = new Map<string, CategoryAgg>()
  for (const p of products) {
    const cat = p.category || 'Uncategorized'
    let agg = map.get(cat)
    if (!agg) {
      agg = { name: cat, revenue: 0, quantity: 0, count: 0 }
      map.set(cat, agg)
    }
    agg.revenue += p.revenue
    agg.quantity += p.quantity
    agg.count += p.count
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export function aggregateCustomers(invoices: Record<string, any>[]): CustomerAgg[] {
  const map = new Map<string, CustomerAgg>()
  for (const inv of invoices) {
    const name = inv.customer_name || 'Walk-in'
    let agg = map.get(name)
    if (!agg) {
      agg = { name, revenue: 0, paid: 0, outstanding: 0, invoices: 0 }
      map.set(name, agg)
    }
    const total = Number(inv.total_amount || 0)
    const paid = inv.payment_status === 'paid' ? total : Number(inv.amount_paid || 0)
    agg.revenue += total
    agg.paid += paid
    agg.outstanding += total - paid
    agg.invoices += 1
  }
  return [...map.values()]
}

export function sortProducts(list: ProductAgg[], key: SortKey, dir: SortDir): ProductAgg[] {
  const arr = [...list]
  const f = dir === 'asc' ? 1 : -1
  arr.sort((a, b) => {
    switch (key) {
      case 'name': return a.name.localeCompare(b.name) * f
      case 'quantity': return (a.quantity - b.quantity) * f
      case 'count': return (a.count - b.count) * f
      case 'price': return (a.avgPrice - b.avgPrice) * f
      default: return (a.revenue - b.revenue) * f
    }
  })
  return arr
}
