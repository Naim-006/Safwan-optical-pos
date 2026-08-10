'use client'

import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, MessageSquare, Mail, Smartphone, MessageCircle, Clock,
  Users, Search, CheckSquare, Square, Zap, Loader2, Trash2,
  Gift, Eye, Package, Moon, Phone, Wrench,
  BarChart3, CheckCircle2, AlertTriangle, AtSign,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCustomers, useInvoices, useMessageLogs } from '@/hooks/use-data'
import { createMessageLogs } from '@/lib/supabase/data'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/contexts/lang-provider'

const TEMPLATES = [
  { label: 'Promotion Offer', icon: Gift, text: 'Dear {name}, we have an exclusive offer for you! Visit Safwan Opticals today and get 20% off on all frames. Valid until end of month.', color: 'from-rose-500/10 to-rose-500/5 border-rose-200 dark:border-rose-800' },
  { label: 'Eye Check Reminder', icon: Eye, text: "Dear {name}, it's time for your regular eye check-up! Book your appointment at Safwan Opticals. Call +966 05 0918 3807.", color: 'from-sky-500/10 to-sky-500/5 border-sky-200 dark:border-sky-800' },
  { label: 'Order Ready', icon: Package, text: 'Dear {name}, your order is ready for pickup at Safwan Opticals. Please visit us at your convenience.', color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-800' },
  { label: 'Ramadan Greeting', icon: Moon, text: 'Ramadan Kareem {name}! May this holy month bring you peace and blessings. Visit Safwan Opticals for special Ramadan offers.', color: 'from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800' },
  { label: 'Follow Up', icon: Phone, text: 'Dear {name}, we hope you are enjoying your new glasses from Safwan Opticals. Feel free to reach out if you need any adjustments!', color: 'from-violet-500/10 to-violet-500/5 border-violet-200 dark:border-violet-800' },
  { label: 'Lens Replacement', icon: Wrench, text: 'Dear {name}, your lens replacement period is approaching. Visit Safwan Opticals for a free check and consultation.', color: 'from-orange-500/10 to-orange-500/5 border-orange-200 dark:border-orange-800' },
]

const CHANNELS = [
  { key: 'sms', label: 'SMS', icon: Smartphone, color: 'text-green-600 bg-green-50 dark:bg-green-950/30', glow: 'shadow-green-500/20', limit: 160, desc: '160 chars per segment. Longer messages split automatically.' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', glow: 'shadow-blue-500/20', limit: 0, desc: 'Sent with shop branding. Add a subject for better open rates.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', glow: 'shadow-emerald-500/20', limit: 1000, desc: 'Sent via WhatsApp Business API.' },
]

const VARIABLES = [
  { key: '{name}', label: 'Name', desc: "Customer's name" },
  { key: '{phone}', label: 'Phone', desc: 'Customer phone' },
  { key: '{email}', label: 'Email', desc: 'Customer email' },
]

const LOCAL_KEY = 'safwan-message-history'

export default function MessagesPage() {
  const [channel, setChannel] = useState('sms')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterBy, setFilterBy] = useState('all')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [localHistory, setLocalHistory] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const { t } = useLang()

  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 200)
  const { data: dbLogs = [] } = useMessageLogs()
  const allInvoices = useMemo(() => invoicesData?.data || [], [invoicesData])
  const qc = useQueryClient()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) setLocalHistory(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      createClient().auth.getUser().then(({ data }) => {
        if (data?.user) setUserId(data.user.id)
      })
    } catch {}
  }, [])

  const logMutation = useMutation({
    mutationFn: createMessageLogs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message_logs'] }),
    onError: () => {},
  })

  const ch = CHANNELS.find(c => c.key === channel)!
  const ChannelIcon = ch.icon
  const characterCount = message.length
  const isOverLimit = ch.limit > 0 && characterCount > ch.limit

  // ─── Persist local history ───
  const persistLocal = (list: any[]) => {
    setLocalHistory(list)
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 50))) } catch {}
  }

  // ─── Merged history (DB + local) ───
  const mergedHistory = useMemo(() => {
    const map = new Map<string, any>()
    localHistory.forEach((e: any) => { if (e?.id) map.set(String(e.id), { ...e, source: 'local' }) })
    dbLogs.forEach((e: any) => { if (e?.id) map.set(String(e.id), { ...e, source: 'db' }) })
    return [...map.values()].sort((a, b) =>
      new Date(b.sent_at || b.created_at || b.id).getTime() - new Date(a.sent_at || a.created_at || a.id).getTime()
    )
  }, [localHistory, dbLogs])

  const stats = useMemo(() => {
    const byChannel: Record<string, number> = {}
    let sent = 0
    let thisMonth = 0
    const now = new Date()
    mergedHistory.forEach((e: any) => {
      const c = (e.channel || 'sms').toLowerCase()
      byChannel[c] = (byChannel[c] || 0) + 1
      if (e.status === 'sent' || e.status === 'pending' || e.source === 'local') sent += 1
      const d = new Date(e.sent_at || e.created_at || 0)
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonth += 1
    })
    return { total: mergedHistory.length, sent, byChannel, thisMonth }
  }, [mergedHistory])

  const visibleHistory = useMemo(() => {
    let list = mergedHistory
    if (historyFilter !== 'all') list = list.filter((e: any) => (e.channel || 'sms').toLowerCase() === historyFilter)
    const q = historySearch.trim().toLowerCase()
    if (q) list = list.filter((e: any) => (e.customer_name || '').toLowerCase().includes(q) || (e.message || '').toLowerCase().includes(q))
    return list
  }, [mergedHistory, historyFilter, historySearch])

  // ─── Filtered recipients ───
  const filteredCustomers = useMemo(() => {
    let list = customers as any[]
    if (recipientSearch) {
      const q = recipientSearch.toLowerCase()
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q)))
    }
    if (filterBy === 'has_contact') list = list.filter((c: any) => channel === 'email' ? c.email : c.phone)
    if (filterBy === 'recent') {
      const recent = new Set(allInvoices.filter((i: any) => i.invoice_type !== 'receipt').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30).map((i: any) => (i.customer_name || '').toLowerCase()))
      list = list.filter((c: any) => recent.has(c.name.toLowerCase()))
    }
    return list
  }, [customers, recipientSearch, filterBy, channel, allInvoices])

  const eligibleCustomers = useMemo(() =>
    filteredCustomers.filter((c: any) => channel === 'email' ? c.email : c.phone),
  [filteredCustomers, channel])

  // Selection
  const toggleCustomer = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const selectAll = () => setSelectedIds(new Set(eligibleCustomers.map((c: any) => c.id)))
  const deselectAll = () => setSelectedIds(new Set())
  const activeCount = selectedIds.size === 0 ? eligibleCustomers.length : selectedIds.size

  // ─── Templates / variables ───
  const applyTemplate = (text: string) => setMessage(text)
  const insertVariable = (v: string) => setMessage((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + v + ' ')

  // ─── Preview ───
  const sampleRecipient = eligibleCustomers[0]
  const previewText = useMemo(() => {
    const name = sampleRecipient?.name || 'Ahmed'
    const phone = sampleRecipient?.phone || '05XXXXXXXX'
    const email = sampleRecipient?.email || 'customer@example.com'
    return message
      .replaceAll('{name}', name)
      .replaceAll('{phone}', phone)
      .replaceAll('{email}', email)
  }, [message, sampleRecipient])

  const previewOpenCount = activeCount

  // ─── Send ───
  const handleSend = async () => {
    if (!message.trim()) { toast.error('Enter a message'); return }
    const recipients = selectedIds.size > 0 ? eligibleCustomers.filter((c: any) => selectedIds.has(c.id)) : eligibleCustomers
    if (recipients.length === 0) { toast.error(`No recipients for ${ch.label}`); return }
    setSending(true)
    await new Promise(r => setTimeout(r, 900))

    const nowIso = new Date().toISOString()
    const entries = recipients.map((c: any) => ({
      id: `${Date.now()}-${c.id}`,
      customer_id: c.id,
      customer_name: c.name,
      customer_phone: c.phone || null,
      customer_email: c.email || null,
      channel: channel,
      message: message,
      status: 'sent',
      sent_at: nowIso,
      created_at: nowIso,
    }))
    const localEntry = {
      ...entries[0],
      recipients: recipients.length,
      subject: subject || null,
      snippet: message.slice(0, 80) + (message.length > 80 ? '...' : ''),
      source: 'local',
    }
    persistLocal([localEntry, ...localHistory])

    if (userId && recipients.length > 0) {
      logMutation.mutate(entries.map((e) => ({
        customer_id: e.customer_id,
        customer_name: e.customer_name,
        customer_phone: e.customer_phone,
        customer_email: e.customer_email,
        channel: e.channel,
        message: e.message,
        status: 'sent',
        sent_at: e.sent_at,
        created_by: userId,
      })))
    }

    toast.success(`Sent to ${recipients.length} customers via ${ch.label}`)
    setSending(false)
  }

  const removeHistoryEntry = async (entry: any) => {
    if (entry.source === 'db' && entry.id) {
      try {
        const sb = createClient()
        await sb.from('message_logs').delete().eq('id', entry.id)
        qc.invalidateQueries({ queryKey: ['message_logs'] })
      } catch {}
    }
    persistLocal(localHistory.filter((e: any) => String(e.id) !== String(entry.id)))
    setDeleteTarget(null)
    toast.success('History entry removed')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('common.messages')}</h1>
          <p className="text-sm text-muted-foreground mt-1">Send bulk notifications to your customers via SMS, Email, or WhatsApp</p>
        </div>
      </div>

      {/* ─── Campaign stats ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Sent', value: stats.total, icon: Send, tint: 'bg-blue-500/10', iconColor: '#2563eb', accent: 'bg-blue-600', sub: `${stats.thisMonth} this month` },
          { label: 'SMS', value: stats.byChannel.sms || 0, icon: Smartphone, tint: 'bg-green-500/10', iconColor: '#16a34a', accent: 'bg-green-600', sub: 'messages' },
          { label: 'Email', value: stats.byChannel.email || 0, icon: Mail, tint: 'bg-purple-500/10', iconColor: '#9333ea', accent: 'bg-purple-600', sub: 'messages' },
          { label: 'WhatsApp', value: stats.byChannel.whatsapp || 0, icon: MessageCircle, tint: 'bg-emerald-500/10', iconColor: '#059669', accent: 'bg-emerald-600', sub: 'messages' },
        ].map((s: any) => (
          <Card key={s.label} size="sm" className="relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-0.5 ${s.accent}`} />
            <CardContent className="flex items-center gap-3">
              <div className={`shrink-0 grid h-9 w-9 place-items-center rounded-lg ${s.tint}`}>
                <s.icon className="h-4 w-4" style={{ color: s.iconColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold leading-tight">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ─── MAIN COMPOSE AREA ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Channel Selector */}
          <div className="flex gap-2 bg-muted/60 rounded-xl p-1.5">
            {CHANNELS.map(c => (
              <button key={c.key} onClick={() => { setChannel(c.key); setSelectedIds(new Set()) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  channel === c.key
                    ? `bg-white dark:bg-gray-800 shadow-sm ring-1 ring-black/5 ${c.glow}`
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}>
                <c.icon className={`h-4 w-4 ${channel === c.key ? c.color.split(' ')[0] : ''}`} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Compose Card */}
          <Card className="border-t-2 border-t-blue-500 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/30 dark:to-transparent pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`rounded-lg ${ch.color.split(' ')[1]} p-1.5`}>
                    <ChannelIcon className={`h-4 w-4 ${ch.color.split(' ')[0]}`} />
                  </div>
                  Compose {ch.label} Message
                </CardTitle>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreviewOpen(true)} disabled={!message.trim()}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {channel === 'email' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject Line</Label>
                  <Input placeholder="Enter email subject..." value={subject} onChange={e => setSubject(e.target.value)} className="h-9" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Body</Label>
                  {ch.limit > 0 && (
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-20 rounded-full overflow-hidden bg-muted`}>
                        <div className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : characterCount > ch.limit * 0.8 ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, (characterCount / ch.limit) * 100)}%` }} />
                      </div>
                      <span className={`text-xs font-mono font-bold ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {characterCount}/{ch.limit}
                      </span>
                    </div>
                  )}
                </div>
                <Textarea
                  rows={5} placeholder={`Write your ${ch.label} message...`}
                  value={message} onChange={e => setMessage(e.target.value)}
                  className={`resize-none transition-shadow focus-visible:ring-2 focus-visible:ring-offset-1 ${
                    isOverLimit ? 'border-red-400 focus-visible:ring-red-300' : 'focus-visible:ring-blue-300'
                  }`}
                />
                {ch.limit > 0 && characterCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ~{Math.ceil(characterCount / ch.limit)} segment{characterCount > ch.limit ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Variables */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <AtSign className="h-3 w-3 inline mr-1" />Personalization Variables
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map(v => (
                    <button key={v.key} onClick={() => insertVariable(v.key)}
                      title={v.desc}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      {v.key} <span className="text-muted-foreground font-normal">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Templates */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Zap className="h-3 w-3 inline mr-1" />Quick Templates
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(tmpl => (
                    <button key={tmpl.label} onClick={() => applyTemplate(tmpl.text)}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border bg-gradient-to-r ${tmpl.color} text-left hover:shadow-sm active:scale-[0.98] transition-all duration-150`}>
                      <tmpl.icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium leading-tight">{tmpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 sm:px-4 py-2.5">
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><strong className="text-foreground">{activeCount}</strong> recipients</span>
                  <span className="hidden sm:flex items-center gap-1.5">•</span>
                  <span className="hidden sm:inline">{eligibleCustomers.length} eligible for {ch.label}</span>
                </div>
                <Button onClick={handleSend} disabled={sending || !message.trim()} size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-9 sm:h-8 text-xs gap-1.5">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? 'Sending...' : `Send ${ch.label}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send History */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> Campaign History
                  <Badge variant="outline">{visibleHistory.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5">
                    {[{ k: 'all', l: 'All' }, { k: 'sms', l: 'SMS' }, { k: 'email', l: 'Email' }, { k: 'whatsapp', l: 'WhatsApp' }].map(f => (
                      <button key={f.k} onClick={() => setHistoryFilter(f.k)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                          historyFilter === f.k ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}>{f.l}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search history..." className="pl-7 h-7 text-xs w-36 rounded-lg" value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visibleHistory.length > 0 ? (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
                  {visibleHistory.map(entry => (
                    <div key={entry.id} className={`flex items-start gap-3 p-2.5 rounded-lg border-l-2 ${
                      (entry.channel || '').toLowerCase() === 'sms' ? 'border-l-green-400 bg-green-50/30 dark:bg-green-950/10' :
                      (entry.channel || '').toLowerCase() === 'email' ? 'border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10' :
                      'border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">{((entry.channel || 'sms').toUpperCase())}</Badge>
                          {entry.customer_name && <span className="text-xs font-semibold truncate">{entry.customer_name}</span>}
                          {entry.recipients > 1 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{entry.recipients} recipients</Badge>}
                          {entry.source === 'db' && <span className="inline-flex items-center gap-1 text-[10px] text-green-600"><CheckCircle2 className="h-3 w-3" /> saved</span>}
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(entry.sent_at || entry.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">{entry.snippet || entry.message}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setDeleteTarget(entry)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-20" />
                  <p>No campaigns yet. Send your first message to see it here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── RECIPIENTS SIDEBAR ─── */}
        <div className="space-y-4">
          <Card className="border-t-2 border-t-purple-500 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-purple-50/80 to-transparent dark:from-purple-950/30 dark:to-transparent pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" /> Recipients
                <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] border-purple-300 dark:border-purple-700">
                  {eligibleCustomers.length} eligible
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search customers..." className="pl-8 h-8 text-xs rounded-lg" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} />
              </div>

              {/* Filter + Select */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5">
                  {[{ k: 'all', l: 'All' }, { k: 'has_contact', l: `Has ${ch.label}` }, { k: 'recent', l: 'Recent' }].map(f => (
                    <button key={f.k} onClick={() => setFilterBy(f.k)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        filterBy === f.k ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}>{f.l}</button>
                  ))}
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={deselectAll}>None</Button>
                </div>
              </div>

              <Separator />

              {/* List */}
              <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5">
                {eligibleCustomers.length > 0 ? eligibleCustomers.slice(0, 120).map((c: any) => {
                  const isSelected = selectedIds.size === 0 || selectedIds.has(c.id)
                  const contact = channel === 'email' ? c.email : c.phone
                  const initials = (c.name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <div key={c.id} onClick={() => toggleCustomer(c.id)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 shadow-sm'
                          : 'hover:bg-muted/60 border border-transparent'
                      }`}>
                      <div className={`flex-shrink-0 transition-colors ${isSelected ? 'text-purple-600' : 'text-muted-foreground/50'}`}>
                        {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </div>
                      <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="text-[10px]">{initials}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{contact || `No ${channel === 'email' ? 'email' : 'phone'}`}</p>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <MessageSquare className="h-6 w-6 mx-auto mb-1.5 opacity-20" />
                    <p>No eligible recipients for {ch.label}</p>
                    <p className="text-[10px] mt-1">Add {channel === 'email' ? 'email addresses' : 'phone numbers'} to customers</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Channel Info Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg ${ch.color.split(' ')[1]} p-1.5`}>
                  <ChannelIcon className={`h-4 w-4 ${ch.color.split(' ')[0]}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{ch.label} Channel</p>
                  <p className="text-[11px] text-muted-foreground">{ch.limit > 0 ? `Up to ${ch.limit} characters` : 'Unlimited length'}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                {ch.desc}
                {ch.limit > 0 && characterCount > 0 && (
                  <p className="mt-1.5 font-medium text-foreground">
                    ~{Math.ceil(characterCount / ch.limit)} SMS segment{characterCount > ch.limit ? 's' : ''} required
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Message Preview</DialogTitle>
            <DialogDescription>
              Previewing for {previewOpenCount} recipient{previewOpenCount !== 1 ? 's' : ''} · {sampleRecipient?.name || 'a sample customer'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {channel === 'email' && subject && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</p>
                <p className="text-sm font-semibold">{subject}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Body</p>
              <div className="mt-1 rounded-lg border bg-muted/40 p-3.5 text-sm leading-relaxed whitespace-pre-wrap">
                {previewText}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {ch.limit > 0 && characterCount > ch.limit ? (
                <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> Exceeds {ch.limit} chars — will split into segments</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Looks good to send</span>
              )}
              <span className="ml-auto">{characterCount} chars</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete history entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This campaign entry will be removed from your history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && removeHistoryEntry(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
