import { createClient } from './client'

function getSupabase() {
  try {
    return createClient()
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function fetchProducts(): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as Row[]) || []
}

export async function fetchProduct(id: string): Promise<Row | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('products').select('*').eq('id', id).single()
  if (error) return null
  return data as Row | null
}

export async function fetchProductByBarcode(barcode: string): Promise<Row | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('products').select('*').eq('barcode', barcode).single()
  if (error) return null
  return data as Row | null
}

export async function createProduct(product: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('products').insert(product as never).select().single()
  if (error) throw error
  return data as Row
}

export async function updateProduct(id: string, updates: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('products').update(updates as never).eq('id', id).select().single()
  if (error) throw error
  return data as Row
}

export async function deleteProduct(id: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function searchProducts(query: string): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('products')
    .select('*')
    .or(`name.ilike.%${query}%,barcode.eq.${query}`)
    .limit(20)
  if (error) throw error
  return (data as Row[]) || []
}

export async function fetchCustomers(): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('customers').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as Row[]) || []
}

export async function searchCustomers(query: string): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(20)
  if (error) throw error
  return (data as Row[]) || []
}

export async function createCustomer(customer: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('customers').insert(customer as never).select().single()
  if (error) throw error
  return data as Row
}

export async function updateCustomer(id: string, updates: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('customers').update(updates as never).eq('id', id).select().single()
  if (error) throw error
  return data as Row
}

export async function deleteCustomer(id: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function fetchInvoices(page = 1, limit = 20): Promise<{ data: Row[]; count: number }> {
  const sb = getSupabase()
  if (!sb) return { data: [], count: 0 }
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error, count } = await sb
    .from('invoices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data: (data as Row[]) || [], count: count || 0 }
}

export async function fetchInvoice(id: string): Promise<Row | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('invoices').select('*').eq('id', id).single()
  if (error) return null
  return data as Row | null
}

export async function fetchInvoiceItems(invoiceId: string): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('invoice_items').select('*').eq('invoice_id', invoiceId)
  if (error) throw error
  return (data as Row[]) || []
}

export async function createInvoice(invoice: Row, items: Row[]) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  const { data: invData, error: invError } = await sb
    .from('invoices')
    .insert(invoice as never)
    .select()
    .single()
  if (invError) throw invError

  const invRecord = invData as Row
  const itemsWithId: Row[] = items.map((item) => ({ ...item, invoice_id: invRecord.id }))
  const { error: itemsError } = await sb.from('invoice_items').insert(itemsWithId as never)
  if (itemsError) throw itemsError

  // Decrement product stock for every sold item (best-effort, never below zero)
  for (const item of itemsWithId) {
    if (!item.product_id || !item.quantity) continue
    try {
      const { data: prod } = await sb
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single()
      if (!prod) continue
      const newQty = Math.max(0, Number((prod as Row).quantity || 0) - Number(item.quantity))
      await sb.from('products').update({ quantity: newQty } as never).eq('id', item.product_id)
    } catch {
      // ignore per-item stock errors so a sale is never blocked
    }
  }

  return invRecord
}

export async function deleteInvoice(id: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('invoices').delete().eq('id', id)
  if (error) throw error
}

export async function fetchSettings(): Promise<Row | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('settings').select('*').limit(1).single()
  if (error) return null
  return data as Row | null
}

export async function saveSettings(settings: Row) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to save settings')
  return data
}

export async function fetchInvoicesByDateRange(startDate: string, endDate: string): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('invoices')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Row[]) || []
}

export async function fetchInvoiceItemsInRange(startDate: string, endDate: string): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('invoice_items')
    .select(
      'id, invoice_id, product_id, description, quantity, unit_price, total_price, ' +
      'invoices!inner(id, invoice_number, created_at, invoice_type, customer_name, payment_status)'
    )
    .gte('invoices.created_at', startDate)
    .lte('invoices.created_at', endDate + 'T23:59:59')
    .neq('invoices.invoice_type', 'receipt')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Row[]) || []
}

export async function fetchSalesReport(startDate: string, endDate: string) {
  const sb = getSupabase()
  if (!sb) return { totalSales: 0, totalInvoices: 0, averageOrder: 0, paidAmount: 0, unpaidAmount: 0 }
  const { data, error } = await sb
    .from('invoices')
    .select('total_amount, payment_status, amount_paid')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
  if (error) throw error

  const invoices = (data as Row[]) || []
  const totalSales = invoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0)
  const paidAmount = invoices.reduce((sum, i) => {
    if (i.payment_status === 'paid') return sum + Number(i.total_amount || 0)
    return sum + Number(i.amount_paid || 0)
  }, 0)

  return {
    totalSales,
    totalInvoices: invoices.length,
    averageOrder: invoices.length ? totalSales / invoices.length : 0,
    paidAmount,
    unpaidAmount: totalSales - paidAmount,
  }
}

export async function generateNextNumber(prefix: 'IN' | 'RE'): Promise<string> {
  const sb = getSupabase()
  if (!sb) return `${prefix}-${Date.now().toString().slice(-6)}`
  const { count, error } = await sb.from('invoices').select('*', { count: 'exact', head: true }).like('invoice_number', `SA-${prefix}-%`)
  if (error) return `${prefix}-${Date.now().toString().slice(-6)}`
  const next = (count || 0) + 1
  return `SA-${prefix}-${String(next).padStart(4, '0')}`
}

// ─── Expenses ───

export async function fetchExpenses(): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('expenses').select('*').order('expense_date', { ascending: false })
  if (error) throw error
  return (data as Row[]) || []
}

export async function createExpense(expense: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('expenses').insert(expense as never).select().single()
  if (error) throw error
  return data as Row
}

export async function updateExpense(id: string, updates: Row) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('expenses').update(updates as never).eq('id', id).select().single()
  if (error) throw error
  return data as Row
}

export async function deleteExpense(id: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ─── Message logs ───

export async function fetchMessageLogs(): Promise<Row[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('message_logs').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data as Row[]) || []
}

export async function createMessageLogs(logs: Row[]) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const rows = logs.filter(Boolean)
  if (rows.length === 0) return []
  const { data, error } = await sb.from('message_logs').insert(rows as never).select()
  if (error) throw error
  return (data as Row[]) || []
}

export async function deleteMessageLog(id: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('message_logs').delete().eq('id', id)
  if (error) throw error
}
