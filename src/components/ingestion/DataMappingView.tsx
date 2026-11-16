import { LocalizedError } from '@/components/LocalizedError'
import { displayMappingFields as MAPPING_FIELDS } from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import { useId, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Hash,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  autoMapColumns,
  effectiveGLAmountBasis,
  isFactSource,
  mappingIssues,
  type ColumnMapping,
  type FileMappingDraft,
  type FilePreview,
} from '@/lib/data-mapping'
import type { QueuedFile } from '@/lib/uploads'
import { cn } from '@/lib/utils'
import type { PreviewErrorKind } from '@/lib/header-row'

const fieldIcons = { text: Hash, date: CalendarDays, money: CircleDollarSign }

export interface DataMappingViewProps {
  file: QueuedFile
  draft?: FileMappingDraft
  onMappingChange: (columns: ColumnMapping) => void
  onRetryPreview: () => void
  onGLAmountBasisChange?: (basis: 'ledger' | 'revenue') => void
  disabled?: boolean
}

/** A focused per-file mapping editor shared by every fact-source wizard step. */
export function DataMappingView({
  file,
  draft,
  onMappingChange,
  onRetryPreview,
  onGLAmountBasisChange,
  disabled = false,
}: DataMappingViewProps) {
  const id = useId()
  const [focusedColumn, setFocusedColumn] = useState<string | null>(null)
  const source = file.source
  const preview = draft?.preview
  const suggestions = useMemo(
    () =>
      preview && isFactSource(source)
        ? autoMapColumns(preview.headers, source)
        : {},
    [preview, source],
  )
  if (draft?.error)
    return (
      <PreviewError
        error={draft.error}
        onRetry={onRetryPreview}
        kind={draft.errorKind}
      />
    )
  if (!preview) return <PreviewLoading />
  if (!isFactSource(source)) return null
  const fields = MAPPING_FIELDS[source]
  const columns = draft.columns
  const issues = mappingIssues(source, draft)
  const required = fields.filter((field) => !field.optional)
  const requiredMissing = required.filter((field) =>
    issues.includes(field.id),
  ).length
  const labels = Object.fromEntries(
    fields.flatMap((field) =>
      columns[field.id] ? [[columns[field.id]!, field.label]] : [],
    ),
  )

  return (
    <div className="space-y-5">
      {source === 'GL' && onGLAmountBasisChange && (
        <section className="rounded-xl border bg-accent/40 p-4">
          <label
            htmlFor={`${id}-gl-basis`}
            className="text-xs font-semibold text-primary"
          >
            Cơ sở số tiền GL đầu vào
          </label>
          <select
            id={`${id}-gl-basis`}
            className="mt-2 block w-full rounded-lg border bg-white p-2 text-xs"
            disabled={disabled}
            value={effectiveGLAmountBasis(draft.columns, draft.glAmountBasis)}
            onChange={(event) =>
              onGLAmountBasisChange(event.target.value as 'ledger' | 'revenue')
            }
          >
            <option value="ledger">
              Signed amount sổ cái · revenue = −amount
            </option>
            <option value="revenue">
              Doanh thu đã chuẩn hóa · giữ nguyên dấu
            </option>
          </select>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            Chọn theo tài liệu của nguồn. Hệ thống giữ số tiền gốc và chỉ chuẩn
            hóa dấu một lần theo lựa chọn này; không suy đoán từ số dương hoặc
            âm.
          </p>
        </section>
      )}
      <section
        aria-label={vi('Column mapping')}
        className="overflow-hidden rounded-xl border"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-accent/50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-accent-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{vi('Column mapping')}</strong>
              {' ' + vi('Review suggested matches.') + ' '}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12px] text-primary"
            disabled={disabled}
            onClick={() => onMappingChange(suggestions)}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            {' ' + vi('Reset') + ' '}
          </Button>
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_20px_minmax(0,1.15fr)] gap-4 border-b bg-muted px-4 py-2.5 text-[11px] font-semibold tracking-normal text-muted-foreground sm:grid">
          <span>{vi('System field')}</span>
          <span />
          <span>{vi('Your file column')}</span>
        </div>
        <div className="divide-y px-4">
          {fields.map((field) => {
            const Icon = fieldIcons[field.type]
            const column = columns[field.id]
            const index = column ? preview.headers.indexOf(column) : -1
            const sample =
              index >= 0
                ? preview.rows.find((row) => row[index] !== '')?.[index]
                : undefined
            const invalid = issues.includes(field.id)
            const controlId = `${id}-${field.id}`
            return (
              <div
                key={field.id}
                className="grid items-center gap-2.5 py-3 sm:grid-cols-[minmax(0,1fr)_20px_minmax(0,1.15fr)] sm:gap-4"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor={controlId}
                      className="text-[13px] font-medium"
                    >
                      {field.label}
                      <span
                        className={cn(
                          'ml-2 text-[11px] font-normal',
                          field.optional
                            ? 'text-muted-foreground'
                            : 'text-primary',
                        )}
                      >
                        {field.optional ? vi('Optional') : vi('Required')}
                      </span>
                    </label>
                    <p
                      id={`${controlId}-help`}
                      className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground"
                    >
                      {field.description}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="hidden size-3.5 text-muted-foreground/60 sm:block"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <Select
                    disabled={disabled}
                    value={index < 0 ? 'unmapped' : `column-${index}`}
                    onValueChange={(value) => {
                      const next = { ...columns }
                      if (value === 'unmapped') delete next[field.id]
                      else
                        next[field.id] = preview.headers[Number(value.slice(7))]
                      onMappingChange(next)
                    }}
                  >
                    <SelectTrigger
                      data-tour={`mapping-${source}-${field.id}`}
                      id={controlId}
                      onFocus={() => setFocusedColumn(column ?? null)}
                      aria-invalid={invalid}
                      aria-describedby={`${controlId}-help ${controlId}-sample`}
                      className={cn(
                        'h-9 text-xs',
                        invalid && 'border-amber-300 bg-amber-50/30',
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="unmapped"
                        className="text-xs text-muted-foreground"
                      >
                        {field.optional
                          ? vi('Not mapped')
                          : vi('Select a column…')}
                      </SelectItem>
                      {preview.headers.map((header, columnIndex) => (
                        <SelectItem
                          key={columnIndex}
                          data-tour={`mapping-option-${source}-${field.id}-${columnIndex}`}
                          value={`column-${columnIndex}`}
                          disabled={Object.entries(columns).some(
                            ([key, selected]) =>
                              key !== field.id && selected === header,
                          )}
                          className="text-xs"
                        >
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div
                    id={`${controlId}-sample`}
                    className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px]"
                  >
                    <span
                      className={cn(
                        'truncate',
                        invalid ? 'text-warning' : 'text-muted-foreground',
                      )}
                      title={sample}
                    >
                      {invalid
                        ? vi('Select a column to continue')
                        : sample !== undefined
                          ? `e.g. ${sample}`
                          : field.optional && !column
                            ? field.id === 'net_amount'
                              ? vi('Calculated: Gross Amount minus Discount')
                              : vi('Use when available in your export')
                            : vi('No sample value')}
                    </span>
                    {column && suggestions[field.id] === column && (
                      <span className="flex shrink-0 items-center gap-1 text-primary">
                        <Check className="size-2.5" aria-hidden="true" />
                        {' ' + vi('Suggested') + ' '}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/60 px-4 py-2.5 text-[11px]"
        >
          <span
            className={cn(
              'flex items-center gap-1.5',
              requiredMissing ? 'text-warning' : 'text-primary',
            )}
          >
            {requiredMissing ? (
              <AlertCircle className="size-3" aria-hidden="true" />
            ) : (
              <Check className="size-3" aria-hidden="true" />
            )}
            {required.length - requiredMissing} / {required.length}
            {' ' + vi('required fields mapped') + ' '}
          </span>
          <span className="text-muted-foreground">
            {' ' + vi('Amounts are reconciled in USD') + ' '}
          </span>
        </div>
      </section>
      <SpreadsheetPreview
        preview={preview}
        labels={labels}
        focusedColumn={focusedColumn}
      />
    </div>
  )
}

export function PreviewLoading() {
  return (
    <div
      role="status"
      className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/50 text-xs text-muted-foreground"
    >
      <LoaderCircle
        className="size-6 text-primary motion-safe:animate-spin"
        aria-hidden="true"
      />
      <p>{vi('Reading headers and a few sample rows…')}</p>
    </div>
  )
}

export function PreviewError({
  error,
  onRetry,
  kind,
}: {
  error: string
  onRetry: () => void
  kind?: PreviewErrorKind
}) {
  return (
    <div
      role={kind === 'header-row' ? 'status' : 'alert'}
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-xl border p-4 text-xs',
        kind === 'header-row'
          ? 'border-amber-200 bg-amber-50 text-warning'
          : 'border-red-200 bg-red-50 text-destructive',
      )}
    >
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {kind === 'header-row'
            ? vi(
                'Metadata or empty rows detected at the top. Please adjust the Header Row number below until the preview looks correct.',
              )
            : vi('This file needs a quick check')}
        </p>
        <div className="mt-1 break-words leading-relaxed">
          <LocalizedError message={error} />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {' ' + vi('Retry preview') + ' '}
      </Button>
    </div>
  )
}

function columnLetter(index: number): string {
  let label = ''
  for (
    let position = index + 1;
    position > 0;
    position = Math.floor((position - 1) / 26)
  )
    label = String.fromCharCode(65 + ((position - 1) % 26)) + label
  return label
}

export function SpreadsheetPreview({
  preview,
  labels = {},
  focusedColumn,
}: {
  preview: FilePreview
  labels?: Record<string, string>
  focusedColumn?: string | null
}) {
  const rows = preview.rows.slice(0, 3)
  return (
    <section
      aria-label={vi('Data preview')}
      className="overflow-hidden rounded-xl border"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold">
          <Table2
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          {' ' + vi('Data preview') + ' '}
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
            {rows.length ? vt`First ${rows.length} rows` : vi('Headers only')}
          </span>
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {' ' + vi('Original formatting · Scroll horizontally') + ' '}
        </span>
      </div>
      <Table
        className="text-[11px]"
        aria-label={
          preview.sheetName
            ? vt`Sample rows from ${preview.sheetName}`
            : vi('Sample rows from uploaded file')
        }
      >
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="sticky left-0 z-10 w-10 min-w-10 border-r bg-secondary text-center text-[11px] text-muted-foreground">
              <span className="sr-only">{vi('Spreadsheet row')}</span>#
            </TableHead>
            {preview.headers.map((header, index) => (
              <TableHead
                key={index}
                className={cn(
                  'min-w-32 border-r px-3 py-2 last:border-r-0',
                  labels[header] && 'bg-accent/50',
                  focusedColumn === header && 'bg-accent/60',
                )}
              >
                <span className="block tabular-nums text-[10px] font-normal text-muted-foreground">
                  {columnLetter(index + (preview.startColumn ?? 0))}
                </span>
                <span className="mt-1 block text-[11px] font-medium">
                  {header}
                </span>
                {labels[header] && (
                  <span className="mt-1 block text-[10px] font-normal text-primary">
                    {labels[header]}
                  </span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="h-9 even:bg-muted/40">
                <TableCell className="sticky left-0 z-10 border-r bg-muted text-center tabular-nums text-[11px] text-muted-foreground">
                  {rowIndex + (preview.headerRow ?? 1) + 1}
                </TableCell>
                {preview.headers.map((header, index) => (
                  <TableCell
                    key={index}
                    className={cn(
                      'max-w-60 truncate border-r px-3 tabular-nums text-[11px] text-muted-foreground last:border-r-0',
                      focusedColumn === header && 'bg-accent',
                    )}
                    title={row[index]}
                  >
                    {row[index] === '' ? (
                      <span className="font-sans text-muted-foreground/60">
                        {' ' + vi('empty') + ' '}
                      </span>
                    ) : (
                      row[index]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={preview.headers.length + 1}
                className="py-6 text-center text-muted-foreground"
              >
                {' ' +
                  vi(
                    'This file contains headers only. Its columns can still be mapped.',
                  ) +
                  ' '}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {' ' +
          vi(
            'Check date order and decimal formatting. Every row is validated when reconciliation runs.',
          ) +
          ' '}
      </p>
    </section>
  )
}
