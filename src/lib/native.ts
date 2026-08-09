export const isTauri = (): boolean =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ != null

function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  return (window as any).__TAURI_INTERNALS__.invoke(cmd, args)
}

export async function saveFile(filename: string, blob: Blob): Promise<string | null> {
  if (isTauri()) {
    try {
      const buf = new Uint8Array(await blob.arrayBuffer())
      const path = (await invoke('save_file', { filename, data: Array.from(buf) })) as string
      return path
    } catch {
      return null
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return null
}

export function savePdf(doc: any, filename: string): void {
  if (isTauri()) {
    const dataUri = doc.output('datauristring') as string
    const base64 = dataUri.split(',')[1]
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    void saveFile(filename, new Blob([bytes], { type: 'application/pdf' }))
  } else {
    doc.save(filename)
  }
}

export function openPrintDoc(size: { width: number; height: number }): { doc: Document } | null {
  if (isTauri()) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = `position:fixed;top:0;left:-10000px;width:${size.width}px;height:${size.height}px;border:0;`
    document.body.appendChild(frame)
    const win = frame.contentWindow
    if (!win) {
      frame.remove()
      return null
    }
    win.addEventListener('afterprint', () => frame.remove())
    return { doc: win.document }
  }
  const win = window.open('', '', `width=${size.width},height=${size.height}`)
  if (!win) return null
  return { doc: win.document }
}