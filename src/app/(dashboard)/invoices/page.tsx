'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, Trash2, Eye, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useInvoices, useDeleteInvoice } from '@/hooks/use-data'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { saveFile } from '@/lib/native'
import { useLang } from '@/contexts/lang-provider'
import { BarcodeSearch } from '@/components/barcode-search'

type InvRow = Record<string, any>

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  unpaid: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InvRow | null>(null)
  const { t } = useLang()

  const { data, isLoading } = useInvoices(page, 20)
  const deleteMutation = useDeleteInvoice()
  const invoices = (data?.data || []).filter((inv: any) => inv.invoice_type !== 'receipt')
  const total = data?.count || 0
  const totalPages = Math.ceil(total / 20)

  const filtered = invoices.filter((inv) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
      (inv.customer_phone && inv.customer_phone.includes(q))
    )
  })

  const exportCSV = () => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Phone', 'Total', 'Status', 'Type']
    const rows = invoices.map((inv) => [
      inv.invoice_number,
      new Date(inv.created_at).toLocaleDateString(),
      inv.customer_name || '',
      inv.customer_phone || '',
      inv.total_amount,
      inv.payment_status,
      inv.invoice_type,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-3 pb-20 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-2xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">{t('invoices.subtitle')}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 text-xs" onClick={exportCSV}>
            <Download className="h-3 w-3 mr-1.5" /> Export
          </Button>
          <Button className="flex-1 sm:flex-none h-8 text-xs" onClick={() => window.location.href = '/invoices/new'}>
            <Plus className="h-3 w-3 mr-1.5" /> New
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 px-3">
          <BarcodeSearch
            value={search}
            onChange={setSearch}
            placeholder="Search invoices..."
            onScan={(val) => setSearch(val)}
          />
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No invoices found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block scroll-x -mx-1 px-1">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium text-sm">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{inv.customer_name || 'Walk-in'}</p>
                            {inv.customer_phone && (
                              <p className="text-xs text-muted-foreground">{inv.customer_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {inv.invoice_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(inv.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[inv.payment_status] || ''}>
                            {inv.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.location.href = `/invoices/${inv.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(inv)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filtered.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => window.location.href = `/invoices/${inv.id}`}
                    className="rounded-lg border p-2.5 active:bg-accent/50 transition-colors cursor-pointer touch-manipulation"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-xs truncate">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {inv.customer_name || 'Walk-in'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[9px] shrink-0">
                        {inv.invoice_type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <Badge className={cn(statusColors[inv.payment_status] || '', 'text-[9px]')}>
                          {inv.payment_status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{formatCurrency(inv.total_amount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv) }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-8">
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="h-8">
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Delete invoice {deleteTarget?.invoice_number}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              setDeleteTarget(null)
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
