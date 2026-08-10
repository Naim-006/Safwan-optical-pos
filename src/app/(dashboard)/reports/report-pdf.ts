import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePdf } from '@/lib/native'
import { formatCurrency } from '@/lib/utils'
import type {
  ProductAgg, CategoryAgg, CustomerAgg, DailyPoint, Kpis, SortKey, SortDir,
} from './report-utils'

export type ReportKind = 'full' | 'products' | 'categories' | 'customers'

export interface WeekdayPoint {
  name: string
  revenue: number
  invoices: number
}

export interface ReportBundle {
  shopName: string
  shopAddress?: string
  shopPhone?: string
  shopVat?: string
  shopLogoUrl?: string
  currency: string
  rangeLabel: string
  generatedAt: string
  kpis: Kpis
  prevKpis: Kpis
  daily: DailyPoint[]
  paymentStatus: { name: string; value: number }[]
  paymentMethods: { name: string; value: number }[]
  weekday: WeekdayPoint[]
  discounts: { total: number; count: number }
  products: ProductAgg[]
  productSort: { key: SortKey; dir: SortDir }
  categories: CategoryAgg[]
  customers: CustomerAgg[]
}

const PAGE_W = 210 // A4 width in mm
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

function money(n: number, currency: string): string {
  return formatCurrency(n || 0, currency)
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'report'
}

function pct(v: number, total: number): string {
  return total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%'
}

// ─── Logo loading ───

async function loadLogo(logoUrl?: string): Promise<{ dataUrl: string; format: string } | null> {
  if (!logoUrl) return null
  try {
    const res = await fetch(logoUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const type = blob.type || ''
    const format = type.includes('jpeg') ? 'JPEG' : type.includes('webp') ? 'WEBP' : type.includes('gif') ? 'GIF' : 'PNG'
    if (type.includes('svg')) return null
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => reject(new Error('read failed'))
      fr.readAsDataURL(blob)
    })
    return { dataUrl, format }
  } catch {
    return null
  }
}

// ─── Drawing primitives ───

function drawHeader(doc: jsPDF, b: ReportBundle, logo: { dataUrl: string; format: string } | null): number {
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 30, PAGE_W, 1.2, 'F')

  let textX = MARGIN
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, MARGIN, 7, 16, 16)
      textX = MARGIN + 21
    } catch {
      textX = MARGIN
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text(b.shopName || 'Safwan Opticals', textX, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  const sub = [b.shopAddress, b.shopPhone, b.shopVat ? `VAT ${b.shopVat}` : ''].filter(Boolean).join('  |  ')
  doc.text(sub, textX, 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('Sales Performance Report', PAGE_W - MARGIN, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Period: ${b.rangeLabel}`, PAGE_W - MARGIN, 18, { align: 'right' })
  doc.text(`Generated: ${b.generatedAt}`, PAGE_W - MARGIN, 22, { align: 'right' })

  return 38
}

function drawFooter(doc: jsPDF, b: ReportBundle, pageNumber: number): void {
  const pageSize = doc.internal.pageSize as unknown as { getHeight?: () => number; height?: number }
  const pageH = typeof pageSize.getHeight === 'function' ? pageSize.getHeight() : pageSize.height || 297
  const y = pageH - 11
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`${b.shopName}  |  Sales Report  |  ${b.rangeLabel}`, MARGIN, y)
  doc.text(`Page ${pageNumber}`, PAGE_W - MARGIN, y, { align: 'right' })
}

function kpiBoxes(doc: jsPDF, k: Kpis, currency: string, startY: number): number {
  const boxes: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'Total Sales', value: money(k.totalRevenue, currency), color: [37, 99, 235] },
    { label: 'Collected', value: money(k.collected, currency), color: [22, 163, 74] },
    { label: 'Outstanding', value: money(k.outstanding, currency), color: [234, 88, 12] },
    { label: 'Invoices', value: String(k.invoices), color: [147, 51, 234] },
    { label: 'Units Sold', value: String(k.units), color: [8, 145, 178] },
    { label: 'Avg Order', value: money(k.avgOrder, currency), color: [79, 70, 229] },
  ]
  const cols = 3
  const gap = 6
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols
  const boxH = 17
  boxes.forEach((box, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MARGIN + col * (boxW + gap)
    const yy = startY + row * (boxH + gap)
    const [r, g, bl] = box.color
    doc.setFillColor(r, g, bl, 0.08)
    doc.setDrawColor(r, g, bl)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, yy, boxW, boxH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(r, g, bl)
    doc.text(box.value, x + 5, yy + boxH - 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(100, 116, 139)
    doc.text(box.label.toUpperCase(), x + 5, yy + 6)
  })
  return startY + 2 * (boxH + gap) + 2
}

function sectionTitle(doc: jsPDF, title: string, subtitle: string, y: number): number {
  doc.setFillColor(37, 99, 235)
  doc.rect(MARGIN, y, 3, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(30, 41, 59)
  doc.text(title, MARGIN + 6, y + 4.5)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle, MARGIN + 6, y + 8.5)
  }
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.25)
  const lineY = subtitle ? y + 11 : y + 7.5
  doc.line(MARGIN, lineY, PAGE_W - MARGIN, lineY)
  return lineY + 5
}

const HEAD_STYLE = { fillColor: [30, 41, 59] as [number, number, number], textColor: 255, fontSize: 8.5, fontStyle: 'bold' as const }
const BODY_STYLE = { fontSize: 8.5, cellPadding: 1.8 }
const FOOT_STYLE = { fillColor: [241, 245, 249] as [number, number, number], textColor: [30, 41, 59] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8.5 }

// ─── Section builders ───

function renderDaily(doc: jsPDF, b: ReportBundle, y: number): number {
  const totals = b.daily.reduce(
    (acc, d) => {
      acc.sales += d.sales
      acc.collected += d.collected
      acc.invoices += d.invoices
      acc.units += d.units
      return acc
    },
    { sales: 0, collected: 0, invoices: 0, units: 0 }
  )
  y = sectionTitle(doc, 'Daily Performance', 'Revenue, collections and volume by day', y)
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Sales', 'Collected', 'Invoices', 'Units', 'Collection %']],
    body: b.daily.map((d) => [
      d.date,
      money(d.sales, b.currency),
      money(d.collected, b.currency),
      String(d.invoices),
      String(d.units),
      d.sales > 0 ? `${Math.round((d.collected / d.sales) * 100)}%` : '-',
    ]),
    foot: [['TOTAL', money(totals.sales, b.currency), money(totals.collected, b.currency), String(totals.invoices), String(totals.units), b.kpis.collectionRate + '%']],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderPaymentSummary(doc: jsPDF, b: ReportBundle, y: number): number {
  y = sectionTitle(doc, 'Payment Summary', 'Status and method breakdown of the period', y)

  const statusTotal = b.paymentStatus.reduce((s, p) => s + p.value, 0)
  const methodTotal = b.paymentMethods.reduce((s, m) => s + m.value, 0)

  autoTable(doc, {
    margin: { left: MARGIN, right: PAGE_W / 2 + 1 },
    startY: y,
    head: [['Payment Status', 'Amount', 'Share']],
    body: b.paymentStatus.map((p) => [p.name, money(p.value, b.currency), pct(p.value, statusTotal)]),
    foot: [['TOTAL', money(statusTotal, b.currency), '100%']],
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  const fy1 = (doc as any).lastAutoTable.finalY

  autoTable(doc, {
    margin: { left: PAGE_W / 2 + 1, right: MARGIN },
    startY: y,
    head: [['Method', 'Amount', 'Share']],
    body: b.paymentMethods.map((m) => [m.name, money(m.value, b.currency), pct(m.value, methodTotal)]),
    foot: [['TOTAL', money(methodTotal, b.currency), '100%']],
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  const fy2 = (doc as any).lastAutoTable.finalY

  return Math.max(fy1, fy2) + 4
}

function renderWeekday(doc: jsPDF, b: ReportBundle, y: number): number {
  const total = b.weekday.reduce((s, w) => s + w.revenue, 0)
  y = sectionTitle(doc, 'Sales by Weekday', 'Which days generate the most business', y)
  autoTable(doc, {
    startY: y,
    head: [['Day', 'Revenue', 'Invoices', 'Avg / Invoice', 'Share']],
    body: b.weekday.map((w) => [
      w.name,
      money(w.revenue, b.currency),
      String(w.invoices),
      money(w.invoices ? w.revenue / w.invoices : 0, b.currency),
      pct(w.revenue, total),
    ]),
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderProducts(doc: jsPDF, b: ReportBundle, y: number): number {
  const total = b.products.reduce((s, p) => s + p.revenue, 0)
  const units = b.products.reduce((s, p) => s + p.quantity, 0)
  y = sectionTitle(
    doc,
    'Product Sales Detail',
    `${b.products.length} products  •  ${units} units  •  ${money(total, b.currency)}  •  sorted by ${b.productSort.key} ${b.productSort.dir}`,
    y
  )
  const sorted = [...b.products].sort((a, c) => {
    const f = b.productSort.dir === 'asc' ? 1 : -1
    switch (b.productSort.key) {
      case 'name': return a.name.localeCompare(c.name) * f
      case 'quantity': return (a.quantity - c.quantity) * f
      case 'price': return (a.avgPrice - c.avgPrice) * f
      default: return (a.revenue - c.revenue) * f
    }
  })
  autoTable(doc, {
    startY: y,
    head: [['#', 'Product', 'Category', 'Qty', 'Avg Price', 'Revenue', '% Share']],
    body: sorted.slice(0, 100).map((p, i) => [
      String(i + 1),
      p.name,
      p.category,
      String(p.quantity),
      money(p.avgPrice, b.currency),
      money(p.revenue, b.currency),
      pct(p.revenue, total),
    ]),
    foot: [['', 'TOTAL', '', String(units), '', money(total, b.currency), '100%']],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 0 && Number(data.cell.raw) <= 3) {
        data.cell.styles.textColor = [37, 99, 235]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderCategories(doc: jsPDF, b: ReportBundle, y: number): number {
  const total = b.categories.reduce((s, c) => s + c.revenue, 0)
  y = sectionTitle(doc, 'Category Breakdown', `${b.categories.length} categories  •  ${money(total, b.currency)}`, y)
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Units', 'Line Items', 'Revenue', '% Share']],
    body: b.categories.map((c) => [
      c.name,
      String(c.quantity),
      String(c.count),
      money(c.revenue, b.currency),
      pct(c.revenue, total),
    ]),
    foot: [['TOTAL', String(b.categories.reduce((s, c) => s + c.quantity, 0)), String(b.categories.reduce((s, c) => s + c.count, 0)), money(total, b.currency), '100%']],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderCustomers(doc: jsPDF, b: ReportBundle, y: number): number {
  const total = b.customers.reduce((s, c) => s + c.revenue, 0)
  y = sectionTitle(doc, 'Customer Performance', `${b.customers.length} customers  •  ${money(total, b.currency)}`, y)
  autoTable(doc, {
    startY: y,
    head: [['#', 'Customer', 'Invoices', 'Paid', 'Outstanding', 'Revenue']],
    body: b.customers.slice(0, 100).map((c, i) => [
      String(i + 1),
      c.name,
      String(c.invoices),
      money(c.paid, b.currency),
      money(c.outstanding, b.currency),
      money(c.revenue, b.currency),
    ]),
    foot: [['', 'TOTAL', String(b.customers.reduce((s, c) => s + c.invoices, 0)), money(b.customers.reduce((s, c) => s + c.paid, 0), b.currency), money(b.customers.reduce((s, c) => s + c.outstanding, 0), b.currency), money(total, b.currency)]],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 0 && Number(data.cell.raw) <= 3) {
        data.cell.styles.textColor = [147, 51, 234]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderComparison(doc: jsPDF, b: ReportBundle, y: number): number {
  y = sectionTitle(doc, 'Period Comparison', 'Current period vs previous period', y)
  const rows = [
    ['Total Sales', money(b.kpis.totalRevenue, b.currency), money(b.prevKpis.totalRevenue, b.currency)],
    ['Collected', money(b.kpis.collected, b.currency), money(b.prevKpis.collected, b.currency)],
    ['Outstanding', money(b.kpis.outstanding, b.currency), money(b.prevKpis.outstanding, b.currency)],
    ['Invoices', String(b.kpis.invoices), String(b.prevKpis.invoices)],
    ['Units Sold', String(b.kpis.units), String(b.prevKpis.units)],
    ['Avg Order', money(b.kpis.avgOrder, b.currency), money(b.prevKpis.avgOrder, b.currency)],
  ]
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'This Period', 'Previous Period']],
    body: rows,
    foot: [['Discounts Given', `-${money(b.discounts.total, b.currency)}`, `${b.discounts.count} discounted invoices`]],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

// ─── Export entry ───

export async function exportReportPdf(kind: ReportKind, b: ReportBundle) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo(b.shopLogoUrl)
  const startY = kpiBoxes(doc, b.kpis, b.currency, drawHeader(doc, b, logo))

  if (kind === 'products') {
    renderProducts(doc, b, startY)
  } else if (kind === 'categories') {
    renderCategories(doc, b, startY)
  } else if (kind === 'customers') {
    renderCustomers(doc, b, startY)
  } else {
    let y = renderDaily(doc, b, startY)
    y = renderPaymentSummary(doc, b, y)
    y = renderWeekday(doc, b, y)
    y = renderComparison(doc, b, y)
    y = renderProducts(doc, b, y)
    y = renderCategories(doc, b, y)
    renderCustomers(doc, b, y)
  }

  const name = safeFilename(`${kind}_${b.rangeLabel}`)
  savePdf(doc, `${name}.pdf`)
}

// ─── Print view ───

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : '&quot;'
  )
}

function printTableHtml(
  head: string[],
  rows: (string | number)[][],
  alignRight: number[] = [],
  foot?: (string | number)[]
): string {
  return `<table>
    <thead><tr>${head.map((h, i) => `<th class="${alignRight.includes(i) ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr>${r
            .map((c, i) => `<td class="${alignRight.includes(i) ? 'r' : ''}">${esc(c)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody>
    ${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${alignRight.includes(i) ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr></tfoot>` : ''}
  </table>`
}

export function printReport(b: ReportBundle) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  const { kpis, currency } = b

  const kpiHtml = [
    ['Total Sales', money(kpis.totalRevenue, currency)],
    ['Collected', money(kpis.collected, currency)],
    ['Outstanding', money(kpis.outstanding, currency)],
    ['Invoices', String(kpis.invoices)],
    ['Units Sold', String(kpis.units)],
    ['Avg Order', money(kpis.avgOrder, currency)],
  ]
    .map(([l, v]) => `<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div></div>`)
    .join('')

  const totalProd = b.products.reduce((s, p) => s + p.revenue, 0)
  const discountLine = b.discounts.count > 0
    ? `<p class="meta-line">Discounts given: ${money(b.discounts.total, currency)} across ${b.discounts.count} invoices</p>`
    : ''

  const html = `<!DOCTYPE html><html><head><title>Sales Report — ${esc(b.shopName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; margin: 0; }
    .report-header { border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
    .report-header h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
    .report-header .shop { font-size: 12px; color: #334155; font-weight: 600; }
    .report-header .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
    .report-header .period { color: #2563eb; font-weight: 600; }
    h2 { font-size: 14px; margin: 24px 0 8px; padding-left: 8px; border-left: 4px solid #2563eb; color: #1e293b; }
    .kpis { display: flex; flex-wrap: wrap; gap: 8px; }
    .kpi { flex: 1 1 120px; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 6px; padding: 8px 10px; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
    .kpi-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 5px 7px; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
    td { padding: 4px 7px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    tfoot td { background: #f1f5f9; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .r { text-align: right; }
    .section { page-break-inside: auto; }
    .meta-line { font-size: 11px; color: #64748b; margin: 6px 0 0; }
    .foot { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style></head><body>
    <div class="report-header">
      <h1>Sales Performance Report</h1>
      <div class="shop">${esc(b.shopName)}</div>
      <div class="meta">Period: <span class="period">${esc(b.rangeLabel)}</span> &nbsp;|&nbsp; Generated: ${esc(b.generatedAt)}</div>
    </div>

    <div class="kpis">${kpiHtml}</div>
    ${discountLine}

    <div class="section">
      <h2>Daily Performance</h2>
      ${printTableHtml(
        ['Date', 'Sales', 'Collected', 'Invoices', 'Units'],
        b.daily.map((d) => [d.date, money(d.sales, currency), money(d.collected, currency), String(d.invoices), String(d.units)]),
        [1, 2, 3, 4]
      )}
    </div>

    <div class="section">
      <h2>Sales by Weekday</h2>
      ${printTableHtml(
        ['Day', 'Revenue', 'Invoices', 'Share'],
        b.weekday.map((w) => [w.name, money(w.revenue, currency), String(w.invoices), b.weekday.reduce((s, x) => s + x.revenue, 0) > 0 ? pct(w.revenue, b.weekday.reduce((s, x) => s + x.revenue, 0)) : '0%']),
        [1, 2, 3]
      )}
    </div>

    <div class="section">
      <h2>Product Sales Detail</h2>
      ${printTableHtml(
        ['#', 'Product', 'Category', 'Qty', 'Avg Price', 'Revenue', '% Share'],
        b.products.slice(0, 100).map((p, i) => [i + 1, p.name, p.category, String(p.quantity), money(p.avgPrice, currency), money(p.revenue, currency), pct(p.revenue, totalProd)]),
        [3, 4, 5, 6]
      )}
    </div>

    <div class="section">
      <h2>Categories</h2>
      ${printTableHtml(
        ['Category', 'Units', 'Line Items', 'Revenue'],
        b.categories.map((c) => [c.name, String(c.quantity), String(c.count), money(c.revenue, currency)]),
        [1, 2, 3]
      )}
    </div>

    <div class="section">
      <h2>Top Customers</h2>
      ${printTableHtml(
        ['#', 'Customer', 'Invoices', 'Paid', 'Outstanding', 'Revenue'],
        b.customers.slice(0, 50).map((c, i) => [i + 1, c.name, String(c.invoices), money(c.paid, currency), money(c.outstanding, currency), money(c.revenue, currency)]),
        [2, 3, 4, 5]
      )}
    </div>

    <div class="foot">Generated by ${esc(b.shopName)} — ${esc(b.rangeLabel)} · Confidential</div>
    <script>setTimeout(function(){ window.print(); }, 300);</script>
  </body></html>`

  win.document.write(html)
  win.document.close()
}

// ─── Excel export ───

export async function exportReportExcel(kind: ReportKind, b: ReportBundle) {
  const xlsx = await import('xlsx')
  const wb = xlsx.utils.book_new()

  const mkSheet = (name: string, head: (string | number)[], rows: (string | number)[][]) => {
    const ws = xlsx.utils.aoa_to_sheet([head, ...rows])
    ws['!cols'] = head.map(() => ({ wch: 18 }))
    xlsx.utils.book_append_sheet(wb, ws, name)
  }

  if (kind === 'full' || kind === 'products') {
    mkSheet(
      'Products',
      ['Product', 'Category', 'Qty', 'Avg Price', 'Revenue', 'Line Items'],
      b.products.map((p) => [p.name, p.category, p.quantity, Math.round(p.avgPrice * 100) / 100, Math.round(p.revenue * 100) / 100, p.count])
    )
  }
  if (kind === 'full' || kind === 'categories') {
    mkSheet(
      'Categories',
      ['Category', 'Units', 'Line Items', 'Revenue'],
      b.categories.map((c) => [c.name, c.quantity, c.count, Math.round(c.revenue * 100) / 100])
    )
  }
  if (kind === 'full' || kind === 'customers') {
    mkSheet(
      'Customers',
      ['Customer', 'Invoices', 'Paid', 'Outstanding', 'Revenue'],
      b.customers.map((c) => [c.name, c.invoices, Math.round(c.paid * 100) / 100, Math.round(c.outstanding * 100) / 100, Math.round(c.revenue * 100) / 100])
    )
  }
  if (kind === 'full') {
    mkSheet(
      'Summary',
      ['Metric', 'This Period', 'Previous Period'],
      [
        ['Total Sales', b.kpis.totalRevenue, b.prevKpis.totalRevenue],
        ['Collected', b.kpis.collected, b.prevKpis.collected],
        ['Outstanding', b.kpis.outstanding, b.prevKpis.outstanding],
        ['Invoices', b.kpis.invoices, b.prevKpis.invoices],
        ['Units Sold', b.kpis.units, b.prevKpis.units],
        ['Avg Order', b.kpis.avgOrder, b.prevKpis.avgOrder],
        ['Discounts', b.discounts.total, b.discounts.count],
      ]
    )
    mkSheet(
      'Daily',
      ['Date', 'Sales', 'Collected', 'Invoices', 'Units'],
      b.daily.map((d) => [d.date, d.sales, d.collected, d.invoices, d.units])
    )
    mkSheet(
      'Weekday',
      ['Day', 'Revenue', 'Invoices'],
      b.weekday.map((w) => [w.name, Math.round(w.revenue * 100) / 100, w.invoices])
    )
  }

  const name = safeFilename(`${kind}_${b.rangeLabel}`)
  xlsx.writeFile(wb, `${name}.xlsx`)
}
