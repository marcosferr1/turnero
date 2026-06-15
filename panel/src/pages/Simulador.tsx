import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Send, Smartphone } from 'lucide-react'
import { api } from '../api'
import type { SimDoctor, SimReply } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, PageHeader } from '../components/page'

interface ChatMessage {
  from: 'user' | 'bot'
  text: string
  template?: boolean
  options?: { id: string; title: string }[]
}

export default function Simulador() {
  const [doctors, setDoctors] = useState<SimDoctor[]>([])
  const [doctorId, setDoctorId] = useState(0)
  const [phone, setPhone] = useState('549261000999')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<SimDoctor[]>('/api/simulator/doctors').then((ds) => {
      setDoctors(ds)
      if (ds.length > 0) setDoctorId(ds[0].id)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  async function send(payload: { text?: string; optionId?: string }, label: string) {
    if (!doctorId) return
    setBusy(true)
    setError('')
    setMessages((m) => [...m, { from: 'user', text: label }])
    try {
      const res = await api.post<{ replies: SimReply[] }>('/api/simulator/message', {
        phone,
        doctorId,
        ...payload,
      })
      setMessages((m) => [
        ...m,
        ...res.replies.map((r) => ({
          from: 'bot' as const,
          text: r.text,
          template: r.kind === 'template',
          options: r.options,
        })),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  function sendText() {
    if (!input.trim() || busy) return
    const text = input.trim()
    setInput('')
    send({ text }, text)
  }

  async function reset() {
    if (!doctorId) return
    await api.post('/api/simulator/reset', { phone, doctorId }).catch(() => {})
    setMessages([])
  }

  return (
    <>
      <PageHeader
        title="Simulador del bot"
        description="Cada doctor tiene su propio número de WhatsApp. Elegí a quién simular."
        actions={
          <div className="grid w-full gap-2 sm:w-auto">
            <Label className="text-xs text-muted-foreground">Profesional (número de WhatsApp)</Label>
            <Select value={String(doctorId)} onValueChange={(v) => { setDoctorId(Number(v)); setMessages([]) }}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Elegir doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.whatsappDisplayPhone ? ` — ${d.whatsappDisplayPhone}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex h-[min(70dvh,calc(100dvh-12rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-muted/40">
        <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Smartphone className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedDoctor?.name || '—'}</p>
            <p className="truncate text-xs text-muted-foreground">
              Paciente simulado: {phone}
            </p>
          </div>
          <Input
            className="h-8 w-full sm:w-36"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            title="Teléfono del paciente simulado"
          />
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5" />
            Reiniciar
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Escribí "hola" para empezar la conversación.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                m.from === 'user'
                  ? 'self-end rounded-tr-sm bg-primary text-primary-foreground'
                  : 'self-start rounded-tl-sm border bg-card'
              }`}
            >
              {m.template && (
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
                  Plantilla
                </div>
              )}
              {m.text}
              {m.options && m.options.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
                  {m.options.map((o) => (
                    <button
                      key={o.id}
                      disabled={busy}
                      onClick={() => send({ optionId: o.id }, o.title)}
                      className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                    >
                      {o.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t bg-card p-3">
          <Input
            value={input}
            placeholder="Escribí un mensaje…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
          />
          <Button disabled={busy || !input.trim() || !doctorId} onClick={sendText}>
            <Send className="size-4" />
            Enviar
          </Button>
        </div>
      </div>
    </>
  )
}
