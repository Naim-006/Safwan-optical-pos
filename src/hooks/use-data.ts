'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchProducts,
  fetchProduct,
  fetchProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  fetchCustomers,
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchInvoices,
  fetchInvoice,
  fetchInvoiceItems,
  createInvoice,
  deleteInvoice,
  fetchSettings,
  saveSettings,
  fetchSalesReport,
  fetchInvoicesByDateRange,
  fetchInvoiceItemsInRange,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchMessageLogs,
  createMessageLogs,
  deleteMessageLog,
} from '@/lib/supabase/data'

// ─── Products ───

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
  }) as unknown as { data: Record<string, any> | null; isLoading: boolean }
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ['products', 'search', query],
    queryFn: () => searchProducts(query),
    enabled: query.length >= 2,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

type Row = Record<string, unknown>

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Row) => createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateProduct(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useProductByBarcode(barcode: string | null) {
  return useQuery({
    queryKey: ['products', 'barcode', barcode],
    queryFn: () => fetchProductByBarcode(barcode!),
    enabled: !!barcode,
  })
}

// ─── Customers ───

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useSearchCustomers(query: string) {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () => searchCustomers(query),
    enabled: query.length >= 2,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateCustomer(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Invoices ───

export function useInvoices(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['invoices', page, limit],
    queryFn: () => fetchInvoices(page, limit),
  }) as unknown as { data: { data: Record<string, any>[]; count: number }; isLoading: boolean }
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => fetchInvoice(id!),
    enabled: !!id,
  }) as unknown as { data: Record<string, any> | null; isLoading: boolean }
}

export function useInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice_items', invoiceId],
    queryFn: () => fetchInvoiceItems(invoiceId!),
    enabled: !!invoiceId,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoice, items }: { invoice: Record<string, unknown>; items: Record<string, unknown>[] }) =>
      createInvoice(invoice, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Invoice saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Settings ───

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  }) as unknown as { data: Record<string, any> | null; isLoading: boolean }
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    select: (data) => {
      const s = (data as any) || {}
      return {
        shopName: s.shop_name || 'Safwan Opticals',
        arName: s.ar_name || '',
        address: s.shop_address || '',
        phone: s.shop_phone || '',
        vat: s.shop_vat || '',
        website: s.shop_website || '',
        logoUrl: s.logo_url || '',
        crNumber: s.cr_number || '',
        receiptHeader: s.receipt_header || '',
        receiptFooter: s.receipt_footer || '',
        currency: s.currency || 'SAR',
      }
    },
    staleTime: 5 * 60 * 1000,
  }) as unknown as { data: ReturnType<typeof getDefaultShop>; isLoading: boolean }
}

function getDefaultShop() {
  return {
    shopName: 'Safwan Opticals',
    arName: '',
    address: 'Abdul Rahman Ibn Ahmad As Sidayri, As Salamah, Jeddah 23436',
    phone: '+966 05 0918 3807',
    vat: '310158981300003',
    website: '',
    logoUrl: '',
    crNumber: '',
    receiptHeader: '',
    receiptFooter: '',
    currency: 'SAR',
  }
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.refetchQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Reports ───

export function useSalesReport(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'sales', startDate, endDate],
    queryFn: () => fetchSalesReport(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useInvoicesByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'invoices', startDate, endDate],
    queryFn: () => fetchInvoicesByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useProductSales(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'items', startDate, endDate],
    queryFn: () => fetchInvoiceItemsInRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

// ─── Expenses ───

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: fetchExpenses,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateExpense(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Message logs ───

export function useMessageLogs() {
  return useQuery({
    queryKey: ['message_logs'],
    queryFn: fetchMessageLogs,
  }) as unknown as { data: Record<string, any>[]; isLoading: boolean }
}

export function useCreateMessageLogs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMessageLogs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_logs'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteMessageLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMessageLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_logs'] })
      toast.success('History entry removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
