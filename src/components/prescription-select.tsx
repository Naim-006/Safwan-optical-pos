import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { sphereOptions, cylinderOptions, axisOptions, addOptions, ipdOptions } from '@/lib/prescription-options'
import { useMemo } from 'react'

interface PrescriptionSelectProps {
  type: 'sphere' | 'cylinder' | 'axis' | 'add' | 'ipd'
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
  inputClassName = 'h-10 text-sm font-medium'
}: PrescriptionSelectProps) {
  const getPlaceholder = () => {
    switch (type) {
      case 'sphere': return '0.00'
      case 'cylinder': return '0.00'
      case 'axis': return '0°'
      case 'add': return '0.00'
      case 'ipd': return '60.0'
      default: return '0'
    }
  }

  const formatValue = (val: string | number) => {
    if (val === '' || val === null || val === undefined) return ''
    const num = Number(val)
    if (isNaN(num)) return ''
    
    switch (type) {
      case 'sphere':
      case 'cylinder':
      case 'add':
        return num.toFixed(2)
      case 'axis':
        return num.toString()
      case 'ipd':
        return num.toFixed(1)
      default:
        return val.toString()
    }
  }

  const getDisplayValue = () => {
    const formatted = formatValue(value)
    if (!formatted) return getPlaceholder()
    
    switch (type) {
      case 'sphere':
      case 'cylinder':
      case 'add':
        return `${formatted} D`
      case 'axis':
        return `${formatted}°`
      case 'ipd':
        return `${formatted} mm`
      default:
        return formatted
    }
  }

  const options = useMemo(() => {
    switch (type) {
      case 'sphere': return sphereOptions
      case 'cylinder': return cylinderOptions
      case 'axis': return axisOptions
      case 'add': return addOptions
      case 'ipd': return ipdOptions
      default: return []
    }
  }, [type])

  const isSelected = (optionValue: string) => {
    return formatValue(value) === optionValue
  }

  return (
    <div className={className}>
      {label && <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</Label>}
      <Select
        value={formatValue(value)}
        onValueChange={onChange}
      >
        <SelectTrigger className={`${inputClassName} min-w-[120px] border bg-white dark:bg-slate-900`}>
          <SelectValue placeholder={getPlaceholder()} />
        </SelectTrigger>
        <SelectContent className="max-h-[400px] min-w-[200px] bg-white dark:bg-slate-900 border">
          {/* Current Value Header */}
          {value !== '' && value !== null && value !== undefined && (
            <div className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b py-2 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Current:</span>
                <span className="text-sm font-semibold">{getDisplayValue()}</span>
              </div>
            </div>
          )}
          
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value} 
              className={`text-sm py-2 px-3 cursor-pointer border-b ${isSelected(option.value) ? 'bg-slate-200 dark:bg-slate-700 font-medium' : ''}`}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
