// Supabase config - uses the same anon key (safe for public read)
const SUPABASE_URL = 'https://khmcpzpdciaybnbxmuam.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtobWNwenBkY2lheWJuYnhtdWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNTMwNTQsImV4cCI6MjEwMTcyOTA1NH0.HnPhw5ziR6qRPKqb2ClgWBoGumS_xTFdUfqWUZFkNis'

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Helpers ───
function formatCurrency(amount, currency = 'SAR') {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency }).format(Number(amount || 0))
}

function numberToWords(num) {
  if (num === 0) return 'Zero'
  const below = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const th = ['','Thousand','Million']
  function h(n) { if (n===0) return ''; if (n<20) return below[n]+' '; if (n<100) return tens[Math.floor(n/10)]+' '+h(n%10); return below[Math.floor(n/100)]+' Hundred '+h(n%100) }
  let r='',i=0,m=Math.floor(num)
  while(m>0){ const c=m%1000; if(c) r=h(c)+th[i]+' '+r; m=Math.floor(m/1000); i++ }
  return r.trim()
}

function formatDate(d) { return new Date(d).toLocaleDateString('en-SA', { year:'numeric', month:'long', day:'numeric' }) }

// ─── Fetch invoice ───
async function loadInvoice(id) {
  if (!supabase || !id) { showError('Invoice ID missing'); return }

  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (error || !invoice) { showError('Invoice not found'); return }

  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)

  // Fetch shop settings for header
  let shopName = 'Safwan Opticals'
  try {
    const { data: settings } = await supabase.from('settings').select('*').limit(1).single()
    if (settings) shopName = settings.shop_name || shopName
  } catch {}

  renderInvoice(invoice, items || [], shopName)
}

// ─── Render ───
function renderInvoice(inv, items, shopName) {
  const isReceipt = inv.invoice_type === 'receipt'
  const isOptical = inv.right_sphere != null || inv.invoice_type === 'optical'
  const container = document.getElementById('invoice-container')

  container.innerHTML = `
    <div class="invoice-card">
      <!-- Header -->
      <div class="header">
        <div class="shop-name">${shopName}</div>
        <div class="shop-address">Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436</div>
        <div class="shop-address ar">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>
        <div class="shop-meta">VAT: 300833099900003 | Tel: +966 05 0918 3807</div>
      </div>

      <!-- Status Badge -->
      <div class="status-row">
        <span class="doc-type">${isReceipt ? 'Receipt Voucher / سند قبض' : 'Invoice'}</span>
        <span class="status-badge ${inv.payment_status}">${inv.payment_status.toUpperCase()}</span>
      </div>

      <!-- Invoice Info -->
      <div class="info-grid">
        <div class="info-item">
          <span class="label">${isReceipt ? 'Receipt' : 'Invoice'} #</span>
          <span class="value">${inv.invoice_number}</span>
        </div>
        <div class="info-item">
          <span class="label">Date</span>
          <span class="value">${formatDate(inv.created_at)}</span>
        </div>
        <div class="info-item">
          <span class="label">Customer</span>
          <span class="value">${inv.customer_name || 'Walk-in'}</span>
        </div>
        ${inv.customer_phone ? `<div class="info-item"><span class="label">Phone</span><span class="value">${inv.customer_phone}</span></div>` : ''}
        ${inv.payment_method ? `<div class="info-item"><span class="label">Method</span><span class="value">${inv.payment_method.toUpperCase()}</span></div>` : ''}
        <div class="info-item">
          <span class="label">Status</span>
          <span class="value" style="color:${inv.payment_status==='paid'?'#16a34a':'#dc2626'}">${inv.payment_status.toUpperCase()}</span>
        </div>
      </div>

      ${isOptical ? `
      <!-- Prescription -->
      <div class="section rx-section">
        <h3>Optical Prescription</h3>
        ${inv.eye_type ? `<div class="rx-meta"><span>Eye Type:</span> ${inv.eye_type}</div>` : ''}
        ${inv.lens_type ? `<div class="rx-meta"><span>Lens Type:</span> ${inv.lens_type}</div>` : ''}
        ${inv.right_sphere != null ? `
        <table class="rx-table">
          <thead><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr></thead>
          <tbody>
            <tr class="rx-od"><td>OD (Right)</td><td>${inv.right_sphere??'-'}</td><td>${inv.right_cylinder??'-'}</td><td>${inv.right_axis??'-'}</td><td>${inv.right_add??'-'}</td></tr>
            <tr class="rx-os"><td>OS (Left)</td><td>${inv.left_sphere??'-'}</td><td>${inv.left_cylinder??'-'}</td><td>${inv.left_axis??'-'}</td><td>${inv.left_add??'-'}</td></tr>
          </tbody>
        </table>` : ''}
        ${inv.ipd ? `<div class="rx-ipd">IPD: ${inv.ipd} mm</div>` : ''}
      </div>` : ''}

      <!-- Items -->
      <div class="section">
        <h3>${isReceipt ? 'Details' : 'Items'}</h3>
        <table class="items-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${i.description}</td><td class="center">${i.quantity}</td><td class="right">${formatCurrency(i.unit_price)}</td><td class="right">${formatCurrency(i.total_price)}</td></tr>`).join('')}</tbody>
        </table>
        ${(!isReceipt || items.length === 0) && items.length === 0 && inv.notes ? `<p class="item-desc">${inv.notes}</p>` : ''}
      </div>

      <!-- Totals -->
      <div class="totals">
        ${!isReceipt ? `
        <div class="total-row"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
        ${Number(inv.discount) > 0 ? `<div class="total-row"><span>Discount</span><span>-${formatCurrency(inv.discount)}</span></div>` : ''}
        <div class="total-row grand"><span>Total</span><span>${formatCurrency(inv.total_amount)}</span></div>
        <div class="total-row"><span>Amount Paid</span><span style="color:#2563eb">${formatCurrency(inv.amount_paid)}</span></div>
        ${Number(inv.balance_due) > 0 ? `<div class="total-row"><span>Balance Due</span><span style="color:#dc2626">${formatCurrency(inv.balance_due)}</span></div>` : ''}
        ` : `
        <div class="total-row grand"><span>Amount</span><span>${formatCurrency(inv.total_amount)}</span></div>
        `}
      </div>

      ${!isReceipt ? `<div class="amount-words">Amount in words: ${numberToWords(Math.floor(inv.total_amount))} Saudi Riyals</div>` : ''}

      ${inv.notes ? `<div class="notes"><span>Notes:</span> ${inv.notes}</div>` : ''}

      <!-- Footer -->
      <div class="footer">
        <div>Verified digitally | Safwan Opticals</div>
        <div class="ar-footer">تم التحقق رقمياً | صفوان للبصريات</div>
      </div>
    </div>
  `
  document.getElementById('loading').style.display = 'none'
  container.style.display = 'block'
}

function showError(msg) {
  document.getElementById('loading').style.display = 'none'
  document.getElementById('error-container').style.display = 'block'
  document.getElementById('error-msg').textContent = msg
}
