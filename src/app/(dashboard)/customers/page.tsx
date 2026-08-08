'use client'

import { useState, useCallback } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Trash2, Edit, Download, Upload, User,
  Phone, Mail, MapPin, Calendar, Eye, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { customerSchema, type CustomerInput } from '@/lib/validators'
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
} from '@/hooks/use-data'
import { useLang } from '@/contexts/lang-provider'

type CustRow = Record<string, any>

const ITEMS_PER_PAGE = 15

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
  const { t } = useLang()

  const { data: customers = [], isLoading } = useCustomers()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()

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
    // If adding new and both name + phone provided, check for duplicate
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
      right_sphere: data.rightSphere ?? 0,
      right_cylinder: data.rightCylinder ?? 0,
      right_axis: data.rightAxis ?? 0,
      right_add: data.rightAdd ?? 0,
      left_sphere: data.leftSphere ?? 0,
      left_cylinder: data.leftCylinder ?? 0,
      left_axis: data.leftAxis ?? 0,
      left_add: data.leftAdd ?? 0,
      ipd: data.ipd ?? 0,
      eye_type: data.eyeType || null,
      lens_type: data.lensType || null,
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

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
  })
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const handleExport = () => {
    const json = JSON.stringify(customers, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`${customers.length} customers exported`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
          <p className="text-muted-foreground">{t('customers.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
        </div>
      </div>

      <Card className="border-t-2 border-t-purple-500 shadow-sm">
        <CardHeader className="pb-3 bg-gradient-to-b from-purple-50/80 to-transparent dark:from-purple-950/30 dark:to-transparent rounded-t-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
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
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20"
                      onClick={() => setViewCustomer(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.phone || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {customer.email || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(customer)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" {...register('dateOfBirth')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Eye Type</Label>
                <Select value={eyeType} onValueChange={(v) => v && setValue('eyeType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single Vision">Single Vision</SelectItem>
                    <SelectItem value="Bifocal">Bifocal</SelectItem>
                    <SelectItem value="Progressive">Progressive</SelectItem>
                    <SelectItem value="Office Lens">Office Lens</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Lens Type</Label>
                <Select value={lensType} onValueChange={(v) => v && setValue('lensType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CR-39">CR-39</SelectItem>
                    <SelectItem value="Polycarbonate">Polycarbonate</SelectItem>
                    <SelectItem value="BlueCut">BlueCut</SelectItem>
                    <SelectItem value="Photochromic">Photochromic</SelectItem>
                    <SelectItem value="Hi-Index">Hi-Index</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">Eye Prescription (Optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">OD (Right)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">SPH</Label>
                      <Input className="border-blue-200 dark:border-blue-800" type="number" step="0.25" {...register('rightSphere', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">CYL</Label>
                      <Input className="border-blue-200 dark:border-blue-800" type="number" step="0.25" {...register('rightCylinder', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">AXIS</Label>
                      <Input className="border-blue-200 dark:border-blue-800" type="number" {...register('rightAxis', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">ADD</Label>
                      <Input className="border-blue-200 dark:border-blue-800" type="number" step="0.25" {...register('rightAdd', { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">OS (Left)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">SPH</Label>
                      <Input className="border-amber-200 dark:border-amber-800" type="number" step="0.25" {...register('leftSphere', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">CYL</Label>
                      <Input className="border-amber-200 dark:border-amber-800" type="number" step="0.25" {...register('leftCylinder', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">AXIS</Label>
                      <Input className="border-amber-200 dark:border-amber-800" type="number" {...register('leftAxis', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">ADD</Label>
                      <Input className="border-amber-200 dark:border-amber-800" type="number" step="0.25" {...register('leftAdd', { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 w-32">
                <Label className="text-xs">IPD</Label>
                <Input type="number" step="0.5" {...register('ipd', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCustomer ? 'Update' : 'Add'} Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Customer */}
      <Dialog open={!!viewCustomer} onOpenChange={() => setViewCustomer(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(viewCustomer.name)}</AvatarFallback>
                  </Avatar>
                  {viewCustomer.name}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="details">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="prescription" className="flex-1">Prescription</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {viewCustomer.phone || 'No phone'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {viewCustomer.email || 'No email'}
                    </div>
                    <div className="flex items-center gap-2 text-sm col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {viewCustomer.address || 'No address'}
                    </div>
                    {(viewCustomer.eye_type || viewCustomer.lens_type) && (
                      <div className="flex items-center gap-2 text-sm col-span-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        {[viewCustomer.eye_type, viewCustomer.lens_type].filter(Boolean).join(' / ')}
                      </div>
                    )}
                    {viewCustomer.date_of_birth && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(viewCustomer.date_of_birth).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {viewCustomer.notes && (
                    <div className="text-sm text-muted-foreground pt-2 border-t">
                      {viewCustomer.notes}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="prescription" className="pt-4">
                  {viewCustomer.right_sphere != null || viewCustomer.left_sphere != null ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead></TableHead>
                          <TableHead className="text-center">SPH</TableHead>
                          <TableHead className="text-center">CYL</TableHead>
                          <TableHead className="text-center">AXIS</TableHead>
                          <TableHead className="text-center">ADD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Right</TableCell>
                          <TableCell className="text-center">{viewCustomer.right_sphere ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.right_cylinder ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.right_axis ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.right_add ?? '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Left</TableCell>
                          <TableCell className="text-center">{viewCustomer.left_sphere ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.left_cylinder ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.left_axis ?? '-'}</TableCell>
                          <TableCell className="text-center">{viewCustomer.left_add ?? '-'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No prescription on file
                    </p>
                  )}
                  {viewCustomer.ipd != null && (
                    <p className="text-sm text-center mt-2">
                      IPD: <span className="font-medium">{viewCustomer.ipd}mm</span>
                    </p>
                  )}
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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Customer Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>A customer with the same name and phone already exists:</p>
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="font-medium">{duplicateWarning?.name}</p>
                <p className="text-sm text-muted-foreground">Phone: {duplicateWarning?.phone}</p>
              </div>
              <p>You cannot create a duplicate. Please change the phone number for a new customer, or edit the existing one.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDuplicateWarning(null); setPendingCustData(null) }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicateWarning) {
                  setEditingCustomer(duplicateWarning)
                  setDuplicateWarning(null)
                  setPendingCustData(null)
                }
              }}
            >
              Edit Existing Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
