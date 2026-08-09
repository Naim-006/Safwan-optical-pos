'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Trash2, Edit, User, ChevronLeft, ChevronRight,
  AlertTriangle, FileSpreadsheet, Printer, ShoppingBag, DollarSign, Clock,
  Phone, Mail, MapPin, Calendar, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { customerSchema, type CustomerInput } from '@/lib/validators'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/use-data'
import { useLang } from '@/contexts/lang-provider'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type CustRow = Record<string, any>

function getInitials(name: string) {
  return name.split(' ').map((n: any) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustRow | null>(null)
  const [viewCustomer, setViewCustomer] = useState<CustRow | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<CustRow | null>(null)
  const [pendingCustData, setPendingCustData] = useState<CustomerInput | null>(null)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('newest')
  const [perPage, setPerPage] = useState(20)
  const { t } = useLang()

  // ─── Customer data ───
  const { data: customers = [], isLoading } = useCustomers()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()

  // ─── Lazy-loaded invoice history (only fetches when viewing a customer) ───
  const [custInvoices, setCustInvoices] = useState<any[]>([])
  const [custStats, setCustStats] = useState({ total: 0, paid: 0, count: 0, last: null as any })
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  useEffect(() => {
    if (!viewCustomer) return
    setInvoicesLoading(true)
    const sb = createClient()
    const name = (viewCustomer.name || '').toLowerCase()
    sb.from('invoices')
      .select('*')
      .or(`customer_id.eq.${viewCustomer.id},customer_name.ilike.${name}`)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }: any) => {
        const invs = data || []
        setCustInvoices(invs)
        let total = 0, paid = 0, count = 0
        for (const i of invs) {
          if (i.invoice_type === 'receipt') continue
          count++
          total += Number(i.total_amount || 0)
          if (i.payment_status === 'paid') paid += Number(i.total_amount || 0)
        }
        setCustStats({ total, paid, count, last: invs[0] || null })
        setInvoicesLoading(false)
      }, () => setInvoicesLoading(false))
  }, [viewCustomer])

  // ─── Form ───
  const {
    register, handleSubmit, reset, setValue, getValues,
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema) as any,
    defaultValues: { name: '', phone: '', email: '', address: '', eyeType: '', lensType: '', notes: '' },
  })

  const openEdit = useCallback((c: CustRow) => {
    setEditingCustomer(c)
    // Map DB snake_case fields to form camelCase
    const rxMap: Record<string, string> = {
      right_sphere: 'rightSphere', right_cylinder: 'rightCylinder', right_axis: 'rightAxis', right_add: 'rightAdd',
      left_sphere: 'leftSphere', left_cylinder: 'leftCylinder', left_axis: 'leftAxis', left_add: 'leftAdd',
    }
    setValue('name', c.name)
    setValue('phone', c.phone || '')
    setValue('email', c.email || '')
    setValue('address', c.address || '')
    setValue('dateOfBirth', c.date_of_birth || '')
    Object.entries(rxMap).forEach(([db, form]) => setValue(form as any, c[db] ?? 0))
    setValue('ipd', c.ipd ?? 0)
    setValue('eyeType', c.eye_type || '')
    setValue('lensType', c.lens_type || '')
    setValue('notes', c.notes || '')
    setDialogOpen(true)
  }, [setValue])

  const openAdd = useCallback(() => {
    setEditingCustomer(null)
    reset({ name: '', phone: '', email: '', address: '', notes: '' })
    setDialogOpen(true)
  }, [reset])

  const onSubmit = (data: CustomerInput) => {
    if (!editingCustomer && data.name && data.phone) {
      const dup = customers.find((c: any) => c.name.toLowerCase() === data.name.toLowerCase() && c.phone === data.phone)
      if (dup) { setDuplicateWarning(dup); setPendingCustData(data); return }
    }
    const payload: Record<string, any> = {
      name: data.name, phone: data.phone || null, email: data.email || null, address: data.address || null,
      date_of_birth: data.dateOfBirth || null,
      right_sphere: data.rightSphere ?? 0, right_cylinder: data.rightCylinder ?? 0,
      right_axis: data.rightAxis ?? 0, right_add: data.rightAdd ?? 0,
      left_sphere: data.leftSphere ?? 0, left_cylinder: data.leftCylinder ?? 0,
      left_axis: data.leftAxis ?? 0, left_add: data.leftAdd ?? 0,
      ipd: data.ipd ?? 0, eye_type: data.eyeType || null, lens_type: data.lensType || null, notes: data.notes || null,
    }
    if (editingCustomer) updateMutation.mutate({ id: editingCustomer.id, updates: payload })
    else createMutation.mutate(payload)
    setDialogOpen(false)
    setEditingCustomer(null)
  }

  // ─── Lightweight filter + sort (NO invoice data) ───
  const displayData = useMemo(() => {
    let list = search
      ? (customers as any[]).filter((c: any) => {
          const q = search.toLowerCase()
          return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
        })
      : [...(customers as any[])]

    list.sort((a: any, b: any) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name)
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const pages = Math.ceil(list.length / perPage)
    const paged = list.slice((page - 1) * perPage, page * perPage)
    return { list: paged, total: list.length, pages }
  }, [customers, search, sortBy, page, perPage])

  // ─── Excel ───
  const handleExportExcel = () => {
    const rows = (customers as any[]).map((c: any) => ({
      Name: c.name, Phone: c.phone || '', Email: c.email || '', Address: c.address || '',
      DOB: c.date_of_birth || '', 'Eye Type': c.eye_type || '', 'Lens Type': c.lens_type || '',
      'R SPH': c.right_sphere, 'R CYL': c.right_cylinder, 'R AXIS': c.right_axis, 'R ADD': c.right_add,
      'L SPH': c.left_sphere, 'L CYL': c.left_cylinder, 'L AXIS': c.left_axis, 'L ADD': c.left_add,
      IPD: c.ipd, Notes: c.notes || '', Joined: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`${customers.length} exported`)
  }

  const handleImportExcel = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data)
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
        let count = 0
        for (const row of rows) {
          if (!row.Name && !row.name) continue
          try { await createMutation.mutateAsync({ name: row.Name || row.name || '', phone: row.Phone || row.phone || null, email: row.Email || row.email || null }); count++ } catch {}
        }
        toast.success(`Imported ${count}`)
      } catch { toast.error('Invalid file') }
    }
    input.click()
  }

  const handlePrintHistory = () => {
    if (!viewCustomer) return
    const win = window.open('', '', 'width=700,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>History</title><style>
      body{font-family:Arial;margin:20px} h2{text-align:center} table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f0f0f0;padding:8px;text-align:left;border-bottom:2px solid #000}
      td{padding:6px 8px;border-bottom:1px solid #eee}
      .stats{display:flex;gap:20px;justify-content:center;margin-bottom:20px}
      .stat{text-align:center;padding:10px 20px;border:1px solid #ddd;border-radius:8px}
      .stat .v{font-size:20px;font-weight:bold;color:#2563eb}
      .stat .l{font-size:10px;color:#666}
      @media print{body{margin:10px}}
    </style></head><body>
      <h2>Customer Purchase History</h2>
      <p style="text-align:center;color:#666">${viewCustomer.name}${viewCustomer.phone ? ' — ' + viewCustomer.phone : ''}</p>
      <div class="stats">
        <div class="stat"><div class="v">${formatCurrency(custStats.total)}</div><div class="l">Total Spent</div></div>
        <div class="stat"><div class="v">${formatCurrency(custStats.paid)}</div><div class="l">Paid</div></div>
        <div class="stat"><div class="v">${custStats.count}</div><div class="l">Invoices</div></div>
        <div class="stat"><div class="v">${custStats.last ? formatCurrency(custStats.last.total_amount) : '-'}</div><div class="l">Last</div></div>
      </div>
      <table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${custInvoices.map((inv: any, i: number) => `<tr><td>${inv.invoice_number}</td><td>${new Date(inv.created_at).toLocaleDateString()}</td><td>${inv.invoice_type}</td><td>${formatCurrency(inv.total_amount)}</td><td>${inv.payment_status}</td></tr>`).join('')}</tbody></table>
      <script>setTimeout(function(){window.print();window.close()},300)</script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
          <p className="text-muted-foreground">{displayData.total} customers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleImportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={openAdd} className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" /> Add</Button>
        </div>
      </div>

      <Card className="border-t-2 border-t-purple-500 shadow-sm">
        <CardHeader className="pb-3 bg-gradient-to-b from-purple-50/80 to-transparent dark:from-purple-950/30 dark:to-transparent rounded-t-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(v) => { if (v) { setSortBy(v); setPage(1) } }}>
                <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(perPage)} onValueChange={(v) => { if (v) { setPerPage(Number(v)); setPage(1) } }}>
                <SelectTrigger className="w-[70px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : displayData.list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><User className="h-12 w-12 mx-auto mb-3 opacity-20" /><p>No customers</p></div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block scroll-x -mx-1 px-1">
                <Table className="min-w-[640px]">
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="w-[50px]">Rx</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {displayData.list.map((customer: any) => (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20" onClick={() => { setCustInvoices([]); setCustStats({ total: 0, paid: 0, count: 0, last: null }); setViewCustomer(customer) }}>
                        <TableCell><div className="flex items-center gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{getInitials(customer.name)}</AvatarFallback></Avatar><span className="font-medium text-sm">{customer.name}</span></div></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{customer.phone || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{customer.email || '-'}</TableCell>
                        <TableCell>{customer.right_sphere != null ? <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">Rx</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(customer)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(customer)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {displayData.list.map((customer: any) => (
                  <div
                    key={customer.id}
                    onClick={() => { setCustInvoices([]); setCustStats({ total: 0, paid: 0, count: 0, last: null }); setViewCustomer(customer) }}
                    className="rounded-xl border p-3.5 active:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0"><AvatarFallback>{getInitials(customer.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                          {customer.right_sphere != null && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600 shrink-0">Rx</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.phone || 'No phone'}{customer.email ? ` · ${customer.email}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(customer)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(customer)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {displayData.pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm text-muted-foreground">{page} / {displayData.pages}</span>
                  <Button variant="outline" size="sm" disabled={page === displayData.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Customer Dialog — lazy loaded invoices */}
      <Dialog open={!!viewCustomer} onOpenChange={() => setViewCustomer(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {viewCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-9 w-9"><AvatarFallback>{getInitials(viewCustomer.name)}</AvatarFallback></Avatar>
                  <div><div>{viewCustomer.name}</div>{viewCustomer.phone && <div className="text-sm font-normal text-muted-foreground">{viewCustomer.phone}</div>}</div>
                </DialogTitle>
              </DialogHeader>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[{ label: 'Total Spent', icon: DollarSign, color: 'text-blue-600', value: formatCurrency(custStats.total) },
                  { label: 'Purchases', icon: ShoppingBag, color: 'text-green-600', value: custStats.count },
                  { label: 'Paid', icon: ShoppingBag, color: 'text-emerald-600', value: formatCurrency(custStats.paid) },
                  { label: 'Last', icon: Clock, color: 'text-purple-600', value: custStats.last ? new Date(custStats.last.created_at).toLocaleDateString() : '-' },
                ].map((s, i) => (
                  <Card key={i} className="py-2"><CardContent className="p-1.5 text-center">
                    <s.icon className={`h-3.5 w-3.5 ${s.color} mx-auto mb-0.5`} />
                    <div className="text-sm font-bold truncate">{s.value}</div>
                    <div className="text-[9px] text-muted-foreground">{s.label}</div>
                  </CardContent></Card>
                ))}
              </div>

              {invoicesLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Loading history...</div>
              ) : (
                <Tabs defaultValue="history">
                  <TabsList className="w-full">
                    <TabsTrigger value="history" className="flex-1">Purchase History</TabsTrigger>
                    <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                    <TabsTrigger value="prescription" className="flex-1">Prescription</TabsTrigger>
                  </TabsList>
                  <TabsContent value="history" className="pt-3">
                    <div className="mb-2"><Button variant="outline" size="sm" onClick={handlePrintHistory}><Printer className="h-3.5 w-3.5 mr-1.5" /> Print History</Button></div>
                    {custInvoices.length > 0 ? (
                      <Table>
                        <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {custInvoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell className="text-xs">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                              <TableCell><Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">{inv.payment_status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-center py-6 text-sm text-muted-foreground">No purchase history</p>}
                  </TabsContent>
                  <TabsContent value="details" className="space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{viewCustomer.phone || '-'}</div>
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{viewCustomer.email || '-'}</div>
                      <div className="flex items-center gap-2 col-span-2"><MapPin className="h-4 w-4 text-muted-foreground" />{viewCustomer.address || '-'}</div>
                      {(viewCustomer.eye_type || viewCustomer.lens_type) && <div className="flex items-center gap-2 col-span-2"><Eye className="h-4 w-4 text-muted-foreground" />{[viewCustomer.eye_type, viewCustomer.lens_type].filter(Boolean).join(' / ')}</div>}
                      {viewCustomer.date_of_birth && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(viewCustomer.date_of_birth).toLocaleDateString()}</div>}
                    </div>
                    {viewCustomer.notes && <div className="text-sm text-muted-foreground pt-2 border-t">{viewCustomer.notes}</div>}
                  </TabsContent>
                  <TabsContent value="prescription" className="pt-3">
                    {viewCustomer.right_sphere != null ? (
                      <Table>
                        <TableHeader><TableRow><TableHead></TableHead><TableHead className="text-center">SPH</TableHead><TableHead className="text-center">CYL</TableHead><TableHead className="text-center">AXIS</TableHead><TableHead className="text-center">ADD</TableHead></TableRow></TableHeader>
                        <TableBody>
                          <TableRow><TableCell className="font-medium">OD (Right)</TableCell><TableCell className="text-center">{viewCustomer.right_sphere ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_cylinder ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_axis ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_add ?? '-'}</TableCell></TableRow>
                          <TableRow><TableCell className="font-medium">OS (Left)</TableCell><TableCell className="text-center">{viewCustomer.left_sphere ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_cylinder ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_axis ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_add ?? '-'}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No prescription</p>}
                    {viewCustomer.ipd != null && <p className="text-sm text-center mt-2">IPD: <span className="font-medium">{viewCustomer.ipd}mm</span></p>}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate + Delete dialogs */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={() => { setDuplicateWarning(null); setPendingCustData(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Customer Already Exists</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Same name and phone found: <strong>{duplicateWarning?.name}</strong></p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (duplicateWarning) { setEditingCustomer(duplicateWarning); setDuplicateWarning(null); setPendingCustData(null) } }}>Edit Existing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Customer</AlertDialogTitle><AlertDialogDescription>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit — compact form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input {...register('name')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input {...register('phone')} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...register('email')} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input {...register('address')} /></div>
            <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" {...register('dateOfBirth')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Eye Type</Label><Select value={getValues('eyeType') || ''} onValueChange={(v) => v && setValue('eyeType', v, { shouldDirty: true })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['Single Vision','Bifocal','Progressive','Office Lens','Other'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Lens Type</Label><Select value={getValues('lensType') || ''} onValueChange={(v) => v && setValue('lensType', v, { shouldDirty: true })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['CR-39','Polycarbonate','BlueCut','Photochromic','Hi-Index','Other'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="border rounded-lg p-3">
              <h3 className="font-medium text-sm mb-2">Prescription (Optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-bold text-blue-600 mb-1.5">OD (Right)</p>
                  {['SPH','CYL','AXIS','ADD'].map((f, i) => <div key={f} className="flex items-center gap-2 mb-1"><Label className="text-[10px] w-8">{f}</Label><Input className="h-7 text-xs border-blue-200 dark:border-blue-800" type="number" step={f==='AXIS'?1:0.25} {...register(['rightSphere','rightCylinder','rightAxis','rightAdd'][i] as any, { valueAsNumber: true })} /></div>)}
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-bold text-amber-600 mb-1.5">OS (Left)</p>
                  {['SPH','CYL','AXIS','ADD'].map((f, i) => <div key={f} className="flex items-center gap-2 mb-1"><Label className="text-[10px] w-8">{f}</Label><Input className="h-7 text-xs border-amber-200 dark:border-amber-800" type="number" step={f==='AXIS'?1:0.25} {...register(['leftSphere','leftCylinder','leftAxis','leftAdd'][i] as any, { valueAsNumber: true })} /></div>)}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2"><Label className="text-xs">IPD</Label><Input className="h-7 w-20 text-xs" type="number" step="0.5" {...register('ipd', { valueAsNumber: true })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} {...register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingCustomer ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
