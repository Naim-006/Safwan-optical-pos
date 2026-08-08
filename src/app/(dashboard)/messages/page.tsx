'use client'

import { useState, useMemo } from 'react'
import {
  Send, MessageSquare, Mail, Smartphone, MessageCircle, Clock,
  Users, Search, CheckSquare, Square, Info, BarChart3, Copy,
  Zap, Filter, ChevronDown, Check, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCustomers, useInvoices } from '@/hooks/use-data'
import { useLang } from '@/contexts/lang-provider'
import { formatCurrency } from '@/lib/utils'

const TEMPLATES = [
  { label: 'Promotion Offer', text: 'Dear {name}, we have an exclusive offer for you! Visit Safwan Opticals today and get 20% off on all frames. Valid until end of month.' },
  { label: 'Eye Check Reminder', text: 'Dear {name}, it\'s time for your regular eye check-up! Book your appointment at Safwan Opticals. Call +966 05 0918 3807.' },
  { label: 'Order Ready', text: 'Dear {name}, your order is ready for pickup at Safwan Opticals. Please visit us at your convenience.' },
  { label: 'Ramadan Greeting', text: 'Ramadan Kareem {name}! May this holy month bring you peace and blessings. Visit Safwan Opticals for special Ramadan offers.' },
  { label: 'Follow Up', text: 'Dear {name}, we hope you\'re enjoying your new glasses from Safwan Opticals. Feel free to reach out if you need any adjustments!' },
  { label: 'Lens Replacement', text: 'Dear {name}, your lens replacement period is approaching. Visit Safwan Opticals for a free check and consultation.' },
]

const CHANNEL_INFO: Record<string, { icon: any; color: string; limit: number; label: string }> = {
  sms: { icon: Smartphone, color: 'green', limit: 160, label: 'SMS' },
  email: { icon: Mail, color: 'blue', limit: 0, label: 'Email' },
  whatsapp: { icon: MessageCircle, color: 'emerald', limit: 1000, label: 'WhatsApp' },
}

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

  const ch = CHANNEL_INFO[channel]
  const ChannelIcon = ch.icon

  // ─── Filtered recipients ───
  const filteredCustomers = useMemo(() => {
    let list = customers as any[]

    // Search filter
    if (recipientSearch) {
      const q = recipientSearch.toLowerCase()
      list = list.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    }

    // Channel filter - only show customers with contact for that channel
    if (filterBy === 'has_contact') {
      list = list.filter((c: any) =>
        channel === 'email' ? c.email : c.phone
      )
    }

    // Recent buyers filter
    if (filterBy === 'recent') {
      const recentNames = new Set(
        allInvoices
          .filter((i: any) => i.invoice_type !== 'receipt')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 30)
          .map((i: any) => (i.customer_name || '').toLowerCase())
      )
      list = list.filter((c: any) => recentNames.has(c.name.toLowerCase()))
    }

    return list
  }, [customers, recipientSearch, filterBy, channel, allInvoices])

  const eligibleCustomers = useMemo(() =>
    filteredCustomers.filter((c: any) =>
      channel === 'email' ? c.email : c.phone
    ),
  [filteredCustomers, channel])

  // ─── Selection ───
  const toggleCustomer = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => setSelectedIds(new Set(eligibleCustomers.map((c: any) => c.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const selectedCount = selectedIds.size === 0
    ? eligibleCustomers.length
    : selectedIds.size

  const characterCount = message.length
  const charLimit = ch.limit
  const isOverLimit = charLimit > 0 && characterCount > charLimit

  // ─── Templates ───
  const applyTemplate = (template: string) => {
    setMessage(template)
  }

  // ─── Send ───
  const handleSend = async () => {
    if (!message.trim()) { toast.error('Enter a message'); return }
    const recipients = selectedIds.size > 0
      ? eligibleCustomers.filter((c: any) => selectedIds.has(c.id))
      : eligibleCustomers

    if (recipients.length === 0) {
      toast.error(`No recipients available for ${ch.label}`)
      return
    }

    setSending(true)
    await new Promise((r) => setTimeout(r, 1500))

    const entry = {
      id: Date.now().toString(),
      channel: channel.toUpperCase(),
      subject: subject || null,
      message: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      recipients: recipients.length,
      sentAt: new Date().toLocaleString(),
      status: 'sent',
    }

    setSendHistory(prev => [entry, ...prev].slice(0, 20))
    toast.success(`Message sent to ${recipients.length} customers via ${ch.label}`)
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('common.messages')}</h1>
        <p className="text-muted-foreground">Send bulk notifications to your customers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main compose area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-t-2 border-t-blue-500 shadow-sm">
            <CardHeader className="bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/30 dark:to-transparent rounded-t-xl">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="h-5 w-5 text-blue-600" /> Compose Message
                </CardTitle>
                <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                  {Object.entries(CHANNEL_INFO).map(([key, val]) => (
                    <button key={key} onClick={() => { setChannel(key); setSelectedIds(new Set()) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        channel === key ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}>
                      <val.icon className="h-3.5 w-3.5" />
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Email subject */}
              {channel === 'email' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</Label>
                  <Input placeholder="Email subject line..." value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              )}

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Message</Label>
                  {charLimit > 0 && (
                    <span className={`text-xs ${isOverLimit ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      {characterCount} / {charLimit}
                    </span>
                  )}
                </div>
                <Textarea
                  rows={6}
                  placeholder={`Type your ${ch.label} message...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {isOverLimit && <p className="text-xs text-red-500">Message exceeds {charLimit} character limit for {ch.label}</p>}
              </div>

              {/* Templates */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quick Templates</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tmpl) => (
                    <Button key={tmpl.label} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => applyTemplate(tmpl.text)}>
                      <Zap className="h-3 w-3 mr-1" /> {tmpl.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Stats + Send */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <strong>{selectedCount}</strong> recipients
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    {eligibleCustomers.length} eligible
                  </span>
                </div>
                <Button onClick={handleSend} disabled={sending || !message.trim()} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {sending ? 'Sending...' : `Send via ${ch.label}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sendHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sendHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{entry.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{entry.message}</TableCell>
                        <TableCell className="text-sm">{entry.recipients}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.sentAt}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="text-[10px] bg-green-100 text-green-700 border-green-300">
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  No messages sent yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recipients sidebar */}
        <div className="space-y-4">
          <Card className="border-t-2 border-t-purple-500 shadow-sm">
            <CardHeader className="bg-gradient-to-b from-purple-50/80 to-transparent dark:from-purple-950/30 dark:to-transparent rounded-t-xl pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" /> Recipients
                <Badge className="ml-auto bg-purple-100 text-purple-700 border-purple-300 text-[10px]">{eligibleCustomers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {/* Search + Filter */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 h-8 text-xs"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className={`text-xs h-7 flex-1 ${filterBy === 'all' ? 'bg-purple-50 border-purple-300' : ''}`}
                  onClick={() => setFilterBy('all')}>All</Button>
                <Button variant="outline" size="sm" className={`text-xs h-7 flex-1 ${filterBy === 'has_contact' ? 'bg-purple-50 border-purple-300' : ''}`}
                  onClick={() => setFilterBy('has_contact')}>Has {ch.label}</Button>
                <Button variant="outline" size="sm" className={`text-xs h-7 flex-1 ${filterBy === 'recent' ? 'bg-purple-50 border-purple-300' : ''}`}
                  onClick={() => setFilterBy('recent')}>Recent</Button>
              </div>

              {/* Select All / Deselect */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{filteredCustomers.length} shown</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={deselectAll}>None</Button>
                </div>
              </div>

              <Separator />

              {/* Recipients list */}
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto pr-1">
                {eligibleCustomers.length > 0 ? eligibleCustomers.slice(0, 100).map((c: any) => {
                  const isSelected = selectedIds.size === 0 || selectedIds.has(c.id)
                  const contact = channel === 'email' ? c.email : c.phone
                  return (
                    <div key={c.id}
                      className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                        isSelected ? 'bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleCustomer(c.id)}
                    >
                      {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" /> : <Square className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{contact || 'No contact'}</p>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-20" />
                    No eligible recipients for {ch.label}<br />with valid {channel === 'email' ? 'email' : 'phone'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Channel Info */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <ChannelIcon className={`h-4 w-4 text-${ch.color}-600`} />
                <span className="font-semibold">{ch.label} Channel</span>
              </div>
              <div className="text-muted-foreground space-y-1">
                {channel === 'sms' && (
                  <>
                    <p>160 characters per SMS segment. Longer messages will be split into multiple segments.</p>
                    {characterCount > 0 && <p className="font-medium">Segments: {Math.ceil(characterCount / 160)}</p>}
                  </>
                )}
                {channel === 'email' && (
                  <p>Emails will be sent with your shop branding. Add a subject line for better open rates.</p>
                )}
                {channel === 'whatsapp' && (
                  <p>WhatsApp messages will be sent via WhatsApp Business API. Message limit: 1000 characters.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
