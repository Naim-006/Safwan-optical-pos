'use client'

import { useState, useCallback, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Trash2, Edit, Download, Upload, User,
  Phone, Mail, MapPin, Calendar, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, FileSpreadsheet, Printer, ShoppingBag, DollarSign, Clock,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { customerSchema, type CustomerInput } from '@/lib/validators'
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useInvoices,
} from '@/hooks/use-data'
import { useLang } from '@/contexts/lang-provider'
import { formatCurrency } from '@/lib/utils'

type CustRow = Record<string, any>

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
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

  const { data: customers = [], isLoading } = useCustomers()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()
  const { data: invoicesData } = useInvoices(1, 500)
  const allInvoices = invoicesData?.data || []

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', address: '', eyeType: '', lensType: '', notes: '' },
  })

  const eyeType = watch('eyeType') || ''
  const lensType = watch('lensType') || ''

  const openEdit = useCallback((c: CustRow) => {
    setEditingCustomer(c)
    setValue('name', c.name)
    setValue('phone', c.phone || '')
    setValue('email', c.email || '')
    setValue('address', c.address || '')
    setValue('dateOfBirth', c.date_of_birth || '')
    setValue('rightSphere', c.right_sphere)
    setValue('rightCylinder', c.right_cylinder)
    setValue('rightAxis', c.right_axis)
    setValue('rightAdd', c.right_add)
    setValue('leftSphere', c.left_sphere)
    setValue('leftCylinder', c.left_cylinder)
    setValue('leftAxis', c.left_axis)
    setValue('leftAdd', c.left_add)
    setValue('ipd', c.ipd)
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
      const dup = customers.find(
        (c: any) => c.name.toLowerCase() === data.name.toLowerCase() && c.phone === data.phone
      )
      if (dup) {
        setDuplicateWarning(dup)
        setPendingCustData(data)
        return
      }
    }

    const payload: Record<string, any> = {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      date_of_birth: data.dateOfBirth || null,
      right_sphere: data.rightSphere ?? 0, right_cylinder: data.rightCylinder ?? 0,
      right_axis: data.rightAxis ?? 0, right_add: data.rightAdd ?? 0,
      left_sphere: data.leftSphere ?? 0, left_cylinder: data.leftCylinder ?? 0,
      left_axis: data.leftAxis ?? 0, left_add: data.leftAdd ?? 0,
      ipd: data.ipd ?? 0,
      eye_type: data.eyeType || null, lens_type: data.lensType || null,
      notes: data.notes || null,
    }
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, updates: payload })
    } else {
      createMutation.mutate(payload)
    }
    setDialogOpen(false)
    setEditingCustomer(null)
  }

  // ─── Customer invoice history ───
  const customerInvoices = useMemo(() => {
    if (!viewCustomer) return []
    const name = (viewCustomer.name || '').toLowerCase()
    return allInvoices.filter((inv: any) =>
      (inv.customer_id === viewCustomer.id) ||
      (inv.customer_name && inv.customer_name.toLowerCase() === name)
    ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [viewCustomer, allInvoices])

  const customerStats = useMemo(() => {
    const invs = customerInvoices.filter((i: any) => i.invoice_type !== 'receipt')
    const total = invs.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
    const paid = invs.filter((i: any) => i.payment_status === 'paid').reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0)
    return { total, paid, count: invs.length, last: invs[0] }
  }, [customerInvoices])

  // ─── Excel Export ───
  const handleExportExcel = () => {
    const rows = (customers as any[]).map((c) => ({
      Name: c.name, Phone: c.phone || '', Email: c.email || '', Address: c.address || '',
      DOB: c.date_of_birth || '',
      'Eye Type': c.eye_type || '', 'Lens Type': c.lens_type || '',
      'R SPH': c.right_sphere, 'R CYL': c.right_cylinder, 'R AXIS': c.right_axis, 'R ADD': c.right_add,
      'L SPH': c.left_sphere, 'L CYL': c.left_cylinder, 'L AXIS': c.left_axis, 'L ADD': c.left_add,
      IPD: c.ipd, Notes: c.notes || '',
      Joined: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 },
      { wch: 15 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 25 }, { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`${customers.length} customers exported`)
  }

  // ─── Excel Import ───
  const handleImportExcel = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws) as any[]

        let count = 0
        for (const row of rows) {
          const cust: Record<string, any> = {
            name: row.Name || row.name || '',
            phone: row.Phone || row.phone || null,
            email: row.Email || row.email || null,
            address: row.Address || row.address || null,
            date_of_birth: row.DOB || row.date_of_birth || null,
            eye_type: row['Eye Type'] || null,
            lens_type: row['Lens Type'] || null,
            right_sphere: row['R SPH'] || 0,
            right_cylinder: row['R CYL'] || 0,
            right_axis: row['R AXIS'] || 0,
            right_add: row['R ADD'] || 0,
            left_sphere: row['L SPH'] || 0,
            left_cylinder: row['L CYL'] || 0,
            left_axis: row['L AXIS'] || 0,
            left_add: row['L ADD'] || 0,
            ipd: row.IPD || 0,
            notes: row.Notes || null,
          }
          if (cust.name) {
            try { await createMutation.mutateAsync(cust); count++ } catch {}
          }
        }
        toast.success(`Imported ${count} customers`)
      } catch { toast.error('Invalid file format') }
    }
    input.click()
  }

  // ─── Print Customer History ───
  const handlePrintHistory = () => {
    if (!viewCustomer) return
    const invs = customerInvoices
    const win = window.open('', '', 'width=700,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Customer History</title><style>
      body { font-family:Arial,sans-serif; margin:20px; color:#000; }
      h2 { text-align:center; margin-bottom:5px; }
      .sub { text-align:center; color:#666; margin-bottom:20px; font-size:12px; }
      .stats { display:flex; gap:20px; justify-content:center; margin-bottom:20px; }
      .stat { text-align:center; padding:10px 20px; border:1px solid #ddd; border-radius:8px; }
      .stat .v { font-size:20px; font-weight:bold; color:#2563eb; }
      .stat .l { font-size:10px; color:#666; text-transform:uppercase; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { background:#f0f0f0; padding:8px; text-align:left; border-bottom:2px solid #000; }
      td { padding:6px 8px; border-bottom:1px solid #eee; }
      .rx { font-size:10px; color:#666; }
      @media print { body { margin:10px; } }
    </style></head><body>
      <h2>Customer Purchase History</h2>
      <div class="sub">${viewCustomer.name}${viewCustomer.phone ? ' — ' + viewCustomer.phone : ''}</div>
      <div class="stats">
        <div class="stat"><div class="v">${formatCurrency(customerStats.total)}</div><div class="l">Total Spent</div></div>
        <div class="stat"><div class="v">${formatCurrency(customerStats.paid)}</div><div class="l">Total Paid</div></div>
        <div class="stat"><div class="v">${customerStats.count}</div><div class="l">Invoices</div></div>
        <div class="stat"><div class="v">${customerStats.last ? formatCurrency(customerStats.last.total_amount) : '-'}</div><div class="l">Last Purchase</div></div>
      </div>
      <table>
        <thead><tr><th>Invoice #</th><th>Date</th><th>Type</th><th>Total</th><th>Status</th><th>Prescription</th></tr></thead>
        <tbody>${invs.map((inv: any) => `
          <tr>
            <td>${inv.invoice_number}</td>
            <td>${new Date(inv.created_at).toLocaleDateString()}</td>
            <td>${inv.invoice_type.toUpperCase()}</td>
            <td>${formatCurrency(inv.total_amount)}</td>
            <td>${inv.payment_status}</td>
            <td class="rx">${inv.right_sphere ? 'R:'+inv.right_sphere+'/'+inv.right_cylinder+' L:'+inv.left_sphere+'/'+inv.left_cylinder : '-'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
      <script>setTimeout(function(){window.print();window.close();},300)</script>
    </body></html>`)
    win.document.close()
  }

  // ─── Precompute customer spending ───
  const customerSpending = useMemo(() => {
    const map: Record<string, { total: number; lastOrder: string; orderCount: number }> = {}
    allInvoices.forEach((inv: any) => {
      if (inv.invoice_type === 'receipt') return
      const name = (inv.customer_name || '').toLowerCase()
      if (!name) return
      if (!map[name]) map[name] = { total: 0, lastOrder: inv.created_at, orderCount: 0 }
      map[name].total += Number(inv.total_amount || 0)
      map[name].orderCount += 1
      if (inv.created_at > map[name].lastOrder) map[name].lastOrder = inv.created_at
    })
    return map
  }, [allInvoices])

  // ─── Filter, Sort, Paginate ───
  const filtered = customers.filter((c: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
  })

  const sorted = [...filtered].sort((a: any, b: any) => {
    const spendA = customerSpending[a.name?.toLowerCase()]?.total || 0
    const spendB = customerSpending[b.name?.toLowerCase()]?.total || 0
    const lastA = customerSpending[a.name?.toLowerCase()]?.lastOrder || ''
    const lastB = customerSpending[b.name?.toLowerCase()]?.lastOrder || ''
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'last_order': return new Date(lastB).getTime() - new Date(lastA).getTime()
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'spent_high': return spendB - spendA
      case 'spent_low': return spendA - spendB
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const totalPages = Math.ceil(sorted.length / perPage)
  const paginated = sorted.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
          <p className="text-muted-foreground">{sorted.length} customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportExcel}>
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
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
                <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="last_order">Last Order</SelectItem>
                  <SelectItem value="spent_high">Highest Spent</SelectItem>
                  <SelectItem value="spent_low">Lowest Spent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(perPage)} onValueChange={(v) => { if (v) { setPerPage(Number(v)); setPage(1) } }}>
                <SelectTrigger className="w-[70px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No customers found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rx</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20" onClick={() => setViewCustomer(customer)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(customer.name)}</AvatarFallback></Avatar>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{customer.email || '-'}</TableCell>
                      <TableCell>
                        {customer.right_sphere != null ? <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">Rx</Badge> : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(customer)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog - same as before */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" {...register('name')} />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" {...register('phone')} /></div>
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" {...register('email')} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" {...register('address')} /></div>
            <div className="space-y-2"><Label htmlFor="dob">Date of Birth</Label><Input id="dob" type="date" {...register('dateOfBirth')} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs">Eye Type</Label>
                <Select value={eyeType} onValueChange={(v) => v && setValue('eyeType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['Single Vision','Bifocal','Progressive','Office Lens','Other'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-xs">Lens Type</Label>
                <Select value={lensType} onValueChange={(v) => v && setValue('lensType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['CR-39','Polycarbonate','BlueCut','Photochromic','Hi-Index','Other'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">Eye Prescription (Optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">OD (Right)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['SPH','CYL','AXIS','ADD'].map((f, i) => (
                      <div key={f}><Label className="text-[10px] text-muted-foreground">{f}</Label>
                        <Input className="border-blue-200 dark:border-blue-800" type="number" step={f==='AXIS'?1:0.25}
                          {...register(['rightSphere','rightCylinder','rightAxis','rightAdd'][i] as any, { valueAsNumber: true })} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">OS (Left)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['SPH','CYL','AXIS','ADD'].map((f, i) => (
                      <div key={f}><Label className="text-[10px] text-muted-foreground">{f}</Label>
                        <Input className="border-amber-200 dark:border-amber-800" type="number" step={f==='AXIS'?1:0.25}
                          {...register(['leftSphere','leftCylinder','leftAxis','leftAdd'][i] as any, { valueAsNumber: true })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 w-32"><Label className="text-xs">IPD</Label><Input type="number" step="0.5" {...register('ipd', { valueAsNumber: true })} /></div>
            </div>

            <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} {...register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingCustomer ? 'Update' : 'Add'} Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enhanced View Customer Dialog */}
      <Dialog open={!!viewCustomer} onOpenChange={() => setViewCustomer(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback>{getInitials(viewCustomer.name)}</AvatarFallback></Avatar>
                  <div>
                    <div>{viewCustomer.name}</div>
                    {viewCustomer.phone && <div className="text-sm font-normal text-muted-foreground">{viewCustomer.phone}</div>}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Card className="py-3"><CardContent className="p-2 text-center">
                  <DollarSign className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <div className="text-lg font-bold">{formatCurrency(customerStats.total)}</div>
                  <div className="text-[10px] text-muted-foreground">Total Spent</div>
                </CardContent></Card>
                <Card className="py-3"><CardContent className="p-2 text-center">
                  <ShoppingBag className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <div className="text-lg font-bold">{customerStats.count}</div>
                  <div className="text-[10px] text-muted-foreground">Purchases</div>
                </CardContent></Card>
                <Card className="py-3"><CardContent className="p-2 text-center">
                  <DollarSign className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <div className="text-lg font-bold">{formatCurrency(customerStats.paid)}</div>
                  <div className="text-[10px] text-muted-foreground">Paid</div>
                </CardContent></Card>
                <Card className="py-3"><CardContent className="p-2 text-center">
                  <Clock className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                  <div className="text-sm font-bold">{customerStats.last ? new Date(customerStats.last.created_at).toLocaleDateString() : '-'}</div>
                  <div className="text-[10px] text-muted-foreground">Last Purchase</div>
                </CardContent></Card>
              </div>

              <Tabs defaultValue="history">
                <TabsList className="w-full">
                  <TabsTrigger value="history" className="flex-1">Purchase History</TabsTrigger>
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="prescription" className="flex-1">Prescription</TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="pt-4">
                  <div className="flex gap-2 mb-3">
                    <Button variant="outline" size="sm" onClick={handlePrintHistory}>
                      <Printer className="h-4 w-4 mr-2" /> Print History
                    </Button>
                  </div>
                  {customerInvoices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerInvoices.slice(0, 30).map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                            <TableCell className="text-xs">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{inv.invoice_type}</Badge></TableCell>
                            <TableCell className="text-right font-medium text-sm">{formatCurrency(inv.total_amount)}</TableCell>
                            <TableCell><Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">{inv.payment_status}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{inv.right_sphere != null ? 'Yes' : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground text-sm">No purchase history found</p>
                  )}
                </TabsContent>

                <TabsContent value="details" className="space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{viewCustomer.phone || 'No phone'}</div>
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{viewCustomer.email || 'No email'}</div>
                    <div className="flex items-center gap-2 text-sm col-span-2"><MapPin className="h-4 w-4 text-muted-foreground" />{viewCustomer.address || 'No address'}</div>
                    {(viewCustomer.eye_type || viewCustomer.lens_type) && (
                      <div className="flex items-center gap-2 text-sm col-span-2"><Eye className="h-4 w-4 text-muted-foreground" />{[viewCustomer.eye_type, viewCustomer.lens_type].filter(Boolean).join(' / ')}</div>
                    )}
                    {viewCustomer.date_of_birth && (
                      <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(viewCustomer.date_of_birth).toLocaleDateString()}</div>
                    )}
                  </div>
                  {viewCustomer.notes && <div className="text-sm text-muted-foreground pt-2 border-t">{viewCustomer.notes}</div>}
                </TabsContent>

                <TabsContent value="prescription" className="pt-4">
                  {viewCustomer.right_sphere != null || viewCustomer.left_sphere != null ? (
                    <Table>
                      <TableHeader><TableRow><TableHead></TableHead><TableHead className="text-center">SPH</TableHead><TableHead className="text-center">CYL</TableHead><TableHead className="text-center">AXIS</TableHead><TableHead className="text-center">ADD</TableHead></TableRow></TableHeader>
                      <TableBody>
                        <TableRow><TableCell className="font-medium">Right</TableCell><TableCell className="text-center">{viewCustomer.right_sphere ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_cylinder ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_axis ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.right_add ?? '-'}</TableCell></TableRow>
                        <TableRow><TableCell className="font-medium">Left</TableCell><TableCell className="text-center">{viewCustomer.left_sphere ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_cylinder ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_axis ?? '-'}</TableCell><TableCell className="text-center">{viewCustomer.left_add ?? '-'}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No prescription on file</p>
                  )}
                  {viewCustomer.ipd != null && <p className="text-sm text-center mt-2">IPD: <span className="font-medium">{viewCustomer.ipd}mm</span></p>}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={() => { setDuplicateWarning(null); setPendingCustData(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Customer Already Exists</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>A customer with the same name and phone already exists:</p>
              <div className="rounded-lg border p-3 bg-muted/50"><p className="font-medium">{duplicateWarning?.name}</p><p className="text-sm text-muted-foreground">Phone: {duplicateWarning?.phone}</p></div>
              <p>You cannot create a duplicate. Please change the phone number.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (duplicateWarning) { setEditingCustomer(duplicateWarning); setDuplicateWarning(null); setPendingCustData(null) } }}>Edit Existing Customer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
