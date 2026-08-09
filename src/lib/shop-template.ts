export interface ShopInfo {
  shopName: string
  arName?: string
  address?: string
  phone?: string
  vat?: string
  website?: string
  logoUrl?: string
  crNumber?: string
}

export function shopHeaderHtml(shop: ShopInfo | null | undefined, extra?: string): string {
  const name = shop?.shopName || 'Safwan Opticals'
  const ar = shop?.arName || ''
  const addr = shop?.address || 'Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436'
  const phone = shop?.phone || '+966 05 0918 3807'
  const vat = shop?.vat || '310158981300003'
  const logo = shop?.logoUrl || ''
  const cr = shop?.crNumber || ''

  return `
    ${logo ? `<img src="${logo}" style="max-height:15mm;display:block;margin:0 auto 2mm" />` : ''}
    ${ar ? `<h2 class="ar" style="direction:rtl;margin:0">${ar}</h2>` : ''}
    <h2 style="margin-top:${ar ? '2mm' : '0'}">${name}</h2>
    <div>${addr}</div>
    <div style="text-align:center;font-size:10px;margin:2mm 0">
      VAT: ${vat}${phone ? ` | Tel: ${phone}` : ''}
    </div>
    ${extra || ''}
  `.trim()
}

export function shopHeaderReceipt(shop: ShopInfo | null | undefined): string {
  const name = shop?.shopName || 'Safwan Opticals'
  const ar = shop?.arName || ''
  const addr = shop?.address || 'Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436'
  const phone = shop?.phone || '+966 05 0918 3807'
  const vat = shop?.vat || '310158981300003'
  const logo = shop?.logoUrl || ''

  return `
    ${logo ? `<img src="${logo}" style="max-height:12mm;display:block;margin:0 auto 2mm" />` : ''}
    <div class="header">
      ${ar ? `<div class="ar" style="font-size:14px;font-weight:bold">${ar}</div>` : ''}
      <div class="en">${name}</div>
      <div>${addr}</div>
    </div>
    <div style="text-align:center;font-size:10px">VAT NO: ${vat}${phone ? ` | Tel: ${phone}` : ''}</div>
    <div class="divider"></div>
  `.trim()
}

// ─── Shared A4 template for both Print + PDF ───
export function generateA4Html(opts: {
  shop: ShopInfo | null | undefined
  type: 'invoice' | 'receipt'
  title: string
  metaHtml: string
  extraHtml: string
  itemsHtml: string
  totalsHtml: string
  wordsHtml: string
  qrHtml: string
  footerHtml: string
  barcodeNum?: string
  dateTime?: string
}): string {
  const s = opts.shop
  const name = s?.shopName || 'Safwan Opticals'
  const ar = s?.arName || ''
  const addr = s?.address || 'Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436'
  const phone = s?.phone || ''
  const vat = s?.vat || '310158981300003'
  const cr = s?.crNumber || ''
  const logo = s?.logoUrl || ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${opts.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { margin:0; padding:0; width:100%; background:#fff; }
    body { font-family:'Segoe UI','Inter',Arial,sans-serif; background:#fff; }
    .page { width:210mm; min-height:297mm; margin:0; padding:8mm 10mm; background:#fff; color:#111; }
    @media screen { html, body { width:794px; overflow:hidden; } .page { width:794px; min-height:1123px; } }
    @media print { html, body { margin:0; padding:0; width:auto; overflow:visible; } .page { width:210mm; min-height:297mm; } }
    @page { size: A4 portrait; margin: 0; }
    .hdr { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid #1a1a2e; padding-bottom:4mm; margin-bottom:4mm; }
    .hdr-left { flex:1; text-align:left; padding-top:2mm; }
    .hdr-left canvas { width:40mm; height:10mm; display:block; margin-bottom:2mm; }
    .hdr-left .web { font-size:7pt; color:#888; font-family:monospace; }
    .hdr-center { flex:0 0 auto; text-align:center; padding:0 3mm; }
    .logo-img { max-height:16mm; max-width:32mm; object-fit:contain; display:block; margin:0 auto 2mm; }
    .hdr-center .vat { font-size:8pt; font-weight:700; color:#1a1a2e; }
    .hdr-right { flex:1; text-align:right; }
    .hdr-right .ar-name { font-size:11pt; font-weight:700; color:#1a1a2e; direction:rtl; margin-bottom:1mm; }
    .hdr-right .en-name { font-size:10pt; font-weight:700; color:#1a1a2e; margin-bottom:0.5mm; }
    .hdr-right .info { font-size:7.5pt; color:#555; line-height:1.5; }
    .doc-title { text-align:center; font-size:11pt; font-weight:800; color:#1a1a2e; padding:2.5mm 0; border-bottom:2px solid #1a1a2e; margin-bottom:3mm; letter-spacing:1.5px; }
    .meta { display:flex; justify-content:space-between; font-size:8.5pt; margin-bottom:3mm; }
    .meta .col { }
    .meta .col b { color:#1a1a2e; }
    .rx-grid { display:flex; gap:3mm; margin-bottom:3mm; }
    .rx-box { flex:1; border:1px solid #ddd; border-radius:4px; padding:2.5mm 3mm; }
    .rx-box h4 { font-size:8pt; font-weight:700; text-align:center; padding-bottom:1.5mm; border-bottom:1px solid #eee; margin-bottom:1.5mm; }
    .rx-box td { font-size:8pt; padding:0.8mm 0; }
    .rx-box td:first-child { color:#666; }
    .rx-box td:last-child { text-align:right; font-weight:600; }
    .rx-box.od { border-left:3px solid #2563eb; }
    .rx-box.os { border-left:3px solid #d97706; }
    .rx-box.od h4 { color:#2563eb; }
    .rx-box.os h4 { color:#d97706; }
    .rx-extra { font-size:8pt; color:#555; margin-bottom:1mm; }
    .section-label { font-size:8.5pt; font-weight:700; color:#1a1a2e; border-bottom:1px solid #ddd; padding-bottom:1mm; margin-bottom:2mm; text-transform:uppercase; letter-spacing:0.5px; }
    .items { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:3mm; }
    .items th { background:#f5f5f5; padding:2mm; text-align:left; border-bottom:2px solid #1a1a2e; font-size:7.5pt; text-transform:uppercase; color:#555; }
    .items td { padding:2mm; border-bottom:1px solid #eee; }
    .items .r { text-align:right; }
    .items .c { text-align:center; }
    .totals-wrap { display:flex; align-items:center; gap:4mm; margin-bottom:3mm; }
    .totals-wrap .qr-col { flex:0 0 40%; text-align:center; }
    .totals-wrap .qr-col .qr-img { width:42mm; height:42mm; display:block; margin:0 auto; }
    .totals-wrap .qr-col .qr-img img, .totals-wrap .qr-col .qr-img canvas { max-width:42mm; max-height:42mm; }
    .totals-wrap .total-col { flex:1; min-width:0; }
    .totals { font-size:8.5pt; margin-bottom:0; }
    .totals .tr { display:flex; justify-content:space-between; padding:1mm 0; }
    .totals .grand { font-size:10pt; font-weight:700; border-top:2px solid #1a1a2e; border-bottom:2px solid #1a1a2e; padding:2mm 0; margin:1.5mm 0; }
    .words { text-align:center; font-size:7.5pt; color:#666; font-style:italic; margin-bottom:3mm; }
    .bot { border-top:1px solid #ddd; padding-top:3mm; text-align:right; font-size:7.5pt; color:#666; }
    .bot .ar { direction:rtl; }
    .receipt-label { font-size:7pt; text-transform:uppercase; color:#888; letter-spacing:0.5px; margin-bottom:0.5mm; }
    .receipt-val { font-size:10pt; font-weight:700; }
    .receipt-box { padding:2.5mm 3mm; margin-bottom:2mm; border-left:3px solid #1a1a2e; background:#f8f9fa; }
    .receipt-box.blue { border-left-color:#2563eb; }
    .info-table { width:100%; border-collapse:collapse; margin-bottom:3mm; }
    .info-table td { padding:1.6mm 2mm; border-bottom:1px solid #eee; }
    .info-table .lbl { width:45%; font-size:8pt; color:#666; font-weight:600; }
    .info-table .lbl::after { content:':'; }
    .info-table td:last-child { font-size:9pt; font-weight:700; text-align:right; }
    .highlight { padding:2.5mm 3mm; margin-bottom:2.5mm; border-left:4px solid #1a1a2e; background:#f8f9fa; border-radius:3px; }
    .highlight .hlbl { font-size:7.5pt; text-transform:uppercase; color:#888; letter-spacing:0.5px; margin-bottom:0.8mm; }
    .highlight .hval { font-size:11pt; font-weight:700; color:#111; }
    .highlight.blue { border-left-color:#2563eb; background:#eff6ff; }
    .highlight.purple { border-left-color:#7c3aed; background:#f5f3ff; }
    .signatures { display:flex; gap:4mm; margin:6mm 0 4mm; }
    .sig-box { flex:1; text-align:center; }
    .sig-line { border-top:1px solid #000; margin:15mm 0 2mm; }
    .sig-lbl { font-size:7pt; color:#555; }
    .fnote { text-align:center; font-size:7pt; color:#888; border-top:1px solid #ddd; padding-top:2mm; }
  </style></head><body><div class="page">
    <div class="hdr">
      <div class="hdr-left">
        ${opts.barcodeNum ? `<canvas id="barcode-canvas"></canvas>` : ''}
        ${s?.website ? `<div class="web">${s.website}</div>` : ''}
      </div>
      <div class="hdr-center">
        ${logo ? `<img src="${logo}" class="logo-img" />` : ''}
        <div class="vat">VAT: ${vat}</div>
      </div>
      <div class="hdr-right">
        ${ar ? `<div class="ar-name">${ar}</div>` : ''}
        <div class="en-name">${name}</div>
        <div class="info">
          ${addr}<br>
          ${phone ? `Tel: ${phone}` : ''}
        </div>
      </div>
    </div>
    ${opts.title ? `<div class="doc-title">${opts.title}</div>` : ''}
    ${opts.metaHtml}
    ${opts.extraHtml}
    ${opts.itemsHtml ? `<div class="section-label">${opts.type === 'receipt' ? 'Details / التفاصيل' : 'Items / العناصر'}</div>${opts.itemsHtml}` : ''}
    <div class="totals-wrap">
      <div class="qr-col"><div class="qr-img" id="a4-qr"></div></div>
      <div class="total-col">${opts.totalsHtml}</div>
    </div>
    ${opts.wordsHtml}
    <div class="bot">
      <div>Thank you for choosing ${name}</div>
      <div class="ar">شكراً لاختيارك ${ar || name}</div>
    </div>
    ${opts.footerHtml}
  </div>
  ${opts.barcodeNum ? `<script>
    try {
      JsBarcode('#barcode-canvas', '${opts.barcodeNum}', {
        format:'CODE128', lineColor:'#1a1a2e', width:1.4, height:35, displayValue:false, margin:2
      })
    } catch(e) {}
  </script>` : ''}
  ${opts.qrHtml}
  </body></html>`
}

export function invoiceTotalsHtml(inv: any, formatCurrency: (n: number) => string): string {
  return `<div class="totals">
    <div class="tr"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
    ${Number(inv.discount) > 0 ? `<div class="tr"><span>Discount</span><span>-${formatCurrency(inv.discount)}</span></div>` : ''}
    <div class="tr grand"><span>TOTAL</span><span>${formatCurrency(inv.total_amount)}</span></div>
    <div class="tr"><span>Paid</span><span style="color:#2563eb">${formatCurrency(inv.amount_paid || 0)}</span></div>
    ${Number(inv.balance_due) > 0 ? `<div class="tr"><span>Balance Due</span><span style="color:#dc2626">${formatCurrency(inv.balance_due)}</span></div>` : ''}
  </div>`
}
