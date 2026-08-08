import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'SAR'): string {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function generateBarcode(length = 12): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Array.from({ length: length - 8 }, () => Math.floor(Math.random() * 10)).join('')
  return timestamp + random
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${dateStr}-${random}`
}

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero'

  const belowTwenty = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ]
  const thousands = ['', 'Thousand', 'Million', 'Billion']

  function helper(n: number): string {
    if (n === 0) return ''
    if (n < 20) return belowTwenty[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + helper(n % 10)
    return belowTwenty[Math.floor(n / 100)] + ' Hundred ' + helper(n % 100)
  }

  let result = ''
  let i = 0
  let remaining = Math.floor(num)

  while (remaining > 0) {
    const chunk = remaining % 1000
    if (chunk !== 0) {
      result = helper(chunk) + thousands[i] + ' ' + result
    }
    remaining = Math.floor(remaining / 1000)
    i++
  }

  return result.trim()
}
