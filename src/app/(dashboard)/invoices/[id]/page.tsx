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
import { useInvoice, useInvoiceItems } from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : ''

export default function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: invoice, isLoading } = useInvoice(id)
  const { data: items = [] } = useInvoiceItems(id)

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
  const qrUrl = `${SITE_URL}/invoices/${id}`

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
      <div class="header">
        <h2>Safwan OPTICALS</h2>
        <div>Abdur Rahman Ibn Ahmed As Sidayri, As Salamah, Jeddah 23436</div>
        <div class="ar">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
      </div>
      <div style="text-align:center;font-size:10px">Phone: +966 05 0918 3807</div>
      <div style="text-align:center;font-size:10px">VAT No: 310158981300003</div>
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
        <div>Tel: +966 05 0918 3807</div>
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
  const handlePDF = () => {
    const pdfWin = window.open('', '', 'width=800,height=900')
    if (!pdfWin) return

    pdfWin.document.write(`<!DOCTYPE html><html><head><title>PDF Export</title><style>
      @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
      #pdf-content { width: 210mm; padding: 15mm; margin: 0 auto; background: white; color: #000; font-size: 10pt; }
      .hdr { text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #1a1a2e; padding-bottom: 5mm; }
      .hdr h1 { margin: 0; font-size: 18pt; font-weight: bold; color: #1a1a2e; }
      .hdr .address { font-size: 9pt; color: #555; margin: 2mm 0; }
      .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 5mm 0; }
      .cols { display: flex; justify-content: space-between; margin-bottom: 5mm; font-size: 10pt; }
      .cols .left, .cols .right { width: 48%; }
      .rx-boxes { display: flex; gap: 3mm; margin-bottom: 5mm; }
      .rx-box { flex: 1; background: #f5f5f5; border: 1px solid #ccc; border-radius: 4px; padding: 6px; }
      .rx-box h4 { margin: 0 0 3mm; font-size: 10pt; text-align: center; }
      .rx-box table { width: 100%; font-size: 9pt; }
      .rx-box td { padding: 1mm 0; }
      .items-table { width: 100%; border-collapse: collapse; margin: 5mm 0; }
      .items-table th { background: #f0f0f0; border-bottom: 2px solid #000; padding: 5px; text-align: left; }
      .items-table td { padding: 5px; border-bottom: 1px solid #ddd; }
      .summary { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
      .summary td { padding: 3px; }
      .summary .total-row { border: 2px solid #000; background: #f9f9f9; font-weight: bold; }
      .words { text-align: center; margin: 5mm 0; font-weight: bold; font-size: 10pt; }
      .qr-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10mm; }
      .qr-footer .qr-box { width: 30mm; height: 30mm; }
      .thanks { text-align: right; }
    </style></head><body>
      <div id="pdf-content">
        <div class="hdr">
          <h1>Safwan OPTICALS</h1>
          <div class="address">Abdul Rahman Ibn Ahmed As Sidayri, As Salamah, Jeddah 23436</div>
          <div class="address"><b>Phone:</b> +966 05 0918 3807  |  <b>VAT No:</b> 310158981300003</div>
        </div>

        <div class="title">INVOICE</div>

        <div class="cols">
          <div class="left">
            <p><b>Invoice #:</b> ${inv.invoice_number}</p>
            <p><b>Customer:</b> ${inv.customer_name || 'Walk-in'}</p>
            <p><b>Phone:</b> ${inv.customer_phone || '-'}</p>
          </div>
          <div class="right" style="text-align:right">
            <p><b>Date:</b> ${date}</p>
            <p><b>Status:</b> ${(inv.payment_status || '').toUpperCase()}</p>
            <p><b>Method:</b> ${inv.payment_method || '-'}</p>
          </div>
        </div>

        ${(inv.right_sphere != null || inv.eye_type) ? `
        <h3 style="text-align:center;margin:4mm 0 2mm;font-size:12pt;font-weight:bold">OPTICAL MEASUREMENTS</h3>
        <div class="rx-boxes">
          <div class="rx-box">
            <h4>RIGHT EYE (OD)</h4>
            <table>
              <tr><td><b>SPH:</b></td><td style="text-align:right">${inv.right_sphere ?? '-'}</td></tr>
              <tr><td><b>CYL:</b></td><td style="text-align:right">${inv.right_cylinder ?? '-'}</td></tr>
              <tr><td><b>AXIS:</b></td><td style="text-align:right">${inv.right_axis ?? '-'}</td></tr>
              <tr><td><b>ADD:</b></td><td style="text-align:right">${inv.right_add ?? '-'}</td></tr>
            </table>
          </div>
          <div class="rx-box">
            <h4>LEFT EYE (OS)</h4>
            <table>
              <tr><td><b>SPH:</b></td><td style="text-align:right">${inv.left_sphere ?? '-'}</td></tr>
              <tr><td><b>CYL:</b></td><td style="text-align:right">${inv.left_cylinder ?? '-'}</td></tr>
              <tr><td><b>AXIS:</b></td><td style="text-align:right">${inv.left_axis ?? '-'}</td></tr>
              <tr><td><b>ADD:</b></td><td style="text-align:right">${inv.left_add ?? '-'}</td></tr>
            </table>
          </div>
        </div>
        ${inv.eye_type ? `<p><b>Eye Type:</b> ${inv.eye_type}</p>` : ''}
        ${inv.lens_type ? `<p><b>Lens Type:</b> ${inv.lens_type}</p>` : ''}
        ${inv.ipd ? `<p><b>IPD:</b> ${inv.ipd}mm</p>` : ''}
        ` : ''}

        <h3 style="text-align:center;font-size:12pt;font-weight:bold">Items</h3>
        <table class="items-table">
          <thead><tr><th>Description</th><th style="text-align:center;width:15%">Qty</th><th style="text-align:right;width:20%">Price</th><th style="text-align:right;width:20%">Total</th></tr></thead>
          <tbody>
            ${items.map((i: any) => `
              <tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatCurrency(i.unit_price)}</td><td style="text-align:right">${formatCurrency(i.total_price)}</td></tr>
            `).join('')}
          </tbody>
        </table>

        <table class="summary">
          <tr><td><b>Subtotal:</b></td><td style="text-align:right">${formatCurrency(inv.subtotal)}</td></tr>
          ${Number(inv.discount) > 0 ? `<tr><td><b>Discount:</b></td><td style="text-align:right">-${formatCurrency(inv.discount)}</td></tr>` : ''}
          <tr><td><b>Amount Paid:</b></td><td style="text-align:right;color:#2563eb">${formatCurrency(inv.amount_paid || 0)}</td></tr>
          ${Number(inv.balance_due) > 0 ? `<tr><td><b>Balance Due:</b></td><td style="text-align:right;color:#dc2626">${formatCurrency(inv.balance_due)}</td></tr>` : ''}
          <tr class="total-row"><td style="padding:6px"><b>TOTAL:</b></td><td style="text-align:right;font-size:12pt">${formatCurrency(inv.total_amount)}</td></tr>
        </table>

        <div class="words">Amount in words: ${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>

        <div class="qr-footer">
          <div class="qr-box" id="pdf-qr"></div>
          <div class="thanks">
            <p style="font-weight:bold">Thank you for shopping with us!</p>
            <p style="font-weight:bold;direction:rtl">شكراً لتسوقك معنا!</p>
          </div>
        </div>
      </div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('pdf-qr'), {
            text: '${qrUrl}',
            width: 100, height: 100,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.H
          });
          setTimeout(function() {
            html2pdf().set({
              margin: 0,
              filename: 'Invoice_${inv.invoice_number}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 3, useCORS: true, letterRendering: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(document.getElementById('pdf-content')).save().then(function() {
              setTimeout(function() { window.close(); }, 500);
            });
          }, 400);
        }, 300);
      </script>
    </body></html>`)
    pdfWin.document.close()
    toast.success('PDF downloading...')
  }

  // ─── Print A4 Directly ───
  const handlePrintA4 = () => {
    const win = window.open('', '', 'width=800,height=900')
    if (!win) return

    win.document.write(`<!DOCTYPE html><html><head><title>Print A4</title><style>
      @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
      @page { size: A4; margin: 10mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
      .pdf-content { width: 190mm; padding: 10mm; margin: 0 auto; background: white; color: #000; font-size: 10pt; }
      .hdr { text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #1a1a2e; padding-bottom: 5mm; }
      .hdr h1 { margin: 0; font-size: 18pt; font-weight: bold; color: #1a1a2e; }
      .hdr .address { font-size: 9pt; color: #555; margin: 2mm 0; }
      .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 5mm 0; }
      .cols { display: flex; justify-content: space-between; margin-bottom: 5mm; font-size: 10pt; }
      .cols .left, .cols .right { width: 48%; }
      .rx-boxes { display: flex; gap: 3mm; margin-bottom: 5mm; }
      .rx-box { flex: 1; background: #f5f5f5; border: 1px solid #ccc; border-radius: 4px; padding: 6px; }
      .rx-box h4 { margin: 0 0 3mm; font-size: 10pt; text-align: center; }
      .rx-box table { width: 100%; font-size: 9pt; }
      .rx-box td { padding: 1mm 0; }
      .items-table { width: 100%; border-collapse: collapse; margin: 5mm 0; }
      .items-table th { background: #f0f0f0; border-bottom: 2px solid #000; padding: 5px; text-align: left; }
      .items-table td { padding: 5px; border-bottom: 1px solid #ddd; }
      .summary { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
      .summary td { padding: 3px; }
      .summary .total-row { border: 2px solid #000; background: #f9f9f9; font-weight: bold; }
      .words { text-align: center; margin: 5mm 0; font-weight: bold; font-size: 10pt; }
      .qr-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10mm; }
      .thanks { text-align: right; }
    </style></head><body><div class="pdf-content">
      <div class="hdr">
        <h1>Safwan OPTICALS</h1>
        <div class="address">Abdul Rahman Ibn Ahmed As Sidayri, As Salamah, Jeddah 23436</div>
        <div class="address"><b>Phone:</b> +966 05 0918 3807  |  <b>VAT No:</b> 310158981300003</div>
      </div>
      <div class="title">INVOICE</div>
      <div class="cols">
        <div class="left"><p><b>Invoice #:</b> ${inv.invoice_number}</p><p><b>Customer:</b> ${inv.customer_name || 'Walk-in'}</p><p><b>Phone:</b> ${inv.customer_phone || '-'}</p></div>
        <div class="right" style="text-align:right"><p><b>Date:</b> ${date}</p><p><b>Status:</b> ${(inv.payment_status || '').toUpperCase()}</p><p><b>Method:</b> ${inv.payment_method || '-'}</p></div>
      </div>
      ${(inv.right_sphere != null || inv.eye_type) ? `<h3 style="text-align:center;margin:4mm 0 2mm;font-size:12pt;font-weight:bold">OPTICAL MEASUREMENTS</h3>
      <div class="rx-boxes">
        <div class="rx-box"><h4>RIGHT EYE (OD)</h4><table><tr><td><b>SPH:</b></td><td style="text-align:right">${inv.right_sphere ?? '-'}</td></tr><tr><td><b>CYL:</b></td><td style="text-align:right">${inv.right_cylinder ?? '-'}</td></tr><tr><td><b>AXIS:</b></td><td style="text-align:right">${inv.right_axis ?? '-'}</td></tr><tr><td><b>ADD:</b></td><td style="text-align:right">${inv.right_add ?? '-'}</td></tr></table></div>
        <div class="rx-box"><h4>LEFT EYE (OS)</h4><table><tr><td><b>SPH:</b></td><td style="text-align:right">${inv.left_sphere ?? '-'}</td></tr><tr><td><b>CYL:</b></td><td style="text-align:right">${inv.left_cylinder ?? '-'}</td></tr><tr><td><b>AXIS:</b></td><td style="text-align:right">${inv.left_axis ?? '-'}</td></tr><tr><td><b>ADD:</b></td><td style="text-align:right">${inv.left_add ?? '-'}</td></tr></table></div>
      </div>${inv.eye_type ? `<p><b>Eye Type:</b> ${inv.eye_type}</p>` : ''}${inv.lens_type ? `<p><b>Lens Type:</b> ${inv.lens_type}</p>` : ''}${inv.ipd ? `<p><b>IPD:</b> ${inv.ipd}mm</p>` : ''}` : ''}
      <h3 style="text-align:center;font-size:12pt;font-weight:bold">Items</h3>
      <table class="items-table"><thead><tr><th>Description</th><th style="text-align:center;width:15%">Qty</th><th style="text-align:right;width:20%">Price</th><th style="text-align:right;width:20%">Total</th></tr></thead><tbody>${items.map((i: any) => `<tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatCurrency(i.unit_price)}</td><td style="text-align:right">${formatCurrency(i.total_price)}</td></tr>`).join('')}</tbody></table>
      <table class="summary"><tr><td><b>Subtotal:</b></td><td style="text-align:right">${formatCurrency(inv.subtotal)}</td></tr>${Number(inv.discount) > 0 ? `<tr><td><b>Discount:</b></td><td style="text-align:right">-${formatCurrency(inv.discount)}</td></tr>` : ''}<tr><td><b>Paid:</b></td><td style="text-align:right;color:#2563eb">${formatCurrency(inv.amount_paid || 0)}</td></tr>${Number(inv.balance_due) > 0 ? `<tr><td><b>Balance Due:</b></td><td style="text-align:right;color:#dc2626">${formatCurrency(inv.balance_due)}</td></tr>` : ''}<tr class="total-row"><td style="padding:6px"><b>TOTAL:</b></td><td style="text-align:right;font-size:12pt">${formatCurrency(inv.total_amount)}</td></tr></table>
      <div class="words">Amount in words: ${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>
      <div class="qr-footer"><div id="print-a4-qr"></div><div class="thanks"><p style="font-weight:bold">Thank you for shopping with us!</p><p style="font-weight:bold;direction:rtl">شكراً لتسوقك معنا!</p></div></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script><script>setTimeout(function(){new QRCode(document.getElementById('print-a4-qr'),{text:'${qrUrl}',width:100,height:100,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},400);},200);</script>
    </div></body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Thermal Print
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintA4}>
            <Printer className="h-4 w-4 mr-2" /> Print A4
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF}>
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
              )}
              {inv.ipd && <p className="text-sm">IPD: {inv.ipd}mm</p>}
            </div>
          )}

          <Table>
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

          <Separator />

          <div className="space-y-2 text-sm w-72 ml-auto">
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
