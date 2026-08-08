'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Save, User, Search, X, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useSearchCustomers, useCreateInvoice } from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'
import { generateNextNumber } from '@/lib/supabase/data'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'

const PUBLIC_URL = 'https://safwanoptical-view.vercel.app'

export default function NewReceiptPage() {
  const router = useRouter()
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])
  const [userId, setUserId] = useState<string | null>(null)
  const { t } = useLang()

  const [customerSearch, setCustomerSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [chequeNo, setChequeNo] = useState('')
  const [purpose, setPurpose] = useState('')
  const [payMethod, setPayMethod] = useState('cash')

  const { data: customers = [] } = useSearchCustomers(customerSearch)
  const createInvoiceMutation = useCreateInvoice()

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCustomer = (cust: any) => {
    setSelectedCustomer(cust)
    setCustomerSearch(cust.name)
    setShowResults(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      toast.error('Please search and select a customer first')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const totalAmount = Number(amount)
    const invoiceNumber = await generateNextNumber('RE')

    try {
      await createInvoiceMutation.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber,
          customer_name: selectedCustomer.name,
          customer_phone: selectedCustomer.phone || null,
          customer_id: selectedCustomer.id,
          subtotal: totalAmount,
          discount: 0,
          total_amount: totalAmount,
          amount_paid: totalAmount,
          balance_due: 0,
          payment_status: 'paid',
          payment_method: payMethod,
          invoice_type: 'receipt',
          notes: purpose || null,
          created_by: userId || '00000000-0000-0000-0000-000000000000',
        },
        items: [{
          description: `Receipt Voucher - ${bank ? `Bank: ${bank}` : 'Cash'}${chequeNo ? ` - Cheque: ${chequeNo}` : ''}`,
          quantity: 1,
          unit_price: totalAmount,
          total_price: totalAmount,
        }],
      })

      // Print receipt
      printReceipt(invoiceNumber, selectedCustomer, totalAmount, bank, chequeNo, purpose, payMethod)

      toast.success('Receipt created!')
      router.push('/receipts')
    } catch (e: any) {
      toast.error('Failed to save: ' + (e?.message || ''))
    }
  }

  const printReceipt = (invNum: string, cust: any, amt: number, bankName: string, chqNo: string, purp: string, method: string) => {
    const win = window.open('', '', 'width=400,height=700')
    if (!win) return
    const date = new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })

    win.document.write(`<!DOCTYPE html><html><head><title>Receipt Voucher</title><style>
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; margin: 0; padding: 2mm; font-size: 12px; font-family: Arial, sans-serif; color: #000; }
      .header { text-align: center; margin-bottom: 3mm; }
      .header .en { font-weight: bold; font-size: 13px; }
      .header .ar { direction: rtl; font-size: 11px; margin-top: 1mm; }
      .divider { border-top: 1px solid #000; margin: 2mm 0; }
      .title { text-align: center; font-weight: bold; margin: 2mm 0; font-size: 13px; text-decoration: underline; }
      .dashed { border-top: 1px dashed #000; margin: 2mm 0; }
      .info-table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
      .info-table td { padding: 1mm 0; font-size: 11px; }
      .info-table .label { font-weight: bold; width: 40%; }
      .highlight { margin: 2mm 0; padding: 2mm; border-left: 3px solid #000; background: #f5f5f5; }
      .highlight .lbl { font-size: 10px; color: #555; }
      .highlight .val { font-weight: bold; font-size: 12px; }
      .signatures { display: flex; justify-content: space-between; margin-top: 5mm; }
      .sig-box { text-align: center; width: 45%; }
      .sig-line { border-top: 1px solid #000; margin: 15mm 0 3mm; }
      .footer { margin-top: 3mm; text-align: center; font-size: 9px; border-top: 1px solid #000; padding-top: 1mm; }
      .qr { text-align: center; margin: 3mm 0; }
      .qr img { width: 25mm; height: 25mm; }
    </style></head><body>
      <div class="header">
        <div class="en">Safwan OPTICALS</div>
        <div>Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436</div>
        <div class="ar">صفوان للبصريات - عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
      </div>
      <div style="text-align:center;font-size:10px">VAT NO: 310158981300003</div>
      <div class="divider"></div>
      <div class="title">Receipt Voucher / سند قبض</div>
      <table class="info-table">
        <tr><td class="label">Date / التاريخ</td><td>:</td><td>${date}</td></tr>
        <tr><td class="label">Receipt No / الرقم</td><td>:</td><td>${invNum}</td></tr>
      </table>
      <div class="dashed"></div>
      <div class="highlight">
        <div class="lbl">Received From / مستلم من</div>
        <div class="val">${cust.name}</div>
      </div>
      <div class="highlight">
        <div class="lbl">Amount in Figures (SAR) / المبلغ بالأرقام</div>
        <div class="val">${amt.toFixed(2)}</div>
      </div>
      <div class="highlight">
        <div class="lbl">Amount in Words / المبلغ بالكلمات</div>
        <div class="val">${numberToWords(Math.floor(amt))}</div>
      </div>
      <div class="dashed"></div>
      <table class="info-table">
        <tr><td class="label">The Bank / البنك</td><td>:</td><td>${bankName || '-'}</td></tr>
        <tr><td class="label">Date / التاريخ</td><td>:</td><td>${paymentDate}</td></tr>
        <tr><td class="label">Cash / Cheque No / رقم الشيك</td><td>:</td><td>${chqNo || '-'}</td></tr>
        <tr><td class="label">For / لصالح</td><td>:</td><td>${purp || '-'}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig-box"><div class="sig-line"></div><div>Manager / المدير</div></div>
        <div class="sig-box"><div class="sig-line"></div><div>Accountant / المحاسب</div></div>
      </div>
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div>Received By / المستلم</div>
          <div style="margin-top:3px;font-size:11px">${cust.name}</div>
        </div>
        <div class="sig-box"><div class="sig-line"></div><div>Signature / التوقيع</div></div>
      </div>
      <div class="footer">
        <div>Kingdom of Saudi Arabia - Jeddah 23436 | 310158981300003</div>
        <div>Tel: +966 05 0918 3807</div>
      </div>
      <div class="qr" id="rec-qr"></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('rec-qr'), {
            text: '${PUBLIC_URL}/view.html?id=${invNum}',
            width: 150, height: 150,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.M
          });
          setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 300);
        }, 200);
      </script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('receipts.newReceiptVoucher')}</h1>
        <p className="text-muted-foreground">{t('receipts.newReceiptDesc')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" /> Customer Lookup
              {selectedCustomer && <Badge variant="secondary" className="ml-auto text-xs">Selected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative" ref={searchRef}>
              <Label>Search Customer (name or phone)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Type name or phone to search..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setShowResults(true)
                  }}
                  onFocus={() => { if (customerSearch.length >= 2) setShowResults(true) }}
                />
              </div>

              {showResults && customerSearch.length >= 2 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customers.length > 0 ? (
                    customers.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer text-sm border-b last:border-0"
                        onClick={() => selectCustomer(c)}
                      >
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone || 'No phone'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-center text-muted-foreground">
                      <p className="font-medium text-destructive">Customer not found</p>
                      <p className="text-xs mt-1">
                        Please create the customer first or process a sale from the POS page.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && !showResults && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded-lg">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    {selectedCustomer.phone && <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCustomer} type="button">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (SAR)</Label>
                <Input
                  type="number" step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={(v) => v && setPayMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input placeholder="Optional" value={bank} onChange={(e) => setBank(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cheque No</Label>
                <Input placeholder="Optional" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Purpose / For</Label>
                <Input placeholder="Optional" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {amount ? (
                <span>Amount in words: <strong>{numberToWords(Math.floor(Number(amount)))}</strong> Saudi Riyals</span>
              ) : (
                <span>Enter amount to see amount in words</span>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" size="lg" disabled={!selectedCustomer || createInvoiceMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {!selectedCustomer ? 'Search a customer first' : 'Create Receipt'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => router.push('/receipts')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
