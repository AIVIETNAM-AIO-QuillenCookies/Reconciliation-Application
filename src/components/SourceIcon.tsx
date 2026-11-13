import { vi, TERMS } from '@/lib/i18n'
import { BookOpen, Database, Globe2, Store, Zap } from 'lucide-react'
import type { Source } from '@/lib/uploads'
import { cn } from '@/lib/utils'

const sourceStyles = {
  POS: {
    icon: Store,
    color: 'border-primary/15 bg-accent text-primary',
    name: vi('Point of sale'),
    detail: vi('In-store transactions'),
  },
  WEB: {
    icon: Globe2,
    color: 'border-border bg-secondary text-secondary-foreground',
    name: vi('Web commerce'),
    detail: vi('Online transactions'),
  },
  GL: {
    icon: BookOpen,
    color: 'border-primary/20 bg-accent text-primary',
    name: vi('General ledger'),
    detail: vi('Finance records'),
  },
  Flash: {
    icon: Zap,
    color: 'border-primary/15 bg-accent text-primary',
    name: vi('Sales flash'),
    detail: vi('Monthly gross revenue'),
  },
  Dim: {
    icon: Database,
    color: 'border-border bg-muted text-muted-foreground',
    name: vi('Dim data · optional'),
    detail: vi('Store, date, and FX dimensions'),
  },
}

export function SourceIcon({
  source,
  className,
}: {
  source: Source
  className?: string
}) {
  const { icon: Icon, color } = sourceStyles[source]
  return (
    <span
      title={TERMS[source]}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg border',
        color,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

export { sourceStyles }
