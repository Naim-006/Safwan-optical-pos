'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Search, Trash2, Minus, Plus, ShoppingCart, Scan, User,
  Phone, ChevronDown, ChevronUp, Eye, EyeOff, X, Check,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import JsBarcode from 'jsbarcode'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { usePosStore } from '@/stores'
import {
  useProducts, useSearchProducts, useCreateInvoice,
  useSearchCustomers, useCreateCustomer, useUpdateCustomer,
} from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { generateNextNumber } from '@/lib/supabase/data'
import { useLang } from '@/contexts/lang-provider'

export default function PosPage() {
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  // ─── Product / Cart ───
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data: allProducts = [] } = useProducts()
  const { data: searchedProducts = [] } = useSearchProducts(searchQuery)
  const createInvoiceMutation = useCreateInvoice()
  const { t } = useLang()
  const {
    cart, addToCart, removeFromCart, updateQuantity,
    discount, setDiscount, clearCart, getCartTotal, getItemCount,
  } = usePosStore()

  const displayProducts = searchQuery.length >= 2 ? searchedProducts : allProducts.slice(0, 30)

  // ─── Payment ───
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid')
  const [amountPaid, setAmountPaid] = useState<number>(0)

  // ─── Customer search ───
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(false)
  const enterCountRef = useRef<number>(0)
  const customerSearchRef = useRef<HTMLDivElement>(null)

  const { data: customerResults = [], isLoading: searchingCustomers } = useSearchCustomers(
    customerSearch.length >= 2 ? customerSearch : '__no_search__'
  )

  const createCustomerMutation = useCreateCustomer()
  const updateCustomerMutation = useUpdateCustomer()

  // ─── Prescription ───
  const [showPrescription, setShowPrescription] = useState(false)
  const [prescription, setPrescription] = useState({
    right_sphere: '' as string | number,
    right_cylinder: '' as string | number,
    right_axis: '' as string | number,
    right_add: '' as string | number,
    left_sphere: '' as string | number,
    left_cylinder: '' as string | number,
    left_axis: '' as string | number,
    left_add: '' as string | number,
    ipd: '' as string | number,
    eye_type: '',
    lens_type: '',
  })

  const updateRx = (field: string, value: string) => {
    setPrescription((prev) => ({ ...prev, [field]: value === '' ? '' : Number(value) }))
  }

  const clearPrescription = () => {
    setPrescription({
      right_sphere: '', right_cylinder: '', right_axis: '', right_add: '',
      left_sphere: '', left_cylinder: '', left_axis: '', left_add: '',
      ipd: '', eye_type: '', lens_type: '',
    })
  }

  // ─── Close customer dropdown on outside click ───
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Barcode scan ───
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return
    const product = allProducts.find((p) => p.barcode === barcodeInput.trim())
    if (product) {
      addToCart(product)
      setBarcodeInput('')
      toast.success(`Added ${product.name}`)
    } else {
      toast.error('Product not found')
    }
    barcodeRef.current?.focus()
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.cartQuantity, 0)
  const total = subtotal - discount
  const balanceDue = paymentStatus === 'paid' ? 0 : paymentStatus === 'partial' ? Math.max(0, total - amountPaid) : total

  // ─── Customer selection ───
  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id)
    setCustomerName(cust.name || '')
    setCustomerPhone(cust.phone || '')
    setCustomerSearch(cust.name)
    setShowCustomerResults(false)
    setIsWalkIn(false)
    setShowPrescription(true)
    setPrescription({
      right_sphere: cust.right_sphere ?? '',
      right_cylinder: cust.right_cylinder ?? '',
      right_axis: cust.right_axis ?? '',
      right_add: cust.right_add ?? '',
      left_sphere: cust.left_sphere ?? '',
      left_cylinder: cust.left_cylinder ?? '',
      left_axis: cust.left_axis ?? '',
      left_add: cust.left_add ?? '',
      ipd: cust.ipd ?? '',
      eye_type: cust.eye_type || '',
      lens_type: cust.lens_type || '',
    })
  }

  const clearCustomer = () => {
    setSelectedCustomerId(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerSearch('')
    setIsWalkIn(false)
    clearPrescription()
    setShowPrescription(false)
  }

  const openNewCustomer = () => {
    setSelectedCustomerId(null)
    setCustomerName(customerSearch)
    setCustomerPhone('')
    setIsWalkIn(false)
    setShowCustomerResults(false)
    setShowPrescription(true)
    clearPrescription()
  }

  const setAsWalkIn = () => {
    setSelectedCustomerId(null)
    setCustomerName(customerSearch)
    setIsWalkIn(true)
    setShowCustomerResults(false)
    setShowPrescription(false)
    clearPrescription()
  }

  // ─── Complete sale ───
  const handleComplete = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    try {
      let finalCustomerId = selectedCustomerId

      // Build prescription values (empty = 0)
      const rx = {
        right_sphere: prescription.right_sphere === '' ? 0 : Number(prescription.right_sphere),
        right_cylinder: prescription.right_cylinder === '' ? 0 : Number(prescription.right_cylinder),
        right_axis: prescription.right_axis === '' ? 0 : Number(prescription.right_axis),
        right_add: prescription.right_add === '' ? 0 : Number(prescription.right_add),
        left_sphere: prescription.left_sphere === '' ? 0 : Number(prescription.left_sphere),
        left_cylinder: prescription.left_cylinder === '' ? 0 : Number(prescription.left_cylinder),
        left_axis: prescription.left_axis === '' ? 0 : Number(prescription.left_axis),
        left_add: prescription.left_add === '' ? 0 : Number(prescription.left_add),
        ipd: prescription.ipd === '' ? 0 : Number(prescription.ipd),
      }

      if (customerName.trim() && !isWalkIn) {
        if (selectedCustomerId) {
          // Update existing customer with latest prescription
          updateCustomerMutation.mutate({
            id: selectedCustomerId,
            updates: {
              name: customerName,
              phone: customerPhone || null,
              eye_type: prescription.eye_type || null,
              lens_type: prescription.lens_type || null,
              ...rx,
            },
          })
        } else {
          // Create new customer
          const newCust = await createCustomerMutation.mutateAsync({
            name: customerName,
            phone: customerPhone || null,
            eye_type: prescription.eye_type || null,
            lens_type: prescription.lens_type || null,
            ...rx,
          })
          finalCustomerId = (newCust as any)?.id
        }
      }

      const invoiceNumber = await generateNextNumber('IN')

      const invoicePayload = {
        invoice: {
          invoice_number: invoiceNumber,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          customer_id: finalCustomerId || null,
          ...rx,
          eye_type: prescription.eye_type || null,
          lens_type: prescription.lens_type || null,
          subtotal,
          discount,
          total_amount: total,
          amount_paid: paymentStatus === 'paid' ? total : paymentStatus === 'partial' ? Math.min(amountPaid, total) : 0,
          balance_due: paymentStatus === 'paid' ? 0 : paymentStatus === 'partial' ? Math.max(0, total - amountPaid) : total,
          payment_status: paymentStatus,
          payment_method: paymentMethod as 'cash' | 'card' | 'transfer',
          invoice_type: 'pos',
          created_by: userId || '00000000-0000-0000-0000-000000000000',
        },
        items: cart.map((item) => ({
          description: item.name,
          quantity: item.cartQuantity,
          unit_price: item.price,
          total_price: item.price * item.cartQuantity,
        })),
      }

      const result = await createInvoiceMutation.mutateAsync(invoicePayload)
      const invoiceId = (result as any)?.id || ''

      // Print thermal receipt
      printReceipt(invoiceNumber, invoiceId)

      toast.success(customerName ? `Sale completed for ${customerName}` : 'Sale completed!')
      clearCart()
      clearCustomer()
    } catch (e: any) {
      if (e?.message?.includes('not configured')) {
        toast.error('Supabase not configured. Demo mode.')
      } else {
        toast.error('Failed to save: ' + (e?.message || ''))
      }
    }
  }

  // ─── Thermal receipt print ───
  const printReceipt = (invoiceNumber: string, invoiceId: string) => {
    const win = window.open('', '', 'width=300,height=600')
    if (!win) return

    const date = new Date().toLocaleString()
    const qrUrl = `https://safwanoptical-view.vercel.app/view.html?id=${invoiceId}`
    const rxText = prescription.right_sphere !== '' || prescription.left_sphere !== ''
      ? `R: ${prescription.right_sphere || 0}/${prescription.right_cylinder || 0}x${prescription.right_axis || 0} ADD ${prescription.right_add || 0}<br>
      L: ${prescription.left_sphere || 0}/${prescription.left_cylinder || 0}x${prescription.left_axis || 0} ADD ${prescription.left_add || 0}<br>
      IPD: ${prescription.ipd || 0}` : ''

    win.document.write(`<!DOCTYPE html><html><head><title>Print</title><style>
      @page { size: 80mm auto; margin: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 13px; width: 80mm; margin: 0; padding: 3mm; color: #000; }
      .header { text-align: center; margin-bottom: 4mm; border-bottom: 1px dashed #000; padding-bottom: 2mm; }
      .header h2 { margin: 0; font-size: 14px; }
      .header .ar { direction: rtl; }
      .divider { border-top: 1px dashed #000; margin: 3mm 0; }
      .section-title { text-align: center; font-weight: bold; font-size: 12px; margin: 3mm 0 1mm; }
      table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 12px; }
      table th { padding: 2px; text-align: left; border-bottom: 1px solid #000; font-size: 11px; }
      table td { padding: 2px; font-size: 11px; }
      .rx-table { border: 1px solid #000; margin: 2mm 0; }
      .rx-table th { background: #e0e0e0; text-align: center; padding: 2px; font-size: 10px; border: 1px solid #000; }
      .rx-table td { text-align: center; padding: 2px; font-size: 10px; border: 1px solid #000; }
      .rx-table .eye-label { font-weight: bold; background: #e0e0e0; }
      .totals { text-align: right; font-size: 12px; }
      .totals div { margin-bottom: 1mm; }
      .qrcode { text-align: center; margin: 3mm 0; }
      .qrcode img { width: 30mm; height: 30mm; }
      .footer { text-align: center; font-size: 11px; margin-top: 3mm; }
    </style></head><body>
      <div class="header">
        <h2>Safwan OPTICALS</h2>
        <div>Abdur Rahman Ibn Ahmed As Sidayri, As Salamah, Jeddah 23436</div>
        <div class="ar">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
      </div>
      <div style="text-align:center;font-size:11px;margin:2mm 0">VAT No: 310158981300003</div>
      <div style="text-align:center;font-weight:bold;font-size:13px">Invoice No: ${invoiceNumber}</div>
      <div style="text-align:center;font-size:11px">Date: ${date}</div>
      <div class="divider"></div>

      ${customerName ? `
      <div class="section-title">CUSTOMER INFO</div>
      <table>
        <tr><td style="font-weight:bold;width:30%">Name:</td><td>${customerName}</td></tr>
        <tr><td style="font-weight:bold">Mobile:</td><td>${customerPhone || ''}</td></tr>
      </table>
      <div class="divider"></div>` : ''}

      <table>
        <thead><tr>
          <th>Product / المنتج</th>
          <th style="text-align:center">Qty / الكمية</th>
          <th style="text-align:right">Price / السعر</th>
        </tr></thead>
        <tbody>
          ${cart.map((item) => `
            <tr>
              <td>${item.name}</td>
              <td style="text-align:center">${item.cartQuantity}</td>
              <td style="text-align:right">${formatCurrency(item.price * item.cartQuantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="divider"></div>

      <div class="totals">
        <div>Subtotal: ${formatCurrency(subtotal)}</div>
        ${discount > 0 ? `<div>Discount: -${formatCurrency(discount)}</div>` : ''}
        <div><b>Total: ${formatCurrency(total)}</b><br><span style="font-size:10px">(incl. all vat and taxes)</span></div>
      </div>
      <div class="divider"></div>

      <table>
        <tr><td style="font-weight:bold;width:35%">Payment Method:</td><td>${paymentMethod}</td></tr>
        <tr><td style="font-weight:bold">Payment Status:</td><td>${paymentStatus.toUpperCase()}</td></tr>
        <tr><td style="font-weight:bold">Paid Amount:</td><td>${formatCurrency(paymentStatus === 'paid' ? total : amountPaid)}</td></tr>
        ${balanceDue > 0 ? `<tr><td style="font-weight:bold">Due Amount:</td><td>${formatCurrency(balanceDue)}</td></tr>` : ''}
      </table>
      <div class="divider"></div>

      ${(prescription.right_sphere !== '' || prescription.left_sphere !== '') ? `
      <div class="section-title">EYE PRESCRIPTION</div>
      <table class="rx-table">
        <thead><tr>
          <th>EYE</th><th>S.P.H</th><th>C.Y.L</th><th>AXIS</th><th>ADD</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="eye-label">Right (OD)</td>
            <td>${prescription.right_sphere || 0}</td><td>${prescription.right_cylinder || 0}</td>
            <td>${prescription.right_axis || 0}</td><td>${prescription.right_add || 0}</td>
          </tr>
          <tr>
            <td class="eye-label">Left (OS)</td>
            <td>${prescription.left_sphere || 0}</td><td>${prescription.left_cylinder || 0}</td>
            <td>${prescription.left_axis || 0}</td><td>${prescription.left_add || 0}</td>
          </tr>
          ${prescription.ipd && prescription.ipd !== '' ? `
          <tr><td class="eye-label" colspan="2">IPD</td><td colspan="3">${prescription.ipd}mm</td></tr>` : ''}
        </tbody>
      </table>
      <div class="divider"></div>` : ''}

      <div class="qrcode" id="pos-qr"></div>

      <div class="footer">
        <p>Thank you for shopping with us!</p>
        <p dir="rtl">شكراً لتسوقك معنا!</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('pos-qr'), {
            text: '${qrUrl}',
            width: 100, height: 100,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.M
          });
          setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 300);
        }, 200);
      </script>
    </body></html>`)
    win.document.close()
  }

  // ─── Render ───
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pos.title')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Products */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-t-2 border-t-blue-500 shadow-sm">
            <CardHeader className="pb-3 bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/30 dark:to-transparent rounded-t-xl">
              <div className="flex gap-2">
                <form onSubmit={handleBarcodeSubmit} className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Scan className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barcodeRef}
                      placeholder="Scan barcode or type..."
                      className="pl-9"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                    />
                  </div>
                  <Button type="submit">Add</Button>
                </form>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products by name..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 max-h-[500px] overflow-y-auto">
                {displayProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer transition-all active:scale-[0.99]"
                    onClick={() => addToCart(product)}
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.barcode} | Stock: {product.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(product.price)}</p>
                    </div>
                  </div>
                ))}
                {displayProducts.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No products</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Cart + Customer + Payment */}
        <div className="space-y-4">
          {/* ─── CUSTOMER SEARCH & PRESCRIPTION ─── */}
          <Card className="overflow-visible border-t-2 border-t-emerald-500 shadow-sm">
            <CardHeader className="pb-2 bg-gradient-to-b from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent rounded-t-xl">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" /> Customer
                {isWalkIn && (
                  <Badge className="ml-auto text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-300">Walk-in</Badge>
                )}
                {selectedCustomerId && (
                  <Badge className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-300">Member</Badge>
                )}
                {!selectedCustomerId && customerName && (
                  <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300">New</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 overflow-visible">
              {/* Customer search */}
              <div className="relative" ref={customerSearchRef}>
                <Input
                  placeholder="Search or press Enter x4 for walk-in"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true) }}
                  onFocus={() => { if (customerSearch.length >= 2) setShowCustomerResults(true) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customerSearch.trim()) {
                      e.preventDefault()
                      enterCountRef.current += 1
                      if (enterCountRef.current >= 4) {
                        setAsWalkIn()
                        enterCountRef.current = 0
                      }
                      setTimeout(() => { enterCountRef.current = 0 }, 1500)
                    }
                  }}
                />

                {/* Dropdown results */}
                {showCustomerResults && customerSearch.length >= 2 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchingCustomers ? (
                      <p className="p-2 text-sm text-muted-foreground">Searching...</p>
                    ) : customerResults.length > 0 ? (
                      customerResults.map((c: any) => (
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
                            <Badge variant="outline" className="text-[10px]">Rx</Badge>
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-transparent border border-emerald-200 dark:border-emerald-800">
                      <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-1.5">
                        <User className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{customerName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Input
                            placeholder="Phone number"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="h-7 text-xs flex-1 max-w-[140px]"
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-red-50 hover:text-red-500" onClick={clearCustomer}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Prescription toggle */}
              {customerName && (
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    showPrescription
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-muted/60 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20'
                  }`}
                  onClick={() => setShowPrescription(!showPrescription)}
                >
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Prescription & Measurements
                  </span>
                  {showPrescription ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Prescription form */}
              {showPrescription && (
                <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-3 bg-emerald-50/30 dark:bg-emerald-950/10">
                  {/* Eye type / Lens type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Eye Type</span>
                      <Select value={prescription.eye_type || undefined} onValueChange={(v) => v && setPrescription((prev) => ({ ...prev, eye_type: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single Vision">Single Vision</SelectItem>
                          <SelectItem value="Bifocal">Bifocal</SelectItem>
                          <SelectItem value="Progressive">Progressive</SelectItem>
                          <SelectItem value="Office Lens">Office Lens</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Lens Type</span>
                      <Select value={prescription.lens_type || undefined} onValueChange={(v) => v && setPrescription((prev) => ({ ...prev, lens_type: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
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

                  {/* Prescription grid */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Rx Values</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-[10px] font-medium text-muted-foreground">
                    <span></span>
                    <span className="text-center">SPH</span>
                    <span className="text-center">CYL</span>
                    <span className="text-center">AXIS</span>
                    <span className="text-center">ADD</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 items-center p-1.5 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">OD</span>
                    <Input className="h-7 text-xs border-blue-200 dark:border-blue-800" placeholder="0" type="number" step="0.25"
                      value={prescription.right_sphere} onChange={(e) => updateRx('right_sphere', e.target.value)} />
                    <Input className="h-7 text-xs border-blue-200 dark:border-blue-800" placeholder="0" type="number" step="0.25"
                      value={prescription.right_cylinder} onChange={(e) => updateRx('right_cylinder', e.target.value)} />
                    <Input className="h-7 text-xs border-blue-200 dark:border-blue-800" placeholder="0" type="number"
                      value={prescription.right_axis} onChange={(e) => updateRx('right_axis', e.target.value)} />
                    <Input className="h-7 text-xs border-blue-200 dark:border-blue-800" placeholder="0" type="number" step="0.25"
                      value={prescription.right_add} onChange={(e) => updateRx('right_add', e.target.value)} />
                  </div>

                  <div className="grid grid-cols-5 gap-1 items-center p-1.5 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">OS</span>
                    <Input className="h-7 text-xs border-amber-200 dark:border-amber-800" placeholder="0" type="number" step="0.25"
                      value={prescription.left_sphere} onChange={(e) => updateRx('left_sphere', e.target.value)} />
                    <Input className="h-7 text-xs border-amber-200 dark:border-amber-800" placeholder="0" type="number" step="0.25"
                      value={prescription.left_cylinder} onChange={(e) => updateRx('left_cylinder', e.target.value)} />
                    <Input className="h-7 text-xs border-amber-200 dark:border-amber-800" placeholder="0" type="number"
                      value={prescription.left_axis} onChange={(e) => updateRx('left_axis', e.target.value)} />
                    <Input className="h-7 text-xs border-amber-200 dark:border-amber-800" placeholder="0" type="number" step="0.25"
                      value={prescription.left_add} onChange={(e) => updateRx('left_add', e.target.value)} />
                  </div>

                  <div className="pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">IPD</span>
                      <Input className="h-8 w-20 text-xs" placeholder="mm" type="number" step="0.5"
                        value={prescription.ipd} onChange={(e) => updateRx('ipd', e.target.value)} />
                      <span className="text-[10px] text-muted-foreground">mm</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── CART ─── */}
          <Card className="border-t-2 border-t-orange-500 shadow-sm">
            <CardHeader className="pb-3 bg-gradient-to-b from-orange-50/80 to-transparent dark:from-orange-950/30 dark:to-transparent rounded-t-xl">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <ShoppingCart className="h-5 w-5 text-orange-600" />
                Cart ({getItemCount()})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Cart is empty</p>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b pb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Button variant="outline" size="icon" className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.cartQuantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.cartQuantity}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.cartQuantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-sm">{formatCurrency(item.price * item.cartQuantity)}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => removeFromCart(item.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment */}
              <div className="space-y-2 pt-1 border-t">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={paymentStatus} onValueChange={(v) => v && setPaymentStatus(v as typeof paymentStatus)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Paid amount input for partial */}
                {paymentStatus === 'partial' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Paid</Label>
                    <Input type="number" className="h-7 w-24"
                      value={amountPaid || ''}
                      onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground">SAR</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex items-center gap-1">
                    <Input type="number" className="w-20 h-7 text-right"
                      value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
                    <span>SAR</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(total)}</span>
                </div>
                {paymentStatus !== 'paid' && (
                  <div className="flex justify-between text-destructive">
                    <span>Balance Due</span>
                    <span>{formatCurrency(balanceDue)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" size="lg"
                  onClick={handleComplete}
                  disabled={cart.length === 0 || !customerName.trim() || createInvoiceMutation.isPending}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {!customerName.trim() ? 'Select a Customer' : 'Complete Sale'}
                </Button>
                <Button variant="outline" size="lg" onClick={clearCart} disabled={cart.length === 0}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
