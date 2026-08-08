'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  Plus, Trash2, Save, User, X, BadgeCheck, Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { invoiceSchema, type InvoiceInput } from '@/lib/validators'
import {
  useSearchCustomers, useCreateInvoice, useProducts,
  useCreateCustomer, useUpdateCustomer,
} from '@/hooks/use-data'
import { formatCurrency, generateInvoiceNumber } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'

const EYE_TYPES = ['Single Vision', 'Bifocal', 'Progressive', 'Office Lens', 'Other']
const LENS_TYPES = ['CR-39', 'Polycarbonate', 'BlueCut', 'Photochromic', 'Hi-Index', 'Other']

export default function NewInvoicePage() {
  const router = useRouter()
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])
  const [userId, setUserId] = useState<string | null>(null)
  const { t } = useLang()
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const customerSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  const { data: customers = [] } = useSearchCustomers(customerSearch)
  const { data: products = [] } = useProducts()
  const createInvoiceMutation = useCreateInvoice()
  const createCustomerMutation = useCreateCustomer()
  const updateCustomerMutation = useUpdateCustomer()

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<any>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
      invoiceType: 'optical',
      paymentStatus: 'paid',
      discount: 0,
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
      customerName: '',
      customerPhone: '',
      eyeType: '',
      lensType: '',
      rightSphere: null,
      rightCylinder: null,
      rightAxis: null,
      rightAdd: null,
      leftSphere: null,
      leftCylinder: null,
      leftAxis: null,
      leftAdd: null,
      ipd: null,
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const discount = watch('discount') || 0
  const eyeType = watch('eyeType') || ''
  const lensType = watch('lensType') || ''
  const customerName = watch('customerName') || ''

  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)
  const total = subtotal - discount

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addProduct = useCallback((product: typeof products[0]) => {
    const exists = items.findIndex((i: any) => i.description === product.name)
    if (exists >= 0) {
      const updated = [...items]
      updated[exists] = {
        ...updated[exists],
        quantity: updated[exists].quantity + 1,
        totalPrice: (updated[exists].quantity + 1) * updated[exists].unitPrice,
      }
      setValue('items', updated)
    } else {
      append({
        description: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      })
    }
  }, [items, append, setValue])

  const updateItem = (index: number, field: string, value: number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].totalPrice = updated[index].quantity * updated[index].unitPrice
    }
    setValue('items', updated)
  }

  const selectCustomer = (customer: typeof customers[0]) => {
    setSelectedCustomerId(customer.id)
    setValue('customerName', customer.name)
    setValue('customerPhone', customer.phone || '')
    setValue('customerId', customer.id)
    setValue('rightSphere', customer.right_sphere)
    setValue('rightCylinder', customer.right_cylinder)
    setValue('rightAxis', customer.right_axis)
    setValue('rightAdd', customer.right_add)
    setValue('leftSphere', customer.left_sphere)
    setValue('leftCylinder', customer.left_cylinder)
    setValue('leftAxis', customer.left_axis)
    setValue('leftAdd', customer.left_add)
    setValue('ipd', customer.ipd)
    setValue('eyeType', customer.eye_type || '')
    setValue('lensType', customer.lens_type || '')
    setCustomerSearch(customer.name)
    setShowCustomerResults(false)
  }

  const openNewCustomer = () => {
    setSelectedCustomerId(null)
    setValue('customerName', customerSearch)
    setValue('customerPhone', '')
    setValue('customerId', null)
    setShowCustomerResults(false)
  }

  const clearCustomer = () => {
    setSelectedCustomerId(null)
    setCustomerSearch('')
    setValue('customerName', '')
    setValue('customerPhone', '')
    setValue('customerId', null)
  }

  const onSubmit = async (data: any) => {
    try {
      let finalCustomerId = selectedCustomerId

      const rx = {
        right_sphere: data.rightSphere ?? null,
        right_cylinder: data.rightCylinder ?? null,
        right_axis: data.rightAxis ?? null,
        right_add: data.rightAdd ?? null,
        left_sphere: data.leftSphere ?? null,
        left_cylinder: data.leftCylinder ?? null,
        left_axis: data.leftAxis ?? null,
        left_add: data.leftAdd ?? null,
        ipd: data.ipd ?? null,
      }

      if (customerName.trim()) {
        if (selectedCustomerId) {
          updateCustomerMutation.mutate({
            id: selectedCustomerId,
            updates: {
              name: customerName,
              phone: data.customerPhone || null,
              eye_type: data.eyeType || null,
              lens_type: data.lensType || null,
              ...rx,
            },
          })
        } else {
          const newCust = await createCustomerMutation.mutateAsync({
            name: customerName,
            phone: data.customerPhone || null,
            eye_type: data.eyeType || null,
            lens_type: data.lensType || null,
            ...rx,
          })
          finalCustomerId = (newCust as any)?.id
        }
      }

      setValue('subtotal', subtotal)
      setValue('totalAmount', total)
      setValue('balanceDue', data.paymentStatus === 'paid' ? 0 : total)

      await createInvoiceMutation.mutateAsync({
        invoice: {
          invoice_number: generateInvoiceNumber('ROM'),
          customer_name: customerName || null,
          customer_phone: data.customerPhone || null,
          customer_id: finalCustomerId || null,
          eye_type: data.eyeType || null,
          lens_type: data.lensType || null,
          ...(data.rightSphere !== undefined ? { right_sphere: data.rightSphere } : {}),
          ...(data.rightCylinder !== undefined ? { right_cylinder: data.rightCylinder } : {}),
          ...(data.rightAxis !== undefined ? { right_axis: data.rightAxis } : {}),
          ...(data.rightAdd !== undefined ? { right_add: data.rightAdd } : {}),
          ...(data.leftSphere !== undefined ? { left_sphere: data.leftSphere } : {}),
          ...(data.leftCylinder !== undefined ? { left_cylinder: data.leftCylinder } : {}),
          ...(data.leftAxis !== undefined ? { left_axis: data.leftAxis } : {}),
          ...(data.leftAdd !== undefined ? { left_add: data.leftAdd } : {}),
          ...(data.ipd !== undefined ? { ipd: data.ipd } : {}),
          subtotal,
          discount,
          total_amount: total,
          amount_paid: data.paymentStatus === 'paid' ? total : (data.amountPaid || 0),
          balance_due: data.paymentStatus === 'paid' ? 0 : total - (data.amountPaid || 0),
          payment_status: data.paymentStatus,
          payment_method: data.paymentMethod || null,
          invoice_type: 'optical',
          notes: data.notes || null,
          created_by: userId || '00000000-0000-0000-0000-000000000000',
        },
        items: items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
        })),
      })
      toast.success('Invoice saved')
      router.push('/invoices')
    } catch (e: any) {
      toast.error('Failed to save invoice: ' + (e?.message || ''))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('newInvoice.title')}</h1>
          <p className="text-muted-foreground">{t('newInvoice.subtitle')}</p>
        </div>
        <Button type="submit" disabled={createInvoiceMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save Invoice
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer & Prescription */}
        <Card className="border-t-2 border-t-violet-500 shadow-sm">
          <CardHeader className="bg-gradient-to-b from-violet-50/80 to-transparent dark:from-violet-950/30 dark:to-transparent rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4 text-violet-600" /> Customer & Prescription
              {selectedCustomerId && <Badge className="ml-auto text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 border-violet-300">Member</Badge>}
              {!selectedCustomerId && customerName && <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300">New</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer search with dropdown */}
            <div className="relative" ref={customerSearchRef}>
              <Label>Search Customer</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setShowCustomerResults(true)
                  }}
                  onFocus={() => { if (customerSearch.length >= 2) setShowCustomerResults(true) }}
                />
              </div>

              {showCustomerResults && customerSearch.length >= 2 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customers.length > 0 ? (
                    customers.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer text-sm border-b last:border-0"
                        onClick={() => selectCustomer(c)}
                      >
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone || 'No phone'}</p>
                        </div>
                        {c.right_sphere != null && (
                          <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600">Rx</Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div
                      className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer text-sm text-primary font-medium"
                      onClick={openNewCustomer}
                    >
                      <Plus className="h-3 w-3" />
                      Create &ldquo;{customerSearch}&rdquo; as new customer
                    </div>
                  )}
                </div>
              )}

              {/* Selected customer display */}
              {customerName && !showCustomerResults && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded-lg">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{customerName}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCustomer} type="button">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name</Label>
                <Input {...register('customerName')}
                  onChange={(e) => {
                    register('customerName').onChange(e)
                    if (!selectedCustomerId) setCustomerSearch(e.target.value)
                  }}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...register('customerPhone')} />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Eye Type</Label>
                <Select value={eyeType} onValueChange={(v) => v && setValue('eyeType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{EYE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Lens Type</Label>
                <Select value={lensType} onValueChange={(v) => v && setValue('lensType', v, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{LENS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="border border-violet-200 dark:border-violet-800 rounded-lg p-4 bg-violet-50/20 dark:bg-violet-950/10">
              <h3 className="font-medium text-sm mb-3 text-violet-700 dark:text-violet-400">Prescription</h3>
              <div className="grid grid-cols-5 gap-2 mb-2">
                <div></div>
                <Label className="text-[10px] text-center font-medium text-muted-foreground">SPH</Label>
                <Label className="text-[10px] text-center font-medium text-muted-foreground">CYL</Label>
                <Label className="text-[10px] text-center font-medium text-muted-foreground">AXIS</Label>
                <Label className="text-[10px] text-center font-medium text-muted-foreground">ADD</Label>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">OD</Label>
                  <Input type="number" step="0.25" className="border-blue-200 dark:border-blue-800" {...register('rightSphere', { valueAsNumber: true })} />
                  <Input type="number" step="0.25" className="border-blue-200 dark:border-blue-800" {...register('rightCylinder', { valueAsNumber: true })} />
                  <Input type="number" className="border-blue-200 dark:border-blue-800" {...register('rightAxis', { valueAsNumber: true })} />
                  <Input type="number" step="0.25" className="border-blue-200 dark:border-blue-800" {...register('rightAdd', { valueAsNumber: true })} />
                </div>
                <div className="grid grid-cols-5 gap-2 items-center p-2 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">OS</Label>
                  <Input type="number" step="0.25" className="border-amber-200 dark:border-amber-800" {...register('leftSphere', { valueAsNumber: true })} />
                  <Input type="number" step="0.25" className="border-amber-200 dark:border-amber-800" {...register('leftCylinder', { valueAsNumber: true })} />
                  <Input type="number" className="border-amber-200 dark:border-amber-800" {...register('leftAxis', { valueAsNumber: true })} />
                  <Input type="number" step="0.25" className="border-amber-200 dark:border-amber-800" {...register('leftAdd', { valueAsNumber: true })} />
                </div>
              </div>
              <div className="mt-2 w-32">
                <Label className="text-xs">IPD (mm)</Label>
                <Input type="number" step="0.5" {...register('ipd', { valueAsNumber: true })} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
          </CardContent>
        </Card>

        {/* Items & Payment */}
        <div className="space-y-4">
          <Card className="border-t-2 border-t-blue-500 shadow-sm">
            <CardHeader className="bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/30 dark:to-transparent rounded-t-xl">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">Items</span>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {products.slice(0, 8).map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() => addProduct(p)}
                  >
                    {p.name} ({formatCurrency(p.price)})
                  </Button>
                ))}
              </div>
              <Separator />
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Description"
                    className="flex-1"
                    {...register(`items.${index}.description`)}
                    onChange={(e) => updateItem(index, 'description', e.target.value as unknown as number)}
                  />
                  <Input type="number" className="w-16" value={items[index].quantity}
                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} />
                  <Input type="number" step="0.01" className="w-24" value={items[index].unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} />
                  <span className="text-sm font-medium w-20 text-right">{formatCurrency(items[index].totalPrice)}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-t-2 border-t-green-500 shadow-sm">
            <CardHeader className="bg-gradient-to-b from-green-50/80 to-transparent dark:from-green-950/30 dark:to-transparent rounded-t-xl">
              <CardTitle className="text-lg text-green-700 dark:text-green-400">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <Input type="number" className="w-24 h-7 text-right" value={discount}
                  onChange={(e) => setValue('discount', Number(e.target.value))} />
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select onValueChange={(v) => v && setValue('paymentStatus', v as 'paid' | 'partial' | 'unpaid')}>
                    <SelectTrigger><SelectValue placeholder="Paid" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Method</Label>
                  <Select onValueChange={(v) => v && setValue('paymentMethod', v as 'cash' | 'card' | 'transfer')}>
                    <SelectTrigger><SelectValue placeholder="Cash" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {watch('paymentStatus') === 'partial' && (
                <div className="flex items-center gap-2 pt-1">
                  <Label className="text-xs whitespace-nowrap">Amount Paid</Label>
                  <Input type="number" className="h-8 w-28" onChange={(e) => setValue('amountPaid', Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground">SAR</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
