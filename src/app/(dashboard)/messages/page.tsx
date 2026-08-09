'use client'

import { useState, useMemo } from 'react'
import {
  Send, MessageSquare, Mail, Smartphone, MessageCircle, Clock,
  Users, Search, CheckSquare, Square, Zap, Loader2,
  ShoppingBag, Gift, Eye, Package, Moon, Phone, Wrench,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useCustomers, useInvoices } from '@/hooks/use-data'
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

export default function MessagesPage() {
  const [channel, setChannel] = useState('sms')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendHistory, setSendHistory] = useState<any[]>([])
  const [filterBy, setFilterBy] = useState('all')
  const { t } = useLang()
  const { data: customers = [] } = useCustomers()
  const { data: invoicesData } = useInvoices(1, 200)
  const allInvoices = invoicesData?.data || []

  const ch = CHANNELS.find(c => c.key === channel)!
  const ChannelIcon = ch.icon
  const characterCount = message.length
  const isOverLimit = ch.limit > 0 && characterCount > ch.limit

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
  const toggleCustomer = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelectedIds(new Set(eligibleCustomers.map((c: any) => c.id)))
  const deselectAll = () => setSelectedIds(new Set())
  const activeCount = selectedIds.size === 0 ? eligibleCustomers.length : selectedIds.size

  // ─── Templates ───
  const applyTemplate = (text: string) => setMessage(text)

  // ─── Send ───
  const handleSend = async () => {
    if (!message.trim()) { toast.error('Enter a message'); return }
    const recipients = selectedIds.size > 0 ? eligibleCustomers.filter((c: any) => selectedIds.has(c.id)) : eligibleCustomers
    if (recipients.length === 0) { toast.error(`No recipients for ${ch.label}`); return }
    setSending(true)
    await new Promise(r => setTimeout(r, 1500))
    setSendHistory(prev => [{
      id: Date.now().toString(), channel: channel.toUpperCase(), subject: subject || null,
      message: message.slice(0, 80) + (message.length > 80 ? '...' : ''),
      recipients: recipients.length, sentAt: new Date().toLocaleString(), status: 'sent',
    }, ...prev].slice(0, 25))
    toast.success(`Sent to ${recipients.length} customers via ${ch.label}`)
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('common.messages')}</h1>
        <p className="text-sm text-muted-foreground mt-1">Send bulk notifications to your customers via SMS, Email, or WhatsApp</p>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <div className={`rounded-lg ${ch.color.split(' ')[1]} p-1.5`}>
                  <ChannelIcon className={`h-4 w-4 ${ch.color.split(' ')[0]}`} />
                </div>
                Compose {ch.label} Message
              </CardTitle>
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
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><strong className="text-foreground">{activeCount}</strong> recipients</span>
                  <span className="hidden sm:flex items-center gap-1.5">•</span>
                  <span className="hidden sm:inline">{eligibleCustomers.length} eligible for {ch.label}</span>
                </div>
                <Button onClick={handleSend} disabled={sending || !message.trim()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? 'Sending...' : `Send ${ch.label}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send History */}
          {sendHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {sendHistory.map(entry => (
                  <div key={entry.id} className={`flex items-center gap-3 p-2.5 rounded-lg border-l-2 ${
                    entry.channel === 'SMS' ? 'border-l-green-400 bg-green-50/30 dark:bg-green-950/10' :
                    entry.channel === 'EMAIL' ? 'border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10' :
                    'border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10'
                  }`}>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex-shrink-0">{entry.channel}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{entry.message}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.sentAt}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{entry.recipients} ppl</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
    </div>
  )
}
