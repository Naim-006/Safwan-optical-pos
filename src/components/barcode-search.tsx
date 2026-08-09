'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanBarcode, Search, Loader2 } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface BarcodeSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onScan?: (value: string) => void
  className?: string
}

export function BarcodeSearch({
  value,
  onChange,
  placeholder = 'Search or scan barcode...',
  onScan,
  className,
}: BarcodeSearchProps) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastResultRef = useRef('')

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        await scannerRef.current.clear()
      }
    } catch {
      // ignore stop errors
    } finally {
      scannerRef.current = null
      setScanning(false)
    }
  }

  const startScanner = async () => {
    setCameraError(null)
    setScanning(true)
    lastResultRef.current = ''

    try {
      const scanner = new Html5Qrcode('barcode-scanner-region')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (lastResultRef.current === decodedText) return
          lastResultRef.current = decodedText
          handleScanned(decodedText)
        },
        () => {},
      )
    } catch (err: any) {
      console.error('Scanner start failed:', err)
      setCameraError(
        err?.message?.includes('NotAllowed')
          ? 'Camera permission denied. Please allow camera access.'
          : 'Could not start camera. Please allow camera access and try again.',
      )
      setScanning(false)
    }
  }

  const handleScanned = (decodedText: string) => {
    const clean = decodedText.trim()
    onChange(clean)
    onScan?.(clean)
    toast.success('Barcode captured')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) {
      stopScanner()
    } else {
      startScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-9 pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setOpen(true)}
          title="Scan barcode"
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>
              Point your camera at the barcode to search automatically, or type below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Type barcode or search text..."
                className="pl-9 pr-3"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onScan?.(value)
                    setOpen(false)
                  }
                }}
              />
            </div>

            <div
              id="barcode-scanner-region"
              className="w-full overflow-hidden rounded-lg border bg-black/5"
              style={{ minHeight: 250 }}
            >
              {scanning && (
                <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                  <p>Starting camera...</p>
                </div>
              )}
              {!scanning && cameraError && (
                <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-sm text-destructive">{cameraError}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
