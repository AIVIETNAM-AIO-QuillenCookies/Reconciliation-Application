import { vi, vt } from '@/lib/i18n'
import { Download, Mail, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  buildExceptionMailto,
  exceptionActionLabel,
  type ReconciliationException,
} from '@/lib/exceptions'

export function ExceptionActions({
  row,
  sample,
  onExport,
  onDraft,
}: {
  row: ReconciliationException
  sample: boolean
  onExport: (row: ReconciliationException) => void
  onDraft: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={vt`Actions for ${row.reference}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs whitespace-normal [overflow-wrap:anywhere]">
          {row.reference}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {row.category === 'Missing GL' ? (
          <DropdownMenuItem
            onSelect={() => onExport(row)}
            className="gap-2 text-xs"
          >
            <Download className="size-3.5" />
            {vi(exceptionActionLabel(row))}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild onSelect={onDraft}>
            <a
              href={buildExceptionMailto(row, sample)}
              className="gap-2 text-xs"
            >
              <Mail className="size-3.5" />
              {vi(exceptionActionLabel(row))}
            </a>
          </DropdownMenuItem>
        )}
        <p className="px-2 py-2 text-[11px] leading-4 text-muted-foreground">
          {row.category === 'Missing GL'
            ? vi(
                'Downloads a review template. ERP field mapping is not configured.',
              )
            : vi('Opens a prefilled draft for you to review and send.')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
