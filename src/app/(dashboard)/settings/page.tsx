'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  Save, Store, Phone, Globe, FileText, Languages,
  Lock, Key, HardDrive, Download, Upload, Database,
  AlertTriangle, User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  useShopSettings, useProducts, useCustomers, useInvoices,
} from '@/hooks/use-data'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'
import { uploadShopLogo } from '@/lib/storage'

export default function SettingsPage() {
  const { lang, setLang, t } = useLang()
  const [resetOpen, setResetOpen] = useState(false)
  const qc = useQueryClient()

  const { data: shop, isLoading: shopLoading } = useShopSettings()
  const { data: products = [] } = useProducts()
  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 1000)

  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])

  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingShop, setSavingShop] = useState(false)
  const [locked, setLocked] = useState(true)
  const [verifyMode, setVerifyMode] = useState(false)
  const [verifyInput, setVerifyInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register, handleSubmit, setValue, getValues, reset,
  } = useForm<any>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      shopName: 'Safwan Opticals',
      arName: '',
      crNumber: '',
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
    if (shop && !shopLoading) {
      reset({
        shopName: shop.shopName,
        arName: shop.arName,
        crNumber: shop.crNumber,
        shopAddress: shop.address,
        shopPhone: shop.phone,
        shopVat: shop.vat,
        shopWebsite: shop.website,
        receiptHeader: shop.receiptHeader,
        receiptFooter: shop.receiptFooter,
        currency: shop.currency,
        language: lang,
      })
      if (shop.logoUrl) setLogoUrl(shop.logoUrl)
    }
  }, [shop, shopLoading, lang, reset])

  const requestVerification = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/settings/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.success) {
        setMaskedEmail(data.maskedEmail)
        setVerifyMode(true)
        toast.success(data.message)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch { toast.error('Failed to send verification') }
    setVerifying(false)
  }

  const submitVerification = async () => {
    if (!verifyInput) return
    const res = await fetch('/api/settings/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code: verifyInput }),
    })
    const data = await res.json()
    if (data.success) {
      setLocked(false)
      setVerifyMode(false)
      setVerifyInput('')
      toast.success('Settings unlocked')
    } else {
      toast.error('Invalid code. Try again.')
    }
  }

  const onShopSubmit = async (data: any) => {
    const payload = {
      shop_name: data.shopName,
      ar_name: data.arName || null,
      cr_number: data.crNumber || null,
      shop_address: data.shopAddress || null,
      shop_phone: data.shopPhone || null,
      shop_vat: data.shopVat || null,
      shop_website: data.shopWebsite || null,
      receipt_header: data.receiptHeader || null,
      receipt_footer: data.receiptFooter || null,
      currency: data.currency,
      language: data.language || lang,
      logo_url: logoUrl || null,
    }

    // Save via API
    setSavingShop(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || 'Failed to save')
        return
      }

      // Immediately update query cache so all components see new data
      qc.setQueryData(['settings'], {
        id: (shop as any)?.id,
        shop_name: payload.shop_name,
        ar_name: payload.ar_name,
        cr_number: payload.cr_number,
        shop_address: payload.shop_address,
        shop_phone: payload.shop_phone,
        shop_vat: payload.shop_vat,
        shop_website: payload.shop_website,
        receipt_header: payload.receipt_header,
        receipt_footer: payload.receipt_footer,
        currency: payload.currency,
        language: payload.language,
        logo_url: payload.logo_url,
      })

      toast.success('Settings saved')
      setLocked(true) // Re-lock after save
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSavingShop(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadShopLogo(file)
      setLogoUrl(url)
      toast.success('Logo uploaded')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingLogo(false)
    }
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
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_name: 'Safwan Opticals', language: l }),
    }).catch(() => {})
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
                 <div className="flex items-center justify-between">
                   <div>
                     <CardTitle>Shop Information</CardTitle>
                     <CardDescription>Your business details shown on invoices and receipts</CardDescription>
                   </div>
                   {locked ? (
                     <Button type="button" variant="outline" size="sm" onClick={requestVerification} disabled={verifying} className="border-amber-300 text-amber-600 hover:bg-amber-50">
                       {verifying ? 'Sending...' : 'Unlock to Edit'}
                     </Button>
                   ) : (
                     <div className="flex items-center gap-2">
                       <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px]">Unlocked</Badge>
                       <Button type="button" variant="ghost" size="sm" onClick={() => setLocked(true)} className="text-xs">Lock</Button>
                     </div>
                   )}
                 </div>
               </CardHeader>
               <CardContent className="space-y-4">
                 {/* Verification dialog */}
                 {verifyMode && (
                   <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                     <p className="text-sm font-medium">Verification Required</p>
                     <p className="text-xs text-muted-foreground">A verification code has been sent to {maskedEmail}</p>
                     <div className="flex gap-2">
                       <Input
                         placeholder="Enter 6-digit code"
                         value={verifyInput}
                         onChange={(e) => setVerifyInput(e.target.value)}
                         className="h-9 text-center text-lg tracking-widest"
                         maxLength={6}
                         onKeyDown={(e) => e.key === 'Enter' && submitVerification()}
                       />
                       <Button type="button" size="sm" onClick={submitVerification}>Verify</Button>
                       <Button type="button" variant="ghost" size="sm" onClick={() => { setVerifyMode(false); setVerifyInput('') }}>Cancel</Button>
                     </div>
                   </div>
                 )}

                 {/* Logo Upload */}
                 <div className="space-y-2">
                   <Label>Shop Logo / Icon</Label>
                   <div className="flex items-center gap-4">
                     {logoUrl ? (
                       <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                     ) : (
                       <div className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground text-xs">No Logo</div>
                     )}
                     <div className="space-y-1">
                       <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingLogo || locked}>
                         {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                       </Button>
                       <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={locked} />
                       <p className="text-xs text-muted-foreground">PNG or JPG, recommended 200x200</p>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Shop Name (English)</Label>
                     <Input {...register('shopName')} disabled={locked} />
                   </div>
                   <div className="space-y-2">
                     <Label>Shop Name (Arabic)</Label>
                     <Input {...register('arName')} dir="rtl" disabled={locked} />
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>CR Number</Label>
                     <Input {...register('crNumber')} disabled={locked} />
                   </div>
                   <div className="space-y-2">
                     <Label>VAT Number</Label>
                     <Input {...register('shopVat')} disabled={locked} />
                   </div>
                 </div>

                 <div className="space-y-2">
                   <Label>Address</Label>
                   <Textarea rows={2} {...register('shopAddress')} disabled={locked} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Phone</Label>
                     <Input {...register('shopPhone')} disabled={locked} />
                   </div>
                   <div className="space-y-2">
                     <Label>Website</Label>
                     <Input {...register('shopWebsite')} disabled={locked} />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Currency</Label>
                     <Select disabled={locked} onValueChange={(v) => v && setValue('currency', v)}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent><SelectItem value="SAR">SAR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                     </Select>
                   </div>
                 </div>
                 <Separator />
                 <div className="space-y-2">
                   <Label>Receipt Header</Label>
                   <Textarea rows={2} {...register('receiptHeader')} disabled={locked} />
                 </div>
                 <div className="space-y-2">
                   <Label>Receipt Footer</Label>
                   <Textarea rows={2} {...register('receiptFooter')} disabled={locked} />
                 </div>
                 <Button type="submit" disabled={savingShop || locked}>
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
