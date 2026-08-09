const codes = new Map<string, { code: string; expires: number }>()

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function cleanupExpired() {
  const now = Date.now()
  for (const [key, val] of codes) {
    if (now > val.expires) codes.delete(key)
  }
}

export function storeCode(email: string): string {
  cleanupExpired()
  const code = generateCode()
  codes.set(email.toLowerCase(), { code, expires: Date.now() + 5 * 60 * 1000 })
  return code
}

export function verifyCode(email: string, code: string): boolean {
  cleanupExpired()
  const entry = codes.get(email.toLowerCase())
  if (!entry) return false
  if (Date.now() > entry.expires) {
    codes.delete(email.toLowerCase())
    return false
  }
  if (entry.code === code) {
    codes.delete(email.toLowerCase())
    return true
  }
  return false
}
