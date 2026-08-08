'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useInvoice, useInvoiceItems } from '@/hooks/use-data'
import { formatCurrency, numberToWords } from '@/lib/utils'
import { useLang } from '@/contexts/lang-provider'

const PUBLIC_URL = 'https://safwanoptical-view.vercel.app'

export default function ReceiptViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useLang()
  const { data: receipt, isLoading } = useInvoice(id)
  const { data: items = [] } = useInvoiceItems(id)

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

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
  const date = new Date(rec.created_at).toLocaleDateString('en-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const qrUrl = `${PUBLIC_URL}/view.html?id=${id}`

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
        <tr><td class="label">Receipt No / الرقم</td><td>:</td><td>${rec.invoice_number}</td></tr>
      </table>
      <div class="dashed"></div>
      <div class="highlight">
        <div class="lbl">Received From / مستلم من</div>
        <div class="val">${rec.customer_name || 'Walk-in'}</div>
      </div>
      <div class="highlight">
        <div class="lbl">Amount in Figures (SAR) / المبلغ بالأرقام</div>
        <div class="val">${Number(rec.total_amount || 0).toFixed(2)}</div>
      </div>
      <div class="highlight">
        <div class="lbl">Amount in Words / المبلغ بالكلمات</div>
        <div class="val">${numberToWords(Math.floor(rec.total_amount || 0))}</div>
      </div>
      <div class="dashed"></div>
      <table class="info-table">
        <tr><td class="label">Payment Method / طريقة الدفع</td><td>:</td><td>${rec.payment_method || '-'}</td></tr>
        <tr><td class="label">Payment Status / حالة الدفع</td><td>:</td><td>${(rec.payment_status || '').toUpperCase()}</td></tr>
        <tr><td class="label">Notes / ملاحظات</td><td>:</td><td>${rec.notes || '-'}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig-box"><div class="sig-line"></div><div>Manager / المدير</div></div>
        <div class="sig-box"><div class="sig-line"></div><div>Accountant / المحاسب</div></div>
      </div>
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div><div>Received By / المستلم</div>
          <div style="margin-top:3px;font-size:11px">${rec.customer_name || ''}</div>
        </div>
        <div class="sig-box"><div class="sig-line"></div><div>Signature / التوقيع</div></div>
      </div>
      <div class="footer">
        <div>Kingdom of Saudi Arabia - Jeddah 23436 | 310158981300003</div>
        <div>Tel: +966 05 0918 3807</div>
      </div>
      <div class="qr" id="rec-qr-view"></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('rec-qr-view'), {
            text: '${qrUrl}', width: 100, height: 100,
            colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H
          });
          setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 300);
        }, 200);
      </script>
    </body></html>`)
    win.document.close()
  }

  // ─── A4 PDF ───
  const handlePDF = () => {
    const pdfWin = window.open('', '', 'width=800,height=900')
    if (!pdfWin) return

    pdfWin.document.write(`<!DOCTYPE html><html><head><title>PDF</title><style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
      #pdf-content { width: 210mm; max-width: 210mm; padding: 10mm; margin: 0 auto; background: white; color: #000; font-size: 11pt; box-sizing: border-box; }
      .cols { display: flex; gap: 3mm; margin-bottom: 5mm; }
      .left-col { flex: 1; }
      .right-col { width: 80mm; }
      .hdr { margin-bottom: 8mm; border-bottom: 2px solid #1a1a2e; padding-bottom: 4mm; }
      .hdr .en { font-size: 16pt; font-weight: bold; color: #1a1a2e; }
      .hdr .ar { direction: rtl; font-size: 12pt; margin-top: 2mm; }
      .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 6mm 0; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 3mm; display: inline-block; }
      .highlight-box { background: #f9f9f9; border-left: 4px solid #1a1a2e; padding: 4mm; margin-bottom: 4mm; border-radius: 3px; }
      .highlight-box .lbl { font-size: 9pt; color: #666; margin-bottom: 1mm; }
      .highlight-box .val { font-size: 12pt; font-weight: bold; }
      .info-tbl { width: 100%; border-collapse: collapse; margin: 4mm 0; }
      .info-tbl td { padding: 2mm; border-bottom: 1px solid #eee; font-size: 10pt; }
      .info-tbl .lbl { font-weight: bold; width: 40%; color: #444; }
      .signatures { display: flex; justify-content: space-between; margin-top: 10mm; gap: 5mm; }
      .sig-box { flex: 1; text-align: center; }
      .sig-line { border-top: 1px solid #000; margin: 25mm 0 5px; }
      .footer { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #ccc; text-align: center; font-size: 9pt; color: #666; }
      .qr-ft { text-align: center; margin: 8mm 0 4mm; }
    </style></head><body><div id="pdf-content">
      <div class="hdr">
        <div class="cols">
          <div class="left-col">
            <div class="en">Safwan OPTICALS</div>
            <div style="font-size:9pt;color:#555">Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436</div>
            <div style="font-size:9pt">Phone: +966 05 0918 3807 | VAT: 310158981300003</div>
          </div>
          <div class="right-col" style="text-align:right">
            <div class="ar" style="font-size:12pt;font-weight:bold">صفوان للبصريات</div>
            <div class="ar" style="font-size:9pt;color:#555">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
          </div>
        </div>
      </div>

      <div style="text-align:center"><span class="title">Receipt Voucher / سند قبض</span></div>

      <table class="info-tbl">
        <tr><td class="lbl">Date / التاريخ</td><td>${date}</td></tr>
        <tr><td class="lbl">Receipt No / الرقم</td><td>${rec.invoice_number}</td></tr>
      </table>

      <div class="highlight-box">
        <div class="lbl">Received From / مستلم من</div>
        <div class="val">${rec.customer_name || 'Walk-in'}</div>
      </div>
      <div class="highlight-box" style="border-left-color:#2563eb">
        <div class="lbl">Amount in Figures (SAR) / المبلغ بالأرقام</div>
        <div class="val" style="color:#2563eb">${Number(rec.total_amount || 0).toFixed(2)}</div>
      </div>
      <div class="highlight-box" style="border-left-color:#7c3aed">
        <div class="lbl">Amount in Words / المبلغ بالكلمات</div>
        <div class="val">${numberToWords(Math.floor(rec.total_amount || 0))} Saudi Riyals</div>
      </div>

      <table class="info-tbl">
        <tr><td class="lbl">Payment Method / طريقة الدفع</td><td>${rec.payment_method || '-'}</td></tr>
        <tr><td class="lbl">Payment Status / حالة الدفع</td><td>${(rec.payment_status || '').toUpperCase()}</td></tr>
        ${rec.notes ? `<tr><td class="lbl">Notes / ملاحظات</td><td>${rec.notes}</td></tr>` : ''}
      </table>

      <div class="signatures">
        <div class="sig-box"><div class="sig-line"></div><div>Manager / المدير</div></div>
        <div class="sig-box"><div class="sig-line"></div><div>Accountant / المحاسب</div></div>
      </div>
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div><div>Received By / المستلم</div>
          <div style="font-size:10pt;font-weight:bold;margin-top:2mm">${rec.customer_name || ''}</div>
        </div>
        <div class="sig-box"><div class="sig-line"></div><div>Signature / التوقيع</div></div>
      </div>

      <div class="footer">
        <div>Kingdom of Saudi Arabia - Jeddah 23436 | 310158981300003 | Tel: +966 05 0918 3807</div>
      </div>
      <div class="qr-ft" id="pdf-receipt-qr"></div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>
        setTimeout(function() {
          new QRCode(document.getElementById('pdf-receipt-qr'), {
            text: '${qrUrl}', width: 120, height: 120,
            colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H
          });
          setTimeout(function() {
            html2pdf().set({
              margin: 10, filename: 'Receipt_${rec.invoice_number}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 3, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(document.getElementById('pdf-content')).save().then(function() {
              setTimeout(function() { window.close(); }, 500);
            });
          }, 400);
        }, 300);
      </script>
    </div></body></html>`)
    pdfWin.document.close()
    toast.success('PDF downloading...')
  }

  // ─── Print A4 Directly ───
  const handlePrintA4 = () => {
    const win = window.open('', '', 'width=800,height=900')
    if (!win) return

    win.document.write(`<!DOCTYPE html><html><head><title>Print A4</title><style>
      @page { size: A4; margin: 10mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; font-size: 11pt; }
      .pdf-content { width: 210mm; max-width: 210mm; padding: 10mm; margin: 0 auto; background: white; box-sizing: border-box; }
      .cols { display: flex; gap: 3mm; margin-bottom: 5mm; }
      .left-col { flex: 1; } .right-col { width: 80mm; }
      .hdr { margin-bottom: 8mm; border-bottom: 2px solid #1a1a2e; padding-bottom: 4mm; }
      .hdr .en { font-size: 16pt; font-weight: bold; color: #1a1a2e; }
      .hdr .ar { direction: rtl; font-size: 12pt; margin-top: 2mm; }
      .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 6mm 0; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 3mm; display: inline-block; }
      .highlight-box { background: #f9f9f9; border-left: 4px solid #1a1a2e; padding: 4mm; margin-bottom: 4mm; border-radius: 3px; }
      .highlight-box .lbl { font-size: 9pt; color: #666; margin-bottom: 1mm; }
      .highlight-box .val { font-size: 12pt; font-weight: bold; }
      .info-tbl { width: 100%; border-collapse: collapse; margin: 4mm 0; }
      .info-tbl td { padding: 2mm; border-bottom: 1px solid #eee; font-size: 10pt; }
      .info-tbl .lbl { font-weight: bold; width: 40%; color: #444; }
      .signatures { display: flex; justify-content: space-between; margin-top: 10mm; gap: 5mm; }
      .sig-box { flex: 1; text-align: center; }
      .sig-line { border-top: 1px solid #000; margin: 25mm 0 5px; }
      .footer { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #ccc; text-align: center; font-size: 9pt; color: #666; }
    </style></head><body><div class="pdf-content">
      <div class="hdr">
        <div class="cols">
          <div class="left-col">
            <div class="en">Safwan OPTICALS</div>
            <div style="font-size:9pt;color:#555">Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436</div>
            <div style="font-size:9pt">Phone: +966 05 0918 3807 | VAT: 310158981300003</div>
          </div>
          <div class="right-col" style="text-align:right">
            <div class="ar" style="font-size:12pt;font-weight:bold">صفوان للبصريات</div>
            <div class="ar" style="font-size:9pt;color:#555">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
          </div>
        </div>
      </div>
      <div style="text-align:center"><span class="title">Receipt Voucher / سند قبض</span></div>
      <table class="info-tbl">
        <tr><td class="lbl">Date / التاريخ</td><td>${date}</td></tr>
        <tr><td class="lbl">Receipt No / الرقم</td><td>${rec.invoice_number}</td></tr>
      </table>
      <div class="highlight-box"><div class="lbl">Received From / مستلم من</div><div class="val">${rec.customer_name || 'Walk-in'}</div></div>
      <div class="highlight-box" style="border-left-color:#2563eb"><div class="lbl">Amount in Figures (SAR) / المبلغ بالأرقام</div><div class="val" style="color:#2563eb">${Number(rec.total_amount || 0).toFixed(2)}</div></div>
      <div class="highlight-box" style="border-left-color:#7c3aed"><div class="lbl">Amount in Words / المبلغ بالكلمات</div><div class="val">${numberToWords(Math.floor(rec.total_amount || 0))} Saudi Riyals</div></div>
      <table class="info-tbl">
        <tr><td class="lbl">Payment Method / طريقة الدفع</td><td>${rec.payment_method || '-'}</td></tr>
        <tr><td class="lbl">Payment Status / حالة الدفع</td><td>${(rec.payment_status || '').toUpperCase()}</td></tr>
        ${rec.notes ? `<tr><td class="lbl">Notes / ملاحظات</td><td>${rec.notes}</td></tr>` : ''}
      </table>
      <div class="signatures">
        <div class="sig-box"><div class="sig-line"></div><div>Manager / المدير</div></div>
        <div class="sig-box"><div class="sig-line"></div><div>Accountant / المحاسب</div></div>
      </div>
      <div class="signatures">
        <div class="sig-box"><div class="sig-line"></div><div>Received By / المستلم</div><div style="font-size:10pt;font-weight:bold;margin-top:2mm">${rec.customer_name || ''}</div></div>
        <div class="sig-box"><div class="sig-line"></div><div>Signature / التوقيع</div></div>
      </div>
      <div class="footer"><div>Kingdom of Saudi Arabia - Jeddah 23436 | 310158981300003 | Tel: +966 05 0918 3807</div></div>
      <div id="print-a4-rec-qr" style="text-align:center;margin-top:8mm"></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
      <script>setTimeout(function(){new QRCode(document.getElementById('print-a4-rec-qr'),{text:'${qrUrl}',width:150,height:150,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},400);},200);</script>
    </div></body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => router.push('/receipts')}>
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
              <CardTitle className="text-xl">{t('receipts.detailTitle')} #{rec.invoice_number}</CardTitle>
              <p className="text-sm text-muted-foreground">{date}</p>
            </div>
            <Badge variant={rec.payment_status === 'paid' ? 'default' : 'destructive'}>
              {rec.payment_status?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{rec.customer_name || 'Walk-in'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{rec.customer_phone || '-'}</p>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount (SAR)</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(rec.total_amount)}</span>
            </div>
            <div className="text-sm text-muted-foreground italic">
              {numberToWords(Math.floor(rec.total_amount || 0))} Saudi Riyals
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Payment Method</p>
              <p className="font-medium">{rec.payment_method || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Status</p>
              <Badge variant={rec.payment_status === 'paid' ? 'default' : 'destructive'}>
                {rec.payment_status}
              </Badge>
            </div>
          </div>

          {rec.notes && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {rec.notes}</p>
            </div>
          )}

          {items.length > 0 && items[0].description && (
            <>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Details:</span> {items[0].description}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
