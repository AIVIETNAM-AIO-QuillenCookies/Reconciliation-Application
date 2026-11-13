import { vi } from '@/lib/i18n'
import { CircleHelp, CopyX, FileQuestionMark } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ExceptionCategory } from '@/lib/exceptions'

const appearances = {
  'Data Error': {
    variant: 'destructive',
    style: 'border-red-200 bg-red-50 text-destructive',
    icon: CopyX,
  },
  'Missing GL': {
    variant: 'outline',
    style: 'border-amber-200 bg-amber-50 text-warning',
    icon: FileQuestionMark,
  },
  Unexplained: {
    variant: 'secondary',
    style: 'border-border bg-secondary text-muted-foreground',
    icon: CircleHelp,
  },
} as const

export function ExceptionBadge({ category }: { category: ExceptionCategory }) {
  const { variant, style, icon: Icon } = appearances[category]
  return (
    <Badge
      variant={variant}
      className={`gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${style}`}
    >
      <Icon aria-hidden="true" />
      {vi(category)}
    </Badge>
  )
}
