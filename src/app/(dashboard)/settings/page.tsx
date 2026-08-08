'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save, Store, Phone, Globe, FileText, Languages,
  Lock, Key, HardDrive, Download, Upload, Database,
  AlertTriangle, User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { settingsSchema, type SettingsInput } from '@/lib/validators'
import {
  useSettings, useSaveSettings, useProducts, useCustomers, useInvoices,
} from '@/hooks/use-data'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'

export default function SettingsPage() {
  const { lang, setLang, t } = useLang()
  const [resetOpen, setResetOpen] = useState(false)

  const { data: existingSettings } = useSettings()
  const saveMutation = useSaveSettings()
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 1000)

  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  const {
    register, handleSubmit, setValue,
  } = useForm<any>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      shopName: 'Safwan Opticals',
      currency: 'SAR',
      language: 'en',
      shopAddress: '',
      shopPhone: '',
      shopVat: '',
      shopWebsite: '',
      receiptHeader: '',
      receiptFooter: '',
    },
  })

  // Password change form
  const {
    register: regPassword, handleSubmit: handlePassSubmit, reset: resetPass,
    formState: { errors: passErrors },
  } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (existingSettings) {
      const s = existingSettings as any
      setValue('shopName', s.shop_name || 'Safwan Opticals')
      setValue('shopAddress', s.shop_address || '')
      setValue('shopPhone', s.shop_phone || '')
      setValue('shopVat', s.shop_vat || '')
      setValue('shopWebsite', s.shop_website || '')
      setValue('receiptHeader', s.receipt_header || '')
      setValue('receiptFooter', s.receipt_footer || '')
      setValue('currency', s.currency || 'SAR')
      setValue('language', s.language || 'en')
    }
  }, [existingSettings, setValue])

  const onShopSubmit = (data: any) => {
    saveMutation.mutate({
      shop_name: data.shopName,
      shop_address: data.shopAddress || null,
      shop_phone: data.shopPhone || null,
      shop_vat: data.shopVat || null,
      shop_website: data.shopWebsite || null,
      receipt_header: data.receiptHeader || null,
      receipt_footer: data.receiptFooter || null,
      currency: data.currency,
      language: data.language || lang,
    })
  }

  const onChangePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (!supabase) { toast.error('Not connected'); return }
    const { error } = await supabase.auth.updateUser({ password: data.newPassword })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password changed')
      resetPass()
    }
  }

  const changeLanguage = (l: 'en' | 'ar') => {
    setLang(l)
    setValue('language', l)
    saveMutation.mutate({ shop_name: 'Safwan Opticals', language: l })
  }

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
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        JSON.parse(text)
        toast.success('Backup file validated. Import via Supabase dashboard.')
      } catch { toast.error('Invalid backup file') }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="shop" className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Shop</TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Account</TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> Language</TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Backup</TabsTrigger>
        </TabsList>

        {/* Shop Tab */}
        <TabsContent value="shop">
          <form onSubmit={handleSubmit(onShopSubmit)} className="space-y-6">
            <Card className="border-t-2 border-t-blue-500">
              <CardHeader>
                <CardTitle>Shop Information</CardTitle>
                <CardDescription>Your business details shown on invoices and receipts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input {...register('shopName')} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea rows={2} {...register('shopAddress')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input {...register('shopPhone')} />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT Number</Label>
                    <Input {...register('shopVat')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input {...register('shopWebsite')} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select onValueChange={(v) => v && setValue('currency', v)}>
                    <SelectTrigger><SelectValue placeholder="SAR" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Receipt Header</Label>
                  <Textarea rows={2} {...register('receiptHeader')} />
                </div>
                <div className="space-y-2">
                  <Label>Receipt Footer</Label>
                  <Textarea rows={2} {...register('receiptFooter')} />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save Shop Settings
                </Button>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card className="border-t-2 border-t-purple-500">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePassSubmit(onChangePassword)} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" {...regPassword('currentPassword', { required: 'Required' })} />
                  {passErrors.currentPassword && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" {...regPassword('newPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} />
                  {passErrors.newPassword && <p className="text-xs text-destructive">{passErrors.newPassword.message as string}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" {...regPassword('confirmPassword', { required: 'Required' })} />
                </div>
                <Button type="submit">
                  <Key className="h-4 w-4 mr-2" /> Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language">
          <Card className="border-t-2 border-t-emerald-500">
            <CardHeader>
              <CardTitle>Language & Direction</CardTitle>
              <CardDescription>Switch between English and Arabic interfaces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  type="button"
                  onClick={() => changeLanguage('en')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${lang === 'en' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-emerald-200'}`}
                >
                  <span className="text-2xl block mb-1">EN</span>
                  <span className="text-sm font-medium">English</span>
                  <span className="text-xs text-muted-foreground block mt-1">Left to Right</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeLanguage('ar')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${lang === 'ar' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-emerald-200'}`}
                >
                  <span className="text-2xl block mb-1">العربية</span>
                  <span className="text-sm font-medium">Arabic</span>
                  <span className="text-xs text-muted-foreground block mt-1">Right to Left</span>
                </button>
              </div>
              {lang === 'ar' && (
                <p className="text-sm text-muted-foreground mt-2">
                  تم تغيير اللغة إلى العربية. سيتم تطبيق التغيير على الفور.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-t-2 border-t-orange-500">
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

              <Card className="border-t-2 border-t-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" /> Backup Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={handleExportAll}>
                    <Download className="h-4 w-4 mr-2" /> Export Full Backup (JSON)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" /> Import from Backup
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => setResetOpen(true)}>
                    <AlertTriangle className="h-4 w-4 mr-2" /> Reset All Data
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                  Export a backup first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive" onClick={() => {
                  toast.error('Use Supabase dashboard to reset data')
                  setResetOpen(false)
                }}>
                  Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
