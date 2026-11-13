import { vi } from '@/lib/i18n'
import { useEffect, useId, useState } from 'react'
import { Minus, Plus, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  isValidHeaderRow,
  MAX_HEADER_ROW,
  type HeaderRowUpdate,
} from '@/lib/header-row'

export function HeaderRowSelector({
  value,
  onChange,
  dimensions = false,
}: {
  value: number
  onChange: (row: HeaderRowUpdate) => void
  dimensions?: boolean
}) {
  const id = useId()
  const [text, setText] = useState(String(value))
  useEffect(() => {
    setText(String(value))
  }, [value])
  const valid = text !== '' && isValidHeaderRow(Number(text))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/60 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Rows3
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <label htmlFor={id} className="text-xs font-medium">
            {' ' + vi('Header Row Number') + ' '}
          </label>
          <p
            id={`${id}-help`}
            className="mt-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            {dimensions
              ? vi(
                  'Applies to this worksheet and all reference roles using it. Rows above it are ignored.',
                )
              : vi(
                  'Choose the row containing column names. Rows above it are ignored.',
                )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={vi('Use previous row as header')}
          disabled={value <= 1}
          onClick={() => onChange((previous) => Math.max(1, previous - 1))}
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_HEADER_ROW}
          step={1}
          value={text}
          aria-invalid={!valid}
          aria-describedby={`${id}-help`}
          className="h-8 w-20 bg-white text-center text-xs tabular-nums"
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            const row = Number(next)
            if (next !== '' && isValidHeaderRow(row)) onChange(row)
          }}
          onBlur={() => setText(String(value))}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={vi('Use next row as header')}
          disabled={value >= MAX_HEADER_ROW}
          onClick={() =>
            onChange((previous) => Math.min(MAX_HEADER_ROW, previous + 1))
          }
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
