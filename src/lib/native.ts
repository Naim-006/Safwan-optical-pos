export const isTauri = (): boolean =>
  typeof window !== 'undefined' && (window as any).__TAURI__ != null

function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  return (window as any).__TAURI__.core.invoke(cmd, args)
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

export async function printHtml(html: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('print_html', { html })
    } catch (error) {
      console.error('Print failed:', error)
      throw error
    }
  } else {
    const win = window.open('', '_blank')
    if (!win) throw new Error('Failed to open print window')
    win.document.write(html)
    win.document.close()
    win.print()
  }
}

export function openPrintDoc(size: { width: number; height: number }): { doc: Document } | null {
  if (isTauri()) {
    // For Tauri, we'll use the printHtml function instead
    // This function is kept for compatibility but returns null
    return null
  }
  const win = window.open('', '', `width=${size.width},height=${size.height}`)
  if (!win) return null
  return { doc: win.document }
}