'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useInvoice, useInvoiceItems, useShopSettings } from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'
import { generateA4Html, invoiceTotalsHtml, shopHeaderHtml, type ShopInfo } from '@/lib/shop-template'
import { openPrintDoc, isTauri } from '@/lib/native'

const PUBLIC_URL = 'https://safwanoptical-view.vercel.app'
const SITE_URL = PUBLIC_URL

export default function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: invoice, isLoading } = useInvoice(id)
  const { data: items = [] } = useInvoiceItems(id)
  const { data: shop } = useShopSettings()

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    )
  }

  const inv = invoice as any
  const date = new Date(inv.created_at).toLocaleDateString('en-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const qrUrl = `${PUBLIC_URL}/view.html?id=${id}`

  // ─── Thermal 80mm Print ───
  const handlePrint = () => {
    const win = window.open('', '', 'width=400,height=700')
    if (!win) return

    win.document.write(`<!DOCTYPE html><html><head><title>Print</title><style>
      @page { size: 80mm auto; margin: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; width: 80mm; margin: 0; padding: 5mm; color: #000; line-height: 1.2; }
      .header { text-align: center; margin-bottom: 5mm; border-bottom: 1px dashed #000; padding-bottom: 3mm; }
      .header h2 { margin: 0; font-size: 14px; font-weight: bold; }
      .header .ar { direction: rtl; }
      .title { font-weight: bold; font-size: 14px; text-align: center; margin: 2mm 0; }
      .section { margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1px solid #000; }
      .section-title { font-weight: bold; text-align: center; margin-bottom: 1mm; }
      .row { display: flex; margin-bottom: 1mm; }
      .label { font-weight: bold; min-width: 30mm; }
      table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
      table th { text-align: left; border-bottom: 1px solid #000; padding: 1mm 0; font-size: 10px; }
      table td { padding: 1mm 0; border-bottom: 1px dashed #ccc; font-size: 10px; }
      .right { text-align: right; }
      .totals { text-align: right; margin-top: 3mm; }
      .totals div { margin-bottom: 1mm; }
      .rx-table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
      .rx-table th { background: #f0f0f0; text-align: center; padding: 1mm; font-size: 10px; border: 1px solid #000; }
      .rx-table td { padding: 1mm; text-align: center; border: 1px solid #000; font-size: 10px; }
      .rx-table .eye { font-weight: bold; background: #f0f0f0; }
      .footer { text-align: center; margin-top: 3mm; font-size: 10px; }
      .qrcode { text-align: center; margin: 5mm auto; }
      .qrcode img { width: 40mm; height: 40mm; }
    </style></head><body>
      <div class="header">${shopHeaderHtml(shop)}</div>
      <div class="title">INVOICE</div>

      <div class="section">
        <div class="row"><span class="label">Invoice Date:</span><span>${date}</span></div>
        <div class="row"><span class="label">Invoice #:</span><span>${inv.invoice_number}</span></div>
      </div>

      ${inv.customer_name ? `
      <div class="section">
        <div class="section-title">CUSTOMER DETAILS</div>
        <div class="row"><span class="label">Name:</span><span>${inv.customer_name}</span></div>
        ${inv.customer_phone ? `<div class="row"><span class="label">Phone:</span><span>${inv.customer_phone}</span></div>` : ''}
        ${inv.customer_address ? `<div class="row"><span class="label">Address:</span><span>${inv.customer_address}</span></div>` : ''}
      </div>` : ''}

      ${(inv.eye_type || inv.lens_type || inv.right_sphere) ? `
      <div class="section">
        <div class="section-title">OPTICAL MEASUREMENTS</div>
        ${inv.eye_type ? `<div class="row"><span class="label">Eye Type:</span><span>${inv.eye_type}</span></div>` : ''}
        ${inv.lens_type ? `<div class="row"><span class="label">Lens Type:</span><span>${inv.lens_type}</span></div>` : ''}
        ${inv.right_sphere != null ? `
        <table class="rx-table">
          <thead><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr></thead>
          <tbody>
            <tr><td class="eye">RIGHT (OD)</td><td>${inv.right_sphere}</td><td>${inv.right_cylinder}</td><td>${inv.right_axis}</td><td>${inv.right_add}</td></tr>
            <tr><td class="eye">LEFT (OS)</td><td>${inv.left_sphere}</td><td>${inv.left_cylinder}</td><td>${inv.left_axis}</td><td>${inv.left_add}</td></tr>
          </tbody>
        </table>` : ''}
        ${inv.ipd ? `<div class="row"><span class="label">IPD:</span><span>${inv.ipd} mm</span></div>` : ''}
      </div>` : ''}

      <div class="section">
        <div class="section-title">ITEMS</div>
        <table>
          <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${items.map((i: any) => `
              <tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td class="right">${formatCurrency(i.unit_price)}</td><td class="right">${formatCurrency(i.total_price)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="totals">
        <div><span class="label">Subtotal:</span> ${formatCurrency(inv.subtotal)}</div>
        ${Number(inv.discount) > 0 ? `<div><span class="label">Discount:</span> -${formatCurrency(inv.discount)}</div>` : ''}
        <div style="font-weight:bold"><span class="label">Total:</span> ${formatCurrency(inv.total_amount)}</div>
        <div style="font-size:10px;text-align:left">${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>
        ${Number(inv.amount_paid) > 0 ? `<div><span class="label">Paid:</span> ${formatCurrency(inv.amount_paid)}</div>` : ''}
        ${Number(inv.balance_due) > 0 ? `<div style="font-weight:bold"><span class="label">Balance Due:</span> ${formatCurrency(inv.balance_due)}</div>` : ''}
      </div>

      <div class="qrcode" id="inv-qr"></div>

      <div class="footer">
        <div>Thank you for shopping with us!</div>
        <div>شكراً لتسوقك معنا!</div>
        <div>Tel: ${shop?.phone || '+966 05 0918 3807'}</div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('inv-qr'), {
            text: '${qrUrl}',
            width: 120, height: 120,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.M
          });
          setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 300);
        }, 200);
      </script>
    </body></html>`)
    win.document.close()
  }

  // ─── A4 PDF Download ───
  const handlePDF = async () => {
    toast.loading('Generating PDF...')
    
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = await import('html2canvas')
      
      // Create a hidden container with the invoice content
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '210mm'
      container.style.background = 'white'
      container.style.padding = '10mm'
      document.body.appendChild(container)
      
      const s = shop as ShopInfo
      const isOptical = inv.right_sphere != null || inv.eye_type

      const metaHtml = `<div class="meta">
        <div class="col"><b>Invoice #</b> ${inv.invoice_number}<br><b>Customer</b> ${inv.customer_name || 'Walk-in'}<br>${inv.customer_phone ? `<b>Phone</b> ${inv.customer_phone}` : ''}</div>
        <div class="col" style="text-align:right"><b>Date</b> ${date}<br><b>Status</b> <span style="color:${inv.payment_status==='paid'?'#16a34a':'#dc2626'};font-weight:700">${(inv.payment_status||'').toUpperCase()}</span><br>${inv.payment_method ? `<b>Method</b> ${inv.payment_method.toUpperCase()}` : ''}</div>
      </div>`

      const extraHtml = isOptical ? `
        <div class="rx-grid">
          <div class="rx-box od"><h4>RIGHT (OD)</h4>
            <table><tr><td>SPH</td><td>${inv.right_sphere??'-'}</td></tr><tr><td>CYL</td><td>${inv.right_cylinder??'-'}</td></tr><tr><td>AXIS</td><td>${inv.right_axis??'-'}</td></tr><tr><td>ADD</td><td>${inv.right_add??'-'}</td></tr></table>
          </div>
          <div class="rx-box os"><h4>LEFT (OS)</h4>
            <table><tr><td>SPH</td><td>${inv.left_sphere??'-'}</td></tr><tr><td>CYL</td><td>${inv.left_cylinder??'-'}</td></tr><tr><td>AXIS</td><td>${inv.left_axis??'-'}</td></tr><tr><td>ADD</td><td>${inv.left_add??'-'}</td></tr></table>
          </div>
        </div>
        ${inv.eye_type ? `<div class="rx-extra"><b>Eye Type:</b> ${inv.eye_type}</div>` : ''}
        ${inv.lens_type ? `<div class="rx-extra"><b>Lens Type:</b> ${inv.lens_type}</div>` : ''}
        ${inv.ipd ? `<div class="rx-extra"><b>IPD:</b> ${inv.ipd} mm</div>` : ''}
      ` : ''

      const itemsHtml = `<table class="items">
        <thead><tr><th>Description</th><th class="c" style="width:12%">Qty</th><th class="r" style="width:18%">Price</th><th class="r" style="width:20%">Total</th></tr></thead>
        <tbody>${items.map((i:any) => `<tr><td>${i.description}</td><td class="c">${i.quantity}</td><td class="r">${formatCurrency(i.unit_price)}</td><td class="r">${formatCurrency(i.total_price)}</td></tr>`).join('')}</tbody>
      </table>`

      const barcodeNum = inv.invoice_number?.split('-').pop() || ''
      const dateTime = new Date().toLocaleString('en-SA', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true })

      let html = generateA4Html({
        shop: s,
        type: 'invoice',
        title: 'INVOICE',
        metaHtml,
        extraHtml,
        itemsHtml,
        totalsHtml: invoiceTotalsHtml(inv, formatCurrency),
        wordsHtml: `<div class="words">Amount in words: ${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>`,
        qrHtml: `<div id="a4-qr"></div>`,
        footerHtml: '',
        barcodeNum,
        dateTime,
      })

      container.innerHTML = html
      
      // Generate QR code
      const QRCode = (await import('qrcode')).default
      const qrCanvas = await QRCode.toCanvas(qrUrl, { width: 320 })
      const qrContainer = container.querySelector('#a4-qr')
      if (qrContainer) {
        qrCanvas.style.width = '42mm'
        qrCanvas.style.height = '42mm'
        qrContainer.appendChild(qrCanvas)
      }

      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 500))

      // Generate PDF
      const canvas = await html2canvas.default(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const imgData = canvas.toDataURL('image/jpeg', 0.98)
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297)
      pdf.save(`Invoice_${inv.invoice_number}.pdf`)

      // Cleanup
      document.body.removeChild(container)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // ─── Print A4 Directly ───
  const handlePrintA4 = () => renderA4Invoice(false)

  const renderA4Invoice = (download: boolean) => {
    const win = window.open('', '', 'width=800,height=900')
    if (!win) return

    const s = shop as ShopInfo
    const isOptical = inv.right_sphere != null || inv.eye_type

    const metaHtml = `<div class="meta">
      <div class="col"><b>Invoice #</b> ${inv.invoice_number}<br><b>Customer</b> ${inv.customer_name || 'Walk-in'}<br>${inv.customer_phone ? `<b>Phone</b> ${inv.customer_phone}` : ''}</div>
      <div class="col" style="text-align:right"><b>Date</b> ${date}<br><b>Status</b> <span style="color:${inv.payment_status==='paid'?'#16a34a':'#dc2626'};font-weight:700">${(inv.payment_status||'').toUpperCase()}</span><br>${inv.payment_method ? `<b>Method</b> ${inv.payment_method.toUpperCase()}` : ''}</div>
    </div>`

    const extraHtml = isOptical ? `
      <div class="rx-grid">
        <div class="rx-box od"><h4>RIGHT (OD)</h4>
          <table><tr><td>SPH</td><td>${inv.right_sphere??'-'}</td></tr><tr><td>CYL</td><td>${inv.right_cylinder??'-'}</td></tr><tr><td>AXIS</td><td>${inv.right_axis??'-'}</td></tr><tr><td>ADD</td><td>${inv.right_add??'-'}</td></tr></table>
        </div>
        <div class="rx-box os"><h4>LEFT (OS)</h4>
          <table><tr><td>SPH</td><td>${inv.left_sphere??'-'}</td></tr><tr><td>CYL</td><td>${inv.left_cylinder??'-'}</td></tr><tr><td>AXIS</td><td>${inv.left_axis??'-'}</td></tr><tr><td>ADD</td><td>${inv.left_add??'-'}</td></tr></table>
        </div>
      </div>
      ${inv.eye_type ? `<div class="rx-extra"><b>Eye Type:</b> ${inv.eye_type}</div>` : ''}
      ${inv.lens_type ? `<div class="rx-extra"><b>Lens Type:</b> ${inv.lens_type}</div>` : ''}
      ${inv.ipd ? `<div class="rx-extra"><b>IPD:</b> ${inv.ipd} mm</div>` : ''}
    ` : ''

    const itemsHtml = `<table class="items">
      <thead><tr><th>Description</th><th class="c" style="width:12%">Qty</th><th class="r" style="width:18%">Price</th><th class="r" style="width:20%">Total</th></tr></thead>
      <tbody>${items.map((i:any) => `<tr><td>${i.description}</td><td class="c">${i.quantity}</td><td class="r">${formatCurrency(i.unit_price)}</td><td class="r">${formatCurrency(i.total_price)}</td></tr>`).join('')}</tbody>
    </table>`

    const qrHtml = `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script><script>
      setTimeout(function(){
        var q=document.getElementById('a4-qr');q.style.width='42mm';q.style.height='42mm';
        new QRCode(q,{text:'${qrUrl}',width:320,height:320,colorDark:'#1a1a2e',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
        setTimeout(function(){
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
                pdf.save('Invoice_${inv.invoice_number}.pdf');
                setTimeout(function(){window.close()},500);
              });
            } else if(++tries>80){ clearInterval(iv); window.close(); }
          },100);`
          : `window.print();setTimeout(function(){window.close()},500);`
        }},400);
      },200);
    </script>`

    const barcodeNum = inv.invoice_number?.split('-').pop() || ''
    const dateTime = new Date().toLocaleString('en-SA', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true })

    let html = generateA4Html({
      shop: s,
      type: 'invoice',
      title: 'INVOICE',
      metaHtml,
      extraHtml,
      itemsHtml,
      totalsHtml: invoiceTotalsHtml(inv, formatCurrency),
      wordsHtml: `<div class="words">Amount in words: ${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>`,
      qrHtml,
      footerHtml: '',
      barcodeNum,
      dateTime,
    })

    if (download) {
      html = html.replace('</body>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script></body>')
    }

    win.document.write(html)
    win.document.close()
    if (download) toast.success('PDF downloading...')
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex flex-1 sm:flex-none" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Thermal Print
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex flex-1 sm:flex-none" onClick={handlePrintA4}>
            <Printer className="h-4 w-4 mr-2" /> Print A4
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handlePDF}>
            <Download className="h-4 w-4 mr-2" /> PDF (A4)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Invoice #{inv.invoice_number}</CardTitle>
              <p className="text-sm text-muted-foreground">{date}</p>
            </div>
            <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-sm">
              {inv.payment_status?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{inv.customer_name || 'Walk-in Customer'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{inv.customer_phone || '-'}</p>
            </div>
          </div>

          {(inv.invoice_type === 'optical' || inv.right_sphere != null) && (
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Optical Prescription</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Eye Type: <span className="font-medium">{inv.eye_type || '-'}</span></div>
                <div>Lens Type: <span className="font-medium">{inv.lens_type || '-'}</span></div>
              </div>
              {inv.right_sphere != null && (
                <div className="scroll-x -mx-1 px-1">
                  <Table className="min-w-[420px]">
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
                        <TableCell className="font-medium">R</TableCell>
                        <TableCell className="text-center">{inv.right_sphere}</TableCell>
                        <TableCell className="text-center">{inv.right_cylinder}</TableCell>
                        <TableCell className="text-center">{inv.right_axis}</TableCell>
                        <TableCell className="text-center">{inv.right_add}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">L</TableCell>
                        <TableCell className="text-center">{inv.left_sphere}</TableCell>
                        <TableCell className="text-center">{inv.left_cylinder}</TableCell>
                        <TableCell className="text-center">{inv.left_axis}</TableCell>
                        <TableCell className="text-center">{inv.left_add}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              {inv.ipd && <p className="text-sm">IPD: {inv.ipd}mm</p>}
            </div>
          )}

          <div className="scroll-x -mx-1 px-1">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div className="space-y-2 text-sm w-full sm:w-72 sm:ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(inv.discount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(inv.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatCurrency(inv.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span className="text-muted-foreground">Balance Due</span>
              <span>{formatCurrency(inv.balance_due)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Amount in words: {numberToWords(Math.floor(inv.total_amount))} Saudi Riyals
          </p>

          {inv.notes && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {inv.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
