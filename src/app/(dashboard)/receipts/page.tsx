'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, Plus, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { useLang } from '@/contexts/lang-provider'
import { BarcodeSearch } from '@/components/barcode-search'

export default function ReceiptsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const { t } = useLang()

  const { data, isLoading } = useInvoices(page, 50)
  const deleteMutation = useDeleteInvoice()

  const receipts = (data?.data || []).filter((inv: any) =>
    inv.invoice_type === 'receipt' || inv.invoice_type === 'pos'
  )

  const filtered = receipts.filter((inv: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (inv.invoice_number?.toLowerCase().includes(q) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(q)))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('receipts.title')}</h1>
          <p className="text-muted-foreground">{t('receipts.subtitle')}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => router.push('/receipts/new')}>
          <Plus className="h-4 w-4 mr-2" /> New Receipt
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <BarcodeSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by receipt #, customer or scan barcode..."
            onScan={(val) => setSearch(val)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No receipts found</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block scroll-x -mx-1 px-1">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{inv.customer_name || 'Walk-in'}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'}>
                            {inv.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/receipts/${inv.id}`)}>
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

              <div className="md:hidden space-y-3">
                {filtered.map((inv: any) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/receipts/${inv.id}`)}
                    className="rounded-xl border p-3.5 active:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-sm truncate">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{inv.customer_name || 'Walk-in'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatCurrency(inv.total_amount)}</p>
                        <Badge variant={inv.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px]">
                          {inv.payment_status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv) }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Delete receipt {deleteTarget?.invoice_number}? This cannot be undone.
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
