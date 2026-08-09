'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Plus, Search, Trash2, Edit, Download, Upload, Package, Save,
  Printer, Barcode, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import JsBarcode from 'jsbarcode'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { openPrintDoc, saveFile } from '@/lib/native'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { productSchema, type ProductInput } from '@/lib/validators'
import { generateBarcode, formatCurrency } from '@/lib/utils'
import {
  useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useShopSettings,
} from '@/hooks/use-data'
import type { Product } from '@/types/database'
import { useLang } from '@/contexts/lang-provider'

type ProdRow = Record<string, any>

const CATEGORIES = ['Frames', 'Lenses', 'Glasses', 'Contact Lenses', 'Accessories', 'Solutions', 'Other']
const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProdRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProdRow | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<ProdRow | null>(null)
  const [pendingProduct, setPendingProduct] = useState<ProductInput | null>(null)
  const [sortBy, setSortBy] = useState<string>('newest')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set())
  const { t } = useLang()
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null)

  const { data: products = [], isLoading } = useProducts()
  const { data: shop } = useShopSettings()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', barcode: generateBarcode(), price: 0, quantity: 0, category: '' },
  })

  const watchedBarcode = watch('barcode')

  useEffect(() => {
    if (barcodeCanvasRef.current && watchedBarcode) {
      try {
        JsBarcode(barcodeCanvasRef.current, String(watchedBarcode), {
          format: 'CODE128',
          lineColor: '#000',
          width: 1.6,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 5,
        })
      } catch { /* invalid barcode, ignore */ }
    }
  }, [watchedBarcode])

  useEffect(() => {
    if (editingProduct) {
      setValue('name', editingProduct.name)
      setValue('barcode', editingProduct.barcode)
      setValue('price', editingProduct.price)
      setValue('quantity', editingProduct.quantity)
      setValue('category', editingProduct.category || '')
    } else {
      const newBarcode = generateBarcode()
      reset({ name: '', barcode: newBarcode, price: 0, quantity: 0, category: '' })
    }
  }, [editingProduct, dialogOpen, setValue, reset])

  const checkDuplicate = useCallback((name: string, category: string) => {
    if (!name || !category) return null
    const nameLower = name.trim().toLowerCase()
    return products.find(
      (p) => p.name.toLowerCase() === nameLower && p.category === category
    ) || null
  }, [products])

  // Filter and sort
  const filtered = products
    .filter((p) => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'price-high': return b.price - a.price
        case 'price-low': return a.price - b.price
        case 'quantity-high': return b.quantity - a.quantity
        case 'quantity-low': return a.quantity - b.quantity
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const onSubmit = (data: ProductInput) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, updates: data })
      setDialogOpen(false)
      setEditingProduct(null)
      return
    }

    // Check for duplicate by name + category
    const dup = checkDuplicate(data.name, data.category || '')
    if (dup) {
      setPendingProduct(data)
      setDuplicateTarget(dup)
      return
    }

    createMutation.mutate(data)
    setDialogOpen(false)
    setEditingProduct(null)
  }

  const handleUpdateStock = () => {
    if (!duplicateTarget || !pendingProduct) return
    const newQty = Number(duplicateTarget.quantity) + Number(pendingProduct.quantity)
    updateMutation.mutate({
      id: duplicateTarget.id,
      updates: {
        quantity: newQty,
        price: pendingProduct.price || duplicateTarget.price,
      },
    })
    toast.success(`Stock updated for ${duplicateTarget.name}: ${duplicateTarget.quantity} → ${newQty}`)
    setDuplicateTarget(null)
    setPendingProduct(null)
    setDialogOpen(false)
    setEditingProduct(null)
  }

  const handleAddAnyway = () => {
    if (!pendingProduct) return
    createMutation.mutate({ ...pendingProduct, barcode: generateBarcode() })
    setDuplicateTarget(null)
    setPendingProduct(null)
    setDialogOpen(false)
    setEditingProduct(null)
  }

  // ─── Barcode label printing ───
  const printBarcodeLabels = (productList: ProdRow[]) => {
    const printWindow = window.open('', '', 'width=900,height=700')
    if (!printWindow) return

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Barcode Labels</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; background: #fff; }
      .labels { display: flex; flex-wrap: wrap; gap: 0; }
      .sticker {
        width: 50mm;
        padding: 2mm;
        text-align: center;
        border: 1px solid #ccc;
        page-break-inside: avoid;
      }
      .shop {
        font-size: 6.5pt;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #111;
        margin-bottom: 0.8mm;
      }
      .name {
        font-size: 6.5pt;
        font-weight: 600;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #111;
        margin-bottom: 1.5mm;
      }
      .bc-wrap {
        display: inline-block;
        padding: 1mm 0;
      }
      .bc-wrap canvas {
        width: 43mm;
        height: 12mm;
        display: block;
        margin: 0 auto;
      }
      .price {
        font-size: 6.5pt;
        font-weight: 600;
        color: #111;
        margin-top: 1.5mm;
      }
      @media print {
        body { margin: 0; padding: 0; }
        .sticker { border-color: #999; }
      }
    </style></head><body><div class="labels">`)

    productList.forEach((product) => {
      const canvas = document.createElement('canvas')
      try {
        JsBarcode(canvas, String(product.barcode), {
          format: 'CODE128',
          lineColor: '#000',
          width: 1.4,
          height: 35,
          displayValue: true,
          fontSize: 9,
          margin: 4,
          background: '#ffffff',
        })
      } catch { /* skip invalid */ }
      const img = canvas.toDataURL('image/png')

      printWindow.document.write(`
        <div class="sticker">
          <div class="shop">${shop?.shopName || 'Safwan Opticals'}</div>
          <div class="name">${product.name}</div>
          <div class="bc-wrap">
            <img src="${img}" alt="barcode" />
          </div>
          <div class="price">Price: ${Number(product.price).toFixed(2)} SAR</div>
        </div>
      `)
    })

    printWindow.document.write('</div><script>window.onload=function(){window.print();window.close();}<\/script></body></html>')
    printWindow.document.close()
    toast.success(`Printing ${productList.length} labels`)
  }

  const handlePrintSingle = (product: ProdRow) => {
    printBarcodeLabels([product])
  }

  const handlePrintSelected = () => {
    const selected = products.filter((p) => selectedForPrint.has(p.id))
    if (selected.length === 0) {
      toast.error('Select products to print')
      return
    }
    printBarcodeLabels(selected)
    setSelectedForPrint(new Set())
  }

  const handlePrintAll = () => {
    if (products.length === 0) {
      toast.error('No products to print')
      return
    }
    printBarcodeLabels(products)
  }

  const toggleSelect = (id: string) => {
    setSelectedForPrint((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedForPrint.size === paginated.length) {
      setSelectedForPrint(new Set())
    } else {
      setSelectedForPrint(new Set(paginated.map((p) => p.id)))
    }
  }

  const handleExport = () => {
    const json = JSON.stringify(products, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${products.length} products exported`)
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
        const items = JSON.parse(text)
        if (!Array.isArray(items)) throw new Error('Invalid format')
        let count = 0
        for (const item of items) {
          try {
            await createMutation.mutateAsync(item)
            count++
          } catch {}
        }
        toast.success(`Imported ${count} products`)
      } catch {
        toast.error('Invalid import file')
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('inventory.title')}</h1>
          <p className="text-muted-foreground">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedForPrint.size > 0 && (
            <Button variant="secondary" size="sm" onClick={handlePrintSelected}>
              <Printer className="h-4 w-4 mr-2" /> Print Selected ({selectedForPrint.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handlePrintAll}>
            <Printer className="h-4 w-4 mr-2" /> Print All
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { setEditingProduct(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or barcode..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="price-high">Price: High</SelectItem>
                <SelectItem value="price-low">Price: Low</SelectItem>
                <SelectItem value="quantity-high">Stock: High</SelectItem>
                <SelectItem value="quantity-low">Stock: Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No products found</p>
              <p className="text-sm">{search ? 'Try a different search' : 'Add your first product'}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block scroll-x -mx-1 px-1">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedForPrint.size === paginated.length && paginated.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-[110px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedForPrint.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.category ? (
                            <Badge variant="secondary">{product.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={product.quantity === 0 ? 'destructive' : product.quantity < 5 ? 'secondary' : 'outline'}>
                            {product.quantity === 0 ? 'Out' : product.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" title="Print barcode label" onClick={() => handlePrintSingle(product)}>
                              <Barcode className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setDialogOpen(true) }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(product)}>
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
              <div className="md:hidden space-y-3">
                {paginated.map((product) => (
                  <div key={product.id} className="rounded-xl border p-3.5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="rounded mt-1 shrink-0"
                        checked={selectedForPrint.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <span className="font-bold text-sm shrink-0">{formatCurrency(product.price)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {product.category ? <Badge variant="secondary">{product.category}</Badge> : null}
                          <Badge variant={product.quantity === 0 ? 'destructive' : product.quantity < 5 ? 'secondary' : 'outline'}>
                            {product.quantity === 0 ? 'Out of stock' : `Stock: ${product.quantity}`}
                          </Badge>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground mt-1.5 truncate">{product.barcode}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 mt-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handlePrintSingle(product)}>
                        <Barcode className="h-3.5 w-3.5 mr-1" /> Label
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setEditingProduct(product); setDialogOpen(true) }}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDeleteTarget(product)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Show
                    <Select value={String(perPage)} onValueChange={(v) => { if (v) { setPerPage(Number(v)); setPage(1) } }}>
                      <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    of {filtered.length}
                  </div>
                  <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(0, Math.min(page - 3, totalPages - 5))
                      const p = start + i + 1
                      return (
                        <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}>{p}</Button>
                      )
                    })}
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                onValueChange={(v) => { if (v) setValue('category', v as string) }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input id="barcode" {...register('barcode')} className="pr-10" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setValue('barcode', generateBarcode())}
                    title="Generate new barcode"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <canvas ref={barcodeCanvasRef} className="w-full h-10 mt-1" />
              <p className="text-xs text-muted-foreground">Auto-generated — click <RefreshCw className="h-3 w-3 inline" /> to refresh</p>
              {errors.barcode && <p className="text-sm text-destructive">{errors.barcode.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (SAR)</Label>
                <Input id="price" type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" {...register('quantity', { valueAsNumber: true })} />
                {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingProduct(null) }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProduct ? 'Update' : 'Add'} Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Detection Dialog */}
      <AlertDialog open={!!duplicateTarget} onOpenChange={() => { setDuplicateTarget(null); setPendingProduct(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Duplicate Product Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A product with the same name and category already exists:
              </p>
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="font-medium">{duplicateTarget?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Category: {duplicateTarget?.category || 'None'} &middot;
                  Current Stock: {duplicateTarget?.quantity} &middot;
                  Price: {formatCurrency(duplicateTarget?.price || 0)}
                </p>
              </div>
              <p>Would you like to update the existing product&apos;s stock instead?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddAnyway} className="bg-muted text-foreground hover:bg-muted/80">
              Add as New Anyway
            </AlertDialogAction>
            <AlertDialogAction onClick={handleUpdateStock}>
              Update Stock (+{pendingProduct?.quantity || 0})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
