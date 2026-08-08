// Supabase config via Vite env vars (VITE_ prefix)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

let supabase = null
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
}

export function getSupabase() { return supabase }

export function formatCurrency(amount, currency = 'SAR') {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency }).format(Number(amount || 0))
}

export function numberToWords(num) {
  if (num === 0) return 'Zero'
  const below = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const th = ['','Thousand','Million']
  function h(n) { if (n===0) return ''; if (n<20) return below[n]+' '; if (n<100) return tens[Math.floor(n/10)]+' '+h(n%10); return below[Math.floor(n/100)]+' Hundred '+h(n%100) }
  let r='', i=0, m=Math.floor(num)
  while (m>0) { const c=m%1000; if (c) r=h(c)+th[i]+' '+r; m=Math.floor(m/1000); i++ }
  return r.trim()
}

export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-SA', { year:'numeric', month:'long', day:'numeric' })
}
