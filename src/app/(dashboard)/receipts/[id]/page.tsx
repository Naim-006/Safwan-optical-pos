'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useInvoice, useInvoiceItems, useShopSettings } from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'
import { generateA4Html, shopHeaderReceipt, type ShopInfo } from '@/lib/shop-template'

const PUBLIC_URL = 'https://safwanoptical-view.vercel.app'

export default function ReceiptViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: receipt, isLoading } = useInvoice(id)
  const { data: items = [] } = useInvoiceItems(id)
  const { data: shop } = useShopSettings()

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>

  if (!receipt) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Receipt not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/receipts')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    )
  }

  const rec = receipt as any
  const date = new Date(rec.created_at).toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })
  const qrUrl = `${PUBLIC_URL}/view.html?id=${id}`
  const barcodeNum = rec.invoice_number?.split('-').pop() || ''

  // ─── Thermal 80mm Print ───
  const handlePrint = () => {
    const win = window.open('', '', 'width=400,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
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
      ${shopHeaderReceipt(shop)}
      <div class="title">Receipt Voucher / سند قبض</div>
      <table class="info-table"><tr><td class="label">Date / التاريخ</td><td>:</td><td>${date}</td></tr><tr><td class="label">Receipt No / الرقم</td><td>:</td><td>${rec.invoice_number}</td></tr></table>
      <div class="dashed"></div>
      <div class="highlight"><div class="lbl">Received From / مستلم من</div><div class="val">${rec.customer_name || 'Walk-in'}</div></div>
      <div class="highlight"><div class="lbl">Amount (SAR) / المبلغ</div><div class="val">${Number(rec.total_amount || 0).toFixed(2)}</div></div>
      <div class="dashed"></div>
      <table class="info-table"><tr><td class="label">Payment / الدفع</td><td>:</td><td>${(rec.payment_method || '').toUpperCase()} - ${(rec.payment_status || '').toUpperCase()}</td></tr>${rec.notes ? `<tr><td class="label">Notes</td><td>:</td><td>${rec.notes}</td></tr>` : ''}</table>
      <div class="signatures"><div class="sig-box"><div class="sig-line"></div><div>Manager</div></div><div class="sig-box"><div class="sig-line"></div><div>Accountant</div></div></div>
      <div class="signatures"><div class="sig-box"><div class="sig-line"></div><div>Received By</div><div style="margin-top:3px;font-size:11px">${rec.customer_name || ''}</div></div><div class="sig-box"><div class="sig-line"></div><div>Signature</div></div></div>
      <div class="footer"><div>KSA - Jeddah 23436 | ${shop?.vat || '300833099900003'}</div><div>Tel: ${shop?.phone || '+966 05 0918 3807'}</div></div>
      <div class="qr" id="rec-qr-view"></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>setTimeout(function(){new QRCode(document.getElementById('rec-qr-view'),{text:'${qrUrl}',width:100,height:100,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},300);},200);</script>
    </body></html>`)
    win.document.close()
  }

  // ─── Unified A4 (Print + PDF) ───
  const renderA4 = (download: boolean) => {
    const win = window.open('', '', 'width=800,height=900')
    if (!win) return
    const s = shop as any

    const metaHtml = `<table class="info-table"><tr><td class="lbl">Date / التاريخ</td><td>${date}</td></tr><tr><td class="lbl">Receipt No / الرقم</td><td>${rec.invoice_number}</td></tr></table>`

    const extraHtml = `<div class="highlight"><div class="hlbl">Received From / مستلم من</div><div class="hval">${rec.customer_name || 'Walk-in Customer'}</div></div><div class="highlight blue"><div class="hlbl">Amount in Figures (SAR) / المبلغ بالأرقام</div><div class="hval" style="color:#2563eb">${Number(rec.total_amount || 0).toFixed(2)}</div></div><div class="highlight purple"><div class="hlbl">Amount in Words / المبلغ بالكلمات</div><div class="hval" style="font-size:10pt">${numberToWords(Math.floor(rec.total_amount || 0))} Saudi Riyals</div></div><table class="info-table" style="margin-top:3mm"><tr><td class="lbl">Payment Method / طريقة الدفع</td><td>${(rec.payment_method || '').toUpperCase()}</td></tr><tr><td class="lbl">Payment Status / حالة الدفع</td><td>${(rec.payment_status || '').toUpperCase()}</td></tr>${rec.notes ? `<tr><td class="lbl">Notes / ملاحظات</td><td>${rec.notes}</td></tr>` : ''}</table>`

    const footerHtml = `<div class="signatures"><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Manager / المدير</div></div><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Accountant / المحاسب</div></div></div><div class="signatures" style="margin-top:0"><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Received By / المستلم</div><div style="font-size:9pt;font-weight:600;margin-top:1mm">${rec.customer_name || ''}</div></div><div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Signature / التوقيع</div></div></div><div class="fnote">Kingdom of Saudi Arabia — Jeddah 23436 | ${s?.vat || '300833099900003'} | Tel: ${s?.phone || '+966 05 0918 3807'}</div>`

    const totalsHtml = `<div class="totals"><div class="tr grand"><span>Amount / المبلغ</span><span>${formatCurrency(rec.total_amount)}</span></div></div>`

    const qrHtml = `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script><script>setTimeout(function(){var q=document.getElementById('a4-qr');q.style.width='42mm';q.style.height='42mm';new QRCode(q,{text:'${qrUrl}',width:320,height:320,colorDark:'#1a1a2e',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});setTimeout(function(){
      ${download ? `
      var tries=0;
      var iv=setInterval(function(){
        if(typeof html2canvas!=='undefined' && typeof jspdf!=='undefined'){
          clearInterval(iv);
          var el=document.querySelector('.page');
          var w=el.offsetWidth, h=el.offsetHeight;
          html2canvas(el,{scale:2,useCORS:true,scrollX:0,scrollY:0,width:w,height:h,windowWidth:w,logging:false}).then(function(canvas){
            var pdf=new jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
            pdf.addImage(canvas.toDataURL('image/jpeg',0.98),'JPEG',0,0,210,297);
            pdf.save('Receipt_${rec.invoice_number}.pdf');
            setTimeout(function(){window.close()},500);
          });
        } else if(++tries>80){ clearInterval(iv); window.close(); }
      },100);`
      : `window.print();setTimeout(function(){window.close()},500);`
    }},400);},200);<\/script>`

    const a4Html = generateA4Html({
      shop: s, type: 'receipt', title: 'RECEIPT VOUCHER / سند قبض',
      metaHtml, extraHtml, itemsHtml: '',
      totalsHtml,
      wordsHtml: '', qrHtml, footerHtml, barcodeNum,
      dateTime: new Date().toLocaleString('en-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
    })

    let html = a4Html
    if (download) html = html.replace('</body>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script></body>')
    win.document.write(html)
    win.document.close()
    if (download) toast.success('PDF downloading...')
  }

  const handlePDF = async () => {
    // Use original method for both desktop and mobile to avoid color parsing issues
    renderA4(true)
  }

  const handlePrintA4 = () => renderA4(false)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => router.push('/receipts')}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex flex-1 sm:flex-none" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Thermal Print</Button>
          <Button variant="outline" size="sm" className="hidden sm:flex flex-1 sm:flex-none" onClick={handlePrintA4}><Printer className="h-4 w-4 mr-2" /> Print A4</Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handlePDF}><Download className="h-4 w-4 mr-2" /> PDF (A4)</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div><CardTitle className="text-xl">Receipt #{rec.invoice_number}</CardTitle><p className="text-sm text-muted-foreground">{date}</p></div>
            <Badge variant={rec.payment_status === 'paid' ? 'default' : 'destructive'}>{rec.payment_status?.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{rec.customer_name || 'Walk-in'}</p></div>
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{rec.customer_phone || '-'}</p></div>
          </div>
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount (SAR)</span><span className="text-xl font-bold text-blue-600">{formatCurrency(rec.total_amount)}</span></div>
            <div className="text-sm text-muted-foreground italic">{numberToWords(Math.floor(rec.total_amount || 0))} Saudi Riyals</div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Payment Method</p><p className="font-medium">{rec.payment_method || '-'}</p></div>
            <div><p className="text-muted-foreground">Payment Status</p><Badge variant={rec.payment_status === 'paid' ? 'default' : 'destructive'}>{rec.payment_status}</Badge></div>
          </div>
          {rec.notes && <div className="border-t pt-3"><p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {rec.notes}</p></div>}
        </CardContent>
      </Card>
    </div>
  )
}
