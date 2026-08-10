'use client'

import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  sphereOptions, cylinderOptions, axisOptions, addOptions, ipdOptions,
} from '@/lib/prescription-options'
import { cn } from '@/lib/utils'

type RxType = 'sphere' | 'cylinder' | 'axis' | 'add' | 'ipd'

interface RxGroup {
  label: string
  labelClass: string
  items: { value: string; label: string }[]
}

const POS_LABEL = 'text-blue-600 dark:text-blue-400'
const NEG_LABEL = 'text-red-500 dark:text-red-400'
const NEU_LABEL = 'text-muted-foreground'

const splitSigned = (opts: { value: string; label: string }[]): RxGroup[] => {
  const pos: { value: string; label: string }[] = []
  const zero: { value: string; label: string }[] = []
  const neg: { value: string; label: string }[] = []
  for (const o of opts) {
    const v = parseFloat(o.value)
    if (v > 0) pos.push(o)
    else if (v < 0) neg.push(o)
    else zero.push(o)
  }
  return [
    { label: 'Positive (+)', labelClass: POS_LABEL, items: pos },
    { label: 'Zero', labelClass: NEU_LABEL, items: zero },
    { label: 'Negative (−)', labelClass: NEG_LABEL, items: neg },
  ]
}

const GROUPS: Record<RxType, RxGroup[]> = {
  sphere: splitSigned(sphereOptions),
  cylinder: splitSigned(cylinderOptions),
  axis: [{ label: 'Axis (°)', labelClass: NEU_LABEL, items: axisOptions }],
  add: [{ label: 'Add (D)', labelClass: NEU_LABEL, items: addOptions }],
  ipd: [{ label: 'IPD (mm)', labelClass: NEU_LABEL, items: ipdOptions }],
}

const DECIMALS: Record<RxType, number> = { sphere: 2, cylinder: 2, axis: 0, add: 2, ipd: 1 }
const PLACEHOLDER: Record<RxType, string> = {
  sphere: '0.00 D', cylinder: '0.00 D', axis: '0°', add: '0.00 D', ipd: '60.0 mm',
}

interface PrescriptionSelectProps {
  type: RxType
  value: string | number
  onChange: (value: string) => void
  label?: string
  className?: string
  inputClassName?: string
}

export function PrescriptionSelect({
  type,
  value,
  onChange,
  label,
  className = '',
  inputClassName = 'h-10 text-sm font-medium',
}: PrescriptionSelectProps) {
  const decimals = DECIMALS[type]
  const placeholder = PLACEHOLDER[type]
  const groups = GROUPS[type]

  const num = (() => {
    if (value === '' || value === null || value === undefined) return Number.NaN
    const n = typeof value === 'number' ? value : parseFloat(value)
    return Number.isNaN(n) ? Number.NaN : n
  })()
  const isSet = !Number.isNaN(num)
  const strVal = isSet ? num.toFixed(decimals) : null

  // When the dropdown opens, keep it at the current value, or at 0 if none selected.
  // base-ui scrolls the highlighted (first) item into view after the open animation,
  // so keep re-applying our scroll for a few seconds until it sticks.
  const scrollToSelected = () => {
    let frame = 0
    let stable = 0
    const MAX_FRAMES = 180 // ~3s
    const loop = () => {
      frame += 1
      const popups = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-content"]'))
      const popup = popups[popups.length - 1]
      if (!popup || popup.clientHeight <= 0) {
        if (frame < MAX_FRAMES) requestAnimationFrame(loop)
        return
      }
      const target =
        popup.querySelector<HTMLElement>('[data-selected]') ||
        popup.querySelector<HTMLElement>('[data-rx-zero]')
      if (!target) {
        if (frame < MAX_FRAMES) requestAnimationFrame(loop)
        return
      }
      const popupRect = popup.getBoundingClientRect()
      const itemRect = target.getBoundingClientRect()
      const itemTop = itemRect.top - popupRect.top
      const desired = Math.max(0, itemTop - popup.clientHeight / 2 + itemRect.height / 2)
      popup.scrollTop = desired
      stable = Math.abs(popup.scrollTop - desired) <= 1 ? stable + 1 : 0
      // give base-ui's late focus-scroll (~1s) time to fire, then stop once held
      if (frame >= 75 && stable >= 30) return
      if (frame < MAX_FRAMES) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  // IPD is a simple typing field (no dropdown)
  if (type === 'ipd') {
    const displayVal = value === '' || value === null || value === undefined ? '' : value
    return (
      <div className={className}>
        {label && (
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            {label}
          </Label>
        )}
        <div className={cn('relative inline-flex min-w-[124px] items-stretch overflow-hidden rounded-lg border bg-white shadow-xs dark:bg-slate-900', inputClassName)}>
          <Input
            type="text"
            inputMode="decimal"
            value={displayVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder="60.0"
            className="h-full w-full border-0 bg-transparent pr-9 text-right text-sm font-medium tabular-nums shadow-none focus-visible:ring-0"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">mm</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          {label}
        </Label>
      )}

      <Select value={strVal} onValueChange={(v) => v && onChange(v)} onOpenChange={(open) => open && scrollToSelected()}>
        <SelectTrigger className={cn('min-w-[124px] justify-center font-medium tabular-nums', inputClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="min-w-44 max-h-[300px]">
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel
                className={cn(
                  'sticky top-0 z-10 bg-popover/95 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur',
                  group.labelClass
                )}
              >
                {group.label}
              </SelectLabel>
              {group.items.map((opt, i) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  data-rx-zero={parseFloat(opt.value) === 0 ? 'true' : undefined}
                  className={cn(
                    'border-b border-border/60 py-2 pl-2.5 pr-8 text-sm tabular-nums data-selected:bg-slate-200 data-selected:text-slate-900 data-selected:font-semibold dark:data-selected:bg-slate-600 dark:data-selected:text-slate-50',
                    i === group.items.length - 1 && 'border-b-0'
                  )}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
