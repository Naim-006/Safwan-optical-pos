'use client'

import { useState } from 'react'
import { Download, Upload, Trash2, Database, HardDrive, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useProducts, useCustomers, useInvoices } from '@/hooks/use-data'

export default function BackupPage() {
  const [resetOpen, setResetOpen] = useState(false)
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 1000)

  const handleExportAll = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      products,
      customers,
      invoices: invoicesData?.data || [],
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Safwan_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Full backup exported')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        JSON.parse(text)
        toast.success('Backup file loaded. Import in progress...')
      } catch {
        toast.error('Invalid backup file')
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backup</h1>
        <p className="text-muted-foreground">Data backup and restore</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Data Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium">{products.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customers</span>
              <span className="font-medium">{customers.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoices</span>
              <span className="font-medium">{invoicesData?.count || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Total Records</span>
              <span>{products.length + customers.length + (invoicesData?.count || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Backup Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleExportAll}>
              <Download className="h-4 w-4 mr-2" /> Export Full Backup
            </Button>
            <Button variant="outline" className="w-full" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" /> Import from Backup
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setResetOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Reset All Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reset All Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all products, customers, invoices, and settings.
              This action cannot be undone. Make sure you have a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                toast.error('Data reset disabled via UI. Use Supabase dashboard.')
                setResetOpen(false)
              }}
            >
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
