'use client'

import { useState } from 'react'
import { Send, MessageSquare, Mail, Smartphone, MessageCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCustomers } from '@/hooks/use-data'
import { useLang } from '@/contexts/lang-provider'

export default function MessagesPage() {
  const [channel, setChannel] = useState('email')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const { t } = useLang()
  const { data: customers = [] } = useCustomers()

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Enter a message'); return }
    setSending(true)
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000))
    toast.success(`Message queued for ${customers.length} customers via ${channel}`)
    setSending(false)
    setMessage('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('common.messages')}</h1>
        <p className="text-muted-foreground">Send bulk notifications to customers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Compose Message</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => v && setChannel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">
                    <span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> SMS</span>
                  </SelectItem>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</span>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={5}
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={sending} className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Send to All ({customers.length})
              </Button>
              <Button variant="outline" disabled={sending}>
                <Clock className="h-4 w-4 mr-2" /> Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recipients</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-3">
              {customers.length} customers will receive this message
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {channel === 'email' ? c.email : c.phone || 'No contact'}
                  </span>
                </div>
              ))}
              {customers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No customers</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
