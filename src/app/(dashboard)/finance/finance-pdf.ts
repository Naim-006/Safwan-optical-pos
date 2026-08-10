import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePdf } from '@/lib/native'
import { formatCurrency } from '@/lib/utils'
import type {
  FinanceKpis, CashFlowPoint, MonthlyPoint, SlicePoint, FinTx,
} from './finance-utils'

export interface FinanceBundle {
  shopName: string
  shopAddress?: string
  shopPhone?: string
  shopVat?: string
  shopLogoUrl?: string
  currency: string
  rangeLabel: string
  generatedAt: string
  kpis: FinanceKpis
  prevKpis: FinanceKpis
  daily: CashFlowPoint[]
  monthly: MonthlyPoint[]
  expenseByCategory: SlicePoint[]
  incomeByMethod: SlicePoint[]
  expenseByMethod: SlicePoint[]
  transactions: FinTx[]
}

const PAGE_W = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

function money(n: number, currency: string): string {
  return formatCurrency(n || 0, currency)
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'finance'
}

function pct(v: number, total: number): string {
  return total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%'
}

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

function drawHeader(doc: jsPDF, b: FinanceBundle, logo: { dataUrl: string; format: string } | null): number {
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setFillColor(16, 185, 129)
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
  doc.text('Finance & Cash Flow Report', PAGE_W - MARGIN, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Period: ${b.rangeLabel}`, PAGE_W - MARGIN, 18, { align: 'right' })
  doc.text(`Generated: ${b.generatedAt}`, PAGE_W - MARGIN, 22, { align: 'right' })

  return 38
}

function drawFooter(doc: jsPDF, b: FinanceBundle, pageNumber: number): void {
  const pageSize = doc.internal.pageSize as unknown as { getHeight?: () => number; height?: number }
  const pageH = typeof pageSize.getHeight === 'function' ? pageSize.getHeight() : pageSize.height || 297
  const y = pageH - 11
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`${b.shopName}  |  Finance Report  |  ${b.rangeLabel}`, MARGIN, y)
  doc.text(`Page ${pageNumber}`, PAGE_W - MARGIN, y, { align: 'right' })
}

function kpiBoxes(doc: jsPDF, k: FinanceKpis, currency: string, startY: number): number {
  const boxes: { label: string; value: string; color: [number, number, number] }[] = [
    { label: 'Total Income', value: money(k.totalIncome, currency), color: [37, 99, 235] },
    { label: 'Collected', value: money(k.collected, currency), color: [22, 163, 74] },
    { label: 'Outstanding', value: money(k.outstanding, currency), color: [234, 88, 12] },
    { label: 'Total Expenses', value: money(k.expenseTotal, currency), color: [239, 68, 68] },
    { label: 'Net Profit', value: money(k.net, currency), color: [147, 51, 234] },
    { label: 'Margin', value: `${k.margin}%`, color: [8, 145, 178] },
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
  doc.setFillColor(16, 185, 129)
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

function renderSummary(doc: jsPDF, b: FinanceBundle, y: number): number {
  y = sectionTitle(doc, 'Financial Summary', 'Current period vs previous period', y)
  const rows = [
    ['Total Income', money(b.kpis.totalIncome, b.currency), money(b.prevKpis.totalIncome, b.currency)],
    ['Collected', money(b.kpis.collected, b.currency), money(b.prevKpis.collected, b.currency)],
    ['Outstanding', money(b.kpis.outstanding, b.currency), money(b.prevKpis.outstanding, b.currency)],
    ['Total Expenses', money(b.kpis.expenseTotal, b.currency), money(b.prevKpis.expenseTotal, b.currency)],
    ['Net Profit', money(b.kpis.net, b.currency), money(b.prevKpis.net, b.currency)],
    ['Invoices', String(b.kpis.invoiceCount), String(b.prevKpis.invoiceCount)],
    ['Expenses', String(b.kpis.expenseCount), String(b.prevKpis.expenseCount)],
    ['Avg Order', money(b.kpis.avgOrder, b.currency), money(b.prevKpis.avgOrder, b.currency)],
    ['Collection Rate', `${b.kpis.collectionRate}%`, `${b.prevKpis.collectionRate}%`],
  ]
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'This Period', 'Previous Period']],
    body: rows,
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderCashFlow(doc: jsPDF, b: FinanceBundle, y: number): number {
  const totals = b.daily.reduce(
    (acc, d) => {
      acc.income += d.income
      acc.expense += d.expense
      return acc
    },
    { income: 0, expense: 0 }
  )
  y = sectionTitle(doc, 'Daily Cash Flow', 'Collections and expenses by day', y)
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Income', 'Expenses', 'Net']],
    body: b.daily.map((d) => [
      d.date,
      money(d.income, b.currency),
      money(d.expense, b.currency),
      money(d.net, b.currency),
    ]),
    foot: [['TOTAL', money(totals.income, b.currency), money(totals.expense, b.currency), money(b.kpis.net, b.currency)]],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderMonthly(doc: jsPDF, b: FinanceBundle, y: number): number {
  if (b.monthly.length === 0) return y
  y = sectionTitle(doc, 'Monthly Trend', 'Income vs expenses per month', y)
  autoTable(doc, {
    startY: y,
    head: [['Month', 'Income', 'Expenses', 'Net']],
    body: b.monthly.map((m) => [
      m.label,
      money(m.income, b.currency),
      money(m.expense, b.currency),
      money(m.net, b.currency),
    ]),
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderCategories(doc: jsPDF, b: FinanceBundle, y: number): number {
  const total = b.expenseByCategory.reduce((s, c) => s + c.value, 0)
  if (b.expenseByCategory.length === 0) return y
  y = sectionTitle(doc, 'Expenses by Category', `${b.expenseByCategory.length} categories  •  ${money(total, b.currency)}`, y)
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount', 'Share']],
    body: b.expenseByCategory.map((c) => [c.name.charAt(0).toUpperCase() + c.name.slice(1), money(c.value, b.currency), pct(c.value, total)]),
    foot: [['TOTAL', money(total, b.currency), '100%']],
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

function renderPaymentMethods(doc: jsPDF, b: FinanceBundle, y: number): number {
  const incTotal = b.incomeByMethod.reduce((s, m) => s + m.value, 0)
  const expTotal = b.expenseByMethod.reduce((s, m) => s + m.value, 0)
  if (incTotal === 0 && expTotal === 0) return y
  y = sectionTitle(doc, 'Payment Methods', 'How money came in and went out', y)

  autoTable(doc, {
    margin: { left: MARGIN, right: PAGE_W / 2 + 1 },
    startY: y,
    head: [['Income Method', 'Amount', 'Share']],
    body: b.incomeByMethod.map((m) => [m.name, money(m.value, b.currency), pct(m.value, incTotal)]),
    foot: [['TOTAL', money(incTotal, b.currency), '100%']],
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  const fy1 = (doc as any).lastAutoTable.finalY

  autoTable(doc, {
    margin: { left: PAGE_W / 2 + 1, right: MARGIN },
    startY: y,
    head: [['Expense Method', 'Amount', 'Share']],
    body: b.expenseByMethod.map((m) => [m.name, money(m.value, b.currency), pct(m.value, expTotal)]),
    foot: [['TOTAL', money(expTotal, b.currency), '100%']],
    headStyles: HEAD_STYLE,
    styles: BODY_STYLE,
    footStyles: FOOT_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })
  const fy2 = (doc as any).lastAutoTable.finalY

  return Math.max(fy1, fy2) + 4
}

function renderLedger(doc: jsPDF, b: FinanceBundle, y: number): number {
  const total = b.transactions.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
  y = sectionTitle(doc, 'Transaction Ledger', `${b.transactions.length} transactions  •  Net ${money(total, b.currency)}`, y)
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Reference', 'Description', 'Category', 'Method', 'Amount']],
    body: b.transactions.slice(0, 300).map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.type === 'income' ? 'Income' : 'Expense',
      tx.ref || '-',
      tx.title || '-',
      tx.category || '-',
      tx.method || '-',
      (tx.type === 'income' ? '+' : '-') + money(tx.amount, b.currency),
    ]),
    didDrawPage: (data: any) => drawFooter(doc, b, data.pageNumber),
    headStyles: HEAD_STYLE,
    styles: { ...BODY_STYLE, fontSize: 7.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const raw = String(data.cell.raw).toLowerCase()
        data.cell.styles.textColor = raw === 'income' ? [22, 163, 74] : [239, 68, 68]
      }
    },
  })
  return (doc as any).lastAutoTable.finalY + 4
}

export async function exportFinancePdf(b: FinanceBundle) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo(b.shopLogoUrl)
  const startY = kpiBoxes(doc, b.kpis, b.currency, drawHeader(doc, b, logo))

  let y = renderSummary(doc, b, startY)
  y = renderCashFlow(doc, b, y)
  y = renderMonthly(doc, b, y)
  y = renderCategories(doc, b, y)
  y = renderPaymentMethods(doc, b, y)
  renderLedger(doc, b, y)

  const name = safeFilename(`finance_${b.rangeLabel}`)
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

export function printFinance(b: FinanceBundle) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  const { kpis, currency } = b

  const kpiHtml = [
    ['Total Income', money(kpis.totalIncome, currency)],
    ['Collected', money(kpis.collected, currency)],
    ['Outstanding', money(kpis.outstanding, currency)],
    ['Total Expenses', money(kpis.expenseTotal, currency)],
    ['Net Profit', money(kpis.net, currency)],
    ['Margin', `${kpis.margin}%`],
  ]
    .map(([l, v]) => `<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div></div>`)
    .join('')

  const html = `<!DOCTYPE html><html><head><title>Finance Report — ${esc(b.shopName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; margin: 0; }
    .report-header { border-bottom: 3px solid #10b981; padding-bottom: 10px; margin-bottom: 14px; }
    .report-header h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
    .report-header .shop { font-size: 12px; color: #334155; font-weight: 600; }
    .report-header .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
    .report-header .period { color: #059669; font-weight: 600; }
    h2 { font-size: 14px; margin: 24px 0 8px; padding-left: 8px; border-left: 4px solid #10b981; color: #1e293b; }
    .kpis { display: flex; flex-wrap: wrap; gap: 8px; }
    .kpi { flex: 1 1 120px; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 6px; padding: 8px 10px; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
    .kpi-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 5px 7px; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
    td { padding: 4px 7px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    tfoot td { background: #f1f5f9; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .r { text-align: right; }
    .section { page-break-inside: auto; }
    .foot { text-align: center; color: #94a3b8; font-size: 10px; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style></head><body>
    <div class="report-header">
      <h1>Finance & Cash Flow Report</h1>
      <div class="shop">${esc(b.shopName)}</div>
      <div class="meta">Period: <span class="period">${esc(b.rangeLabel)}</span> &nbsp;|&nbsp; Generated: ${esc(b.generatedAt)}</div>
    </div>

    <div class="kpis">${kpiHtml}</div>

    <div class="section">
      <h2>Financial Summary</h2>
      ${printTableHtml(
        ['Metric', 'This Period', 'Previous Period'],
        [
          ['Total Income', money(b.kpis.totalIncome, currency), money(b.prevKpis.totalIncome, currency)],
          ['Collected', money(b.kpis.collected, currency), money(b.prevKpis.collected, currency)],
          ['Outstanding', money(b.kpis.outstanding, currency), money(b.prevKpis.outstanding, currency)],
          ['Total Expenses', money(b.kpis.expenseTotal, currency), money(b.prevKpis.expenseTotal, currency)],
          ['Net Profit', money(b.kpis.net, currency), money(b.prevKpis.net, currency)],
          ['Invoices', String(b.kpis.invoiceCount), String(b.prevKpis.invoiceCount)],
          ['Expenses', String(b.kpis.expenseCount), String(b.prevKpis.expenseCount)],
          ['Collection Rate', `${b.kpis.collectionRate}%`, `${b.prevKpis.collectionRate}%`],
        ],
        [1, 2]
      )}
    </div>

    <div class="section">
      <h2>Daily Cash Flow</h2>
      ${printTableHtml(
        ['Date', 'Income', 'Expenses', 'Net'],
        b.daily.map((d) => [d.date, money(d.income, currency), money(d.expense, currency), money(d.net, currency)]),
        [1, 2, 3]
      )}
    </div>

    <div class="section">
      <h2>Expenses by Category</h2>
      ${printTableHtml(
        ['Category', 'Amount', 'Share'],
        b.expenseByCategory.map((c) => [c.name.charAt(0).toUpperCase() + c.name.slice(1), money(c.value, currency), pct(c.value, b.expenseByCategory.reduce((s, x) => s + x.value, 0))]),
        [1, 2]
      )}
    </div>

    <div class="section">
      <h2>Transaction Ledger</h2>
      ${printTableHtml(
        ['Date', 'Type', 'Reference', 'Description', 'Category', 'Method', 'Amount'],
        b.transactions.slice(0, 200).map((tx) => [
          new Date(tx.date).toLocaleDateString(),
          tx.type === 'income' ? 'Income' : 'Expense',
          tx.ref || '-',
          tx.title || '-',
          tx.category || '-',
          tx.method || '-',
          (tx.type === 'income' ? '+' : '-') + money(tx.amount, currency),
        ]),
        [6]
      )}
    </div>

    <div class="foot">Generated by ${esc(b.shopName)} — ${esc(b.rangeLabel)} · Confidential</div>
    <script>setTimeout(function(){ window.print(); }, 300);</script>
  </body></html>`

  win.document.write(html)
  win.document.close()
}

// ─── Excel export ───

export async function exportFinanceExcel(b: FinanceBundle) {
  const xlsx = await import('xlsx')
  const wb = xlsx.utils.book_new()

  const mkSheet = (name: string, head: (string | number)[], rows: (string | number)[][]) => {
    const ws = xlsx.utils.aoa_to_sheet([head, ...rows])
    ws['!cols'] = head.map(() => ({ wch: 18 }))
    xlsx.utils.book_append_sheet(wb, ws, name)
  }

  mkSheet(
    'Summary',
    ['Metric', 'This Period', 'Previous Period'],
    [
      ['Total Income', b.kpis.totalIncome, b.prevKpis.totalIncome],
      ['Collected', b.kpis.collected, b.prevKpis.collected],
      ['Outstanding', b.kpis.outstanding, b.prevKpis.outstanding],
      ['Total Expenses', b.kpis.expenseTotal, b.prevKpis.expenseTotal],
      ['Net Profit', b.kpis.net, b.prevKpis.net],
      ['Invoices', b.kpis.invoiceCount, b.prevKpis.invoiceCount],
      ['Expenses', b.kpis.expenseCount, b.prevKpis.expenseCount],
      ['Avg Order', b.kpis.avgOrder, b.prevKpis.avgOrder],
      ['Collection Rate', `${b.kpis.collectionRate}%`, `${b.prevKpis.collectionRate}%`],
    ]
  )
  mkSheet(
    'Cash Flow',
    ['Date', 'Income', 'Expenses', 'Net'],
    b.daily.map((d) => [d.date, Math.round(d.income * 100) / 100, Math.round(d.expense * 100) / 100, Math.round(d.net * 100) / 100])
  )
  mkSheet(
    'Expenses by Category',
    ['Category', 'Amount'],
    b.expenseByCategory.map((c) => [c.name, Math.round(c.value * 100) / 100])
  )
  mkSheet(
    'Payment Methods',
    ['Direction', 'Method', 'Amount'],
    [
      ...b.incomeByMethod.map((m) => ['Income', m.name, Math.round(m.value * 100) / 100]),
      ...b.expenseByMethod.map((m) => ['Expense', m.name, Math.round(m.value * 100) / 100]),
    ]
  )
  mkSheet(
    'Transactions',
    ['Date', 'Type', 'Reference', 'Description', 'Category', 'Method', 'Amount'],
    b.transactions.map((tx) => [
      new Date(tx.date).toISOString().slice(0, 10),
      tx.type === 'income' ? 'Income' : 'Expense',
      tx.ref || '-',
      tx.title || '-',
      tx.category || '-',
      tx.method || '-',
      Math.round(tx.amount * 100) / 100,
    ])
  )

  const name = safeFilename(`finance_${b.rangeLabel}`)
  xlsx.writeFile(wb, `${name}.xlsx`)
}
