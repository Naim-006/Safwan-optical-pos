// Supabase config — replace with your project URL and anon key
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_KEY = 'YOUR_ANON_KEY'

let supabase = null
try {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  }
} catch (e) {
  console.error('Supabase init error:', e)
}

function formatCurrency(amount, currency) {
  currency = currency || 'SAR'
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: currency }).format(Number(amount || 0))
}

function numberToWords(num) {
  if (num === 0) return 'Zero'
  var below = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  var th = ['','Thousand','Million']
  function h(n) { if (n===0) return ''; if (n<20) return below[n]+' '; if (n<100) return tens[Math.floor(n/10)]+' '+h(n%10); return below[Math.floor(n/100)]+' Hundred '+h(n%100) }
  var r='', i=0, m=Math.floor(num)
  while (m>0) { var c=m%1000; if (c) r=h(c)+th[i]+' '+r; m=Math.floor(m/1000); i++ }
  return r.trim()
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-SA', { year:'numeric', month:'long', day:'numeric' })
}

async function loadInvoice(id) {
  if (!supabase) { showError('System unavailable. Please try later.'); return }
  if (!id) { showError('No invoice ID provided'); return }

  var result = await supabase.from('invoices').select('*').eq('id', id).single()
  if (result.error) {
    console.error('Supabase error:', result.error)
    showError(result.error.code === 'PGRST116' ? 'Invoice not found' : 'Unable to load invoice. ' + result.error.message)
    return
  }
  if (!result.data) { showError('Invoice not found. It may have been deleted.'); return }

  var invoice = result.data
  var itemsResult = await supabase.from('invoice_items').select('*').eq('invoice_id', id)

  var shopName = 'Safwan Opticals'
  try {
    var settingsResult = await supabase.from('settings').select('*').limit(1).single()
    if (settingsResult.data) shopName = settingsResult.data.shop_name || shopName
  } catch (e) {}

  renderInvoice(invoice, itemsResult.data || [], shopName)
}

function renderInvoice(inv, items, shopName) {
  var isReceipt = inv.invoice_type === 'receipt'
  var isOptical = inv.right_sphere != null || inv.invoice_type === 'optical'
  var container = document.getElementById('invoice-container')

  container.innerHTML =
    '<div class="invoice-card">' +
      '<div class="header">' +
        '<div class="shop-name">' + shopName + '</div>' +
        '<div class="shop-address">Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436</div>' +
        '<div class="shop-address ar">عبد الرحمن بن أحمد السديري، السلامة، جدة</div>' +
        '<div class="shop-meta">VAT: 300833099900003 | Tel: +966 05 0918 3807</div>' +
      '</div>' +
      '<div class="status-row">' +
        '<span class="doc-type">' + (isReceipt ? 'Receipt Voucher / سند قبض' : 'Invoice') + '</span>' +
        '<span class="status-badge ' + inv.payment_status + '">' + inv.payment_status.toUpperCase() + '</span>' +
      '</div>' +
      '<div class="info-grid">' +
        '<div class="info-item"><span class="label">' + (isReceipt ? 'Receipt' : 'Invoice') + ' #</span><span class="value">' + inv.invoice_number + '</span></div>' +
        '<div class="info-item"><span class="label">Date</span><span class="value">' + formatDate(inv.created_at) + '</span></div>' +
        '<div class="info-item"><span class="label">Customer</span><span class="value">' + (inv.customer_name || 'Walk-in') + '</span></div>' +
        (inv.customer_phone ? '<div class="info-item"><span class="label">Phone</span><span class="value">' + inv.customer_phone + '</span></div>' : '') +
        (inv.payment_method ? '<div class="info-item"><span class="label">Method</span><span class="value">' + inv.payment_method.toUpperCase() + '</span></div>' : '') +
        '<div class="info-item"><span class="label">Status</span><span class="value" style="color:' + (inv.payment_status==='paid'?'#16a34a':'#dc2626') + '">' + inv.payment_status.toUpperCase() + '</span></div>' +
      '</div>'

  if (isOptical) {
    container.innerHTML += '<div class="section rx-section"><h3>Optical Prescription</h3>'
    if (inv.eye_type) container.innerHTML += '<div class="rx-meta"><span>Eye Type:</span> ' + inv.eye_type + '</div>'
    if (inv.lens_type) container.innerHTML += '<div class="rx-meta"><span>Lens Type:</span> ' + inv.lens_type + '</div>'
    if (inv.right_sphere != null) {
      container.innerHTML +=
        '<table class="rx-table"><thead><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th></tr></thead><tbody>' +
        '<tr class="rx-od"><td>OD (Right)</td><td>' + (inv.right_sphere??'-') + '</td><td>' + (inv.right_cylinder??'-') + '</td><td>' + (inv.right_axis??'-') + '</td><td>' + (inv.right_add??'-') + '</td></tr>' +
        '<tr class="rx-os"><td>OS (Left)</td><td>' + (inv.left_sphere??'-') + '</td><td>' + (inv.left_cylinder??'-') + '</td><td>' + (inv.left_axis??'-') + '</td><td>' + (inv.left_add??'-') + '</td></tr>' +
        '</tbody></table>'
    }
    if (inv.ipd) container.innerHTML += '<div class="rx-ipd">IPD: ' + inv.ipd + ' mm</div>'
    container.innerHTML += '</div>'
  }

  var itemsHTML = '<div class="section"><h3>' + (isReceipt ? 'Details' : 'Items') + '</h3>'
  if (items.length > 0) {
    itemsHTML += '<table class="items-table"><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>'
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      itemsHTML += '<tr><td>' + item.description + '</td><td class="center">' + item.quantity + '</td><td class="right">' + formatCurrency(item.unit_price) + '</td><td class="right">' + formatCurrency(item.total_price) + '</td></tr>'
    }
    itemsHTML += '</tbody></table>'
  } else if (inv.notes) {
    itemsHTML += '<p class="item-desc">' + inv.notes + '</p>'
  }
  itemsHTML += '</div>'
  container.innerHTML += itemsHTML

  var totalsHTML = '<div class="totals">'
  if (!isReceipt) {
    totalsHTML += '<div class="total-row"><span>Subtotal</span><span>' + formatCurrency(inv.subtotal) + '</span></div>'
    if (Number(inv.discount) > 0) totalsHTML += '<div class="total-row"><span>Discount</span><span>-' + formatCurrency(inv.discount) + '</span></div>'
    totalsHTML += '<div class="total-row grand"><span>Total</span><span>' + formatCurrency(inv.total_amount) + '</span></div>'
    totalsHTML += '<div class="total-row"><span>Amount Paid</span><span style="color:#2563eb">' + formatCurrency(inv.amount_paid) + '</span></div>'
    if (Number(inv.balance_due) > 0) totalsHTML += '<div class="total-row"><span>Balance Due</span><span style="color:#dc2626">' + formatCurrency(inv.balance_due) + '</span></div>'
  } else {
    totalsHTML += '<div class="total-row grand"><span>Amount</span><span>' + formatCurrency(inv.total_amount) + '</span></div>'
  }
  totalsHTML += '</div>'
  container.innerHTML += totalsHTML

  if (!isReceipt) {
    container.innerHTML += '<div class="amount-words">Amount in words: ' + numberToWords(Math.floor(inv.total_amount)) + ' Saudi Riyals</div>'
  }

  if (inv.notes) {
    container.innerHTML += '<div class="notes"><span>Notes:</span> ' + inv.notes + '</div>'
  }

  container.innerHTML +=
    '<div class="footer">' +
      '<div>Verified digitally | Safwan Opticals</div>' +
      '<div class="ar-footer">تم التحقق رقمياً | صفوان للبصريات</div>' +
    '</div>' +
    '</div>'

  document.getElementById('loading').style.display = 'none'
  container.style.display = 'block'
}

function showError(msg) {
  document.getElementById('loading').style.display = 'none'
  document.getElementById('error-container').style.display = 'block'
  document.getElementById('error-msg').textContent = msg
}
