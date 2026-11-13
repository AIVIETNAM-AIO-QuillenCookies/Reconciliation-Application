import {
  REQUIRED_SOURCES,
  type FactSource,
  type QueuedFile,
} from './uploads.ts'
import type { PreviewErrorKind } from './header-row.ts'

export type MappingFieldId =
  | 'transaction_id'
  | 'date'
  | 'gross_amount'
  | 'discount'
  | 'net_amount'
  | 'store_key'
  | 'line_no'
  | 'order_status'
  | 'journal_type'
  | 'posting_date'
  | 'delivery_date'
  | 'return_date'
  | 'exported_at'
  | 'currency'

export interface MappingField {
  id: MappingFieldId
  label: string
  description: string
  type: 'text' | 'date' | 'money'
  aliases: readonly string[]
  optional?: boolean
}

const fields: Record<MappingFieldId, MappingField> = {
  currency: {
    id: 'currency',
    label: 'Currency',
    description:
      'Currency used for reference lookups and local-currency conversion. Required for POS local amounts.',
    type: 'text',
    aliases: ['currency', 'currency_code', 'ccy'],
    optional: true,
  },
  transaction_id: {
    id: 'transaction_id',
    label: 'Transaction ID',
    description: 'The receipt, order, or journal reference.',
    type: 'text',
    aliases: [
      'transaction_id',
      'transaction_number',
      'receipt_no',
      'receipt_id',
      'receipt_number',
      'web_order_id',
      'order_id',
      'order_number',
      'journal_id',
      'journal_no',
      'txn_id',
    ],
  },
  date: {
    id: 'date',
    label: 'Date',
    description: 'The transaction or reporting date.',
    type: 'date',
    aliases: [
      'date',
      'posting_date',
      'business_date',
      'transaction_date',
      'order_date',
      'month_end_date',
      'sale_date',
      'sales_date',
      'txn_date',
    ],
  },
  gross_amount: {
    id: 'gross_amount',
    label: 'Gross Amount',
    description: 'Revenue before discounts and adjustments.',
    type: 'money',
    aliases: [
      'gross_amount',
      'gross_usd_daily',
      'gross_usd',
      'gross_amount_usd',
      'gross_sales_usd',
      'gross_sales',
      'line_amount',
      'revenue_usd',
      'revenue',
      'sales_amount',
    ],
  },
  discount: {
    id: 'discount',
    label: 'Discount',
    description: 'The supplied discount amount.',
    type: 'money',
    aliases: [
      'discount',
      'discount_usd_daily',
      'discount_usd',
      'discount_amount',
      'discount_amount_usd',
      'discounts',
      'line_discount',
    ],
  },
  net_amount: {
    id: 'net_amount',
    label: 'Net Amount',
    description: 'The supplied net revenue or signed ledger amount.',
    type: 'money',
    aliases: [
      'net_amount',
      'net_usd_month_end',
      'net_usd',
      'net_amount_usd',
      'net_sales_usd',
      'net_sales',
      'amount_usd',
      'journal_amount',
      'amount',
    ],
  },
  store_key: {
    id: 'store_key',
    label: 'Store ID',
    description: 'Store key or code; master data can resolve aliases.',
    type: 'text',
    aliases: [
      'store_key',
      'store_code',
      'store_id',
      'branch_code',
      'location_code',
    ],
  },
  line_no: {
    id: 'line_no',
    label: 'Line Number',
    description: 'Identifies a receipt line for duplicate detection.',
    type: 'text',
    aliases: ['line_no', 'line_number', 'receipt_line', 'line_id'],
  },
  order_status: {
    id: 'order_status',
    label: 'Order Status',
    description: 'Delivered, cancelled, or returned.',
    type: 'text',
    aliases: ['order_status', 'status', 'fulfillment_status'],
  },
  journal_type: {
    id: 'journal_type',
    label: 'Journal Type',
    description: 'Identifies normal and manual ledger entries.',
    type: 'text',
    aliases: ['journal_type', 'entry_type', 'journal_category'],
  },
  posting_date: {
    id: 'posting_date',
    label: 'Posting Date',
    description: 'Optional finance recognition date.',
    type: 'date',
    aliases: ['posting_date', 'posting_date_key', 'finance_posting_date'],
    optional: true,
  },
  delivery_date: {
    id: 'delivery_date',
    label: 'Delivery Date',
    description: 'Required on delivered and returned order rows.',
    type: 'date',
    aliases: [
      'delivery_date',
      'delivery_date_key',
      'delivered_at',
      'delivered_date',
    ],
    optional: true,
  },
  return_date: {
    id: 'return_date',
    label: 'Return Date',
    description: 'Required on returned order rows.',
    type: 'date',
    aliases: ['return_date', 'return_date_key', 'returned_at', 'returned_date'],
    optional: true,
  },
  exported_at: {
    id: 'exported_at',
    label: 'Exported At',
    description: 'Timestamp used to keep the earliest receipt export.',
    type: 'text',
    aliases: ['exported_at', 'export_timestamp', 'export_date'],
    optional: true,
  },
}

const salesNetAmount: MappingField = {
  ...fields.net_amount,
  optional: true,
  description:
    'Use the supplied net amount, or leave unmapped to calculate Gross Amount minus Discount.',
}

/** Flash is monthly and GL is a signed ledger; neither needs invented sales fields. */
export const MAPPING_FIELDS: Record<FactSource, readonly MappingField[]> = {
  POS: [
    fields.transaction_id,
    {
      ...fields.date,
      aliases: [
        'business_date',
        'business_date_key',
        'date_key',
        ...fields.date.aliases,
      ],
    },
    {
      ...fields.gross_amount,
      description:
        'POS gross amount: line_amount is local currency; explicitly named USD fields are already converted.',
    },
    {
      ...fields.discount,
      description:
        'POS discount: discount_amount is local currency; explicitly named USD discounts remain in USD.',
    },
    {
      ...salesNetAmount,
      description:
        'A mapped net is authoritative USD, including zero. Leave unmapped to derive local gross minus local discount and convert using confirmed FX.',
    },
    fields.store_key,
    fields.line_no,
    fields.posting_date,
    fields.exported_at,
    fields.currency,
  ],
  WEB: [
    fields.transaction_id,
    {
      ...fields.date,
      aliases: ['order_date', 'order_date_key', ...fields.date.aliases],
    },
    fields.gross_amount,
    fields.discount,
    salesNetAmount,
    fields.order_status,
    fields.currency,
    { ...fields.store_key, optional: true },
    fields.delivery_date,
    fields.return_date,
  ],
  GL: [
    fields.transaction_id,
    {
      ...fields.date,
      aliases: ['posting_date', 'posting_date_key', ...fields.date.aliases],
    },
    {
      ...fields.net_amount,
      aliases: [...fields.net_amount.aliases, 'revenue_usd'],
    },
    { ...fields.store_key, optional: true },
    fields.journal_type,
    fields.currency,
  ],
  Flash: [
    fields.currency,
    {
      ...fields.date,
      aliases: ['month_end_date', 'month_end_date_key', ...fields.date.aliases],
    },
    fields.gross_amount,
  ],
}

export interface FilePreview {
  error?: string
  headers: string[]
  /** Display text, before any date or currency normalization. At most five rows. */
  rows: string[][]
  /** Same canonical cell values used by ingestion; rows retain original display text. */
  normalizedRows?: string[][]
  sheetName: string | null
  hasMoreRows: boolean
  headerRow?: number
  startColumn?: number
}

export type ColumnMapping = Partial<Record<MappingFieldId, string>>
/** Selected source-field semantics establish the default; the amount's sign never does. */
export function effectiveGLAmountBasis(
  columns: ColumnMapping,
  explicit?: import('./gl-review.ts').GLAmountBasis,
): import('./gl-review.ts').GLAmountBasis {
  return (
    explicit ??
    (columns.net_amount?.toLowerCase().replace(/[^a-z0-9]/g, '') ===
    'revenueusd'
      ? 'revenue'
      : 'ledger')
  )
}
export interface FileMappingDraft {
  glAmountBasis?: import('./gl-review.ts').GLAmountBasis
  master?: import('./master-data.ts').MasterDraft
  masterValidation?: import('./master-data.ts').MasterValidation
  preview: FilePreview | null
  error: string | null
  errorKind?: PreviewErrorKind
  columns: ColumnMapping
  /** Initial workbook inventory. Current sheet previews/headers are in master.sheets. */
  dimensionSheets?: FilePreview[]
}
export type MappingDrafts = Record<string, FileMappingDraft>

/** Serializable per-file configuration consumed by the accounting SQL adapter. */
export interface ConfirmedFileMapping {
  fileId: string
  fileName: string
  source: FactSource
  columns: ColumnMapping
  headerRow?: number
  sheetName?: string | null
  glAmountBasis?: import('./gl-review.ts').GLAmountBasis
}

export function isFactSource(
  source: QueuedFile['source'],
): source is FactSource {
  return REQUIRED_SOURCES.some((candidate) => candidate === source)
}

export function normalizeHeader(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[right.length]
}

export function headerMatchScore(header: string, field: MappingField): number {
  const normalized = normalizeHeader(header)
  if (!normalized) return 0
  return Math.max(
    ...field.aliases.map((alias) => {
      const target = normalizeHeader(alias)
      if (normalized === target) return 1
      const compact = normalized.replaceAll(' ', '')
      const targetCompact = target.replaceAll(' ', '')
      if (compact === targetCompact) return 0.98
      // Small spelling mistakes are useful suggestions. Generic word overlap is not.
      if (
        Math.min(compact.length, targetCompact.length) < 5 ||
        Math.max(compact.length, targetCompact.length) > 80
      )
        return 0
      return (
        1 -
        editDistance(compact, targetCompact) /
          Math.max(compact.length, targetCompact.length)
      )
    }),
  )
}

/** Prefer exact aliases, reserve each column once, and leave ambiguous matches for review. */
export function autoMapColumns(
  headers: readonly string[],
  source: FactSource,
): ColumnMapping {
  const available = new Set(headers)
  const mapping: ColumnMapping = {}
  const rankedFields = MAPPING_FIELDS[source]
    .map((field) => ({
      field,
      best: Math.max(
        0,
        ...headers.map((header) => headerMatchScore(header, field)),
      ),
    }))
    .sort((left, right) => right.best - left.best)
  for (const { field } of rankedFields) {
    const candidates = [...available]
      .map((header) => ({ header, score: headerMatchScore(header, field) }))
      .sort((left, right) => right.score - left.score)
    const best = candidates[0]
    if (!best || best.score < 0.82) continue
    // Multiple exact aliases use the source's semantic date/amount priority.
    if (
      best.score < 0.98 &&
      candidates[1] &&
      best.score - candidates[1].score < 0.08
    )
      continue
    const exact = field.aliases.flatMap((alias) =>
      candidates.filter(
        (candidate) =>
          normalizeHeader(candidate.header) === normalizeHeader(alias),
      ),
    )
    mapping[field.id] = exact[0]?.header ?? best.header
    available.delete(mapping[field.id]!)
  }
  return mapping
}

export function mappingIssues(
  source: FactSource,
  draft?: FileMappingDraft,
): MappingFieldId[] {
  const used = new Set<string>()
  return MAPPING_FIELDS[source]
    .filter((field) => {
      const column = draft?.columns[field.id]
      if (field.optional && !column) return false
      if (
        !draft?.preview ||
        draft.error ||
        !column ||
        !draft.preview.headers.includes(column) ||
        used.has(column)
      )
        return true
      used.add(column)
      return false
    })
    .map((field) => field.id)
}

/** All uploaded fact files count, including a second file for the same source. */
export function canConfirmMappings(
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
): boolean {
  const factFiles = files.filter((file) => isFactSource(file.source))
  return (
    factFiles.length > 0 &&
    files.every(
      (file) =>
        file.source === 'Dim' ||
        (isFactSource(file.source) &&
          mappingIssues(file.source, drafts[file.id]).length === 0),
    )
  )
}

export function confirmedMappingSnapshot(
  files: readonly QueuedFile[],
  drafts: MappingDrafts,
): ConfirmedFileMapping[] {
  if (!canConfirmMappings(files, drafts))
    throw new Error(
      'Map every required field in every uploaded file before confirming.',
    )
  return files.flatMap((file) =>
    isFactSource(file.source)
      ? [
          {
            fileId: file.id,
            fileName: file.file.name,
            source: file.source,
            ...((file.headerRow ?? 1) !== 1
              ? { headerRow: file.headerRow }
              : {}),
            columns: { ...drafts[file.id].columns },
            ...(file.source === 'GL'
              ? {
                  glAmountBasis: effectiveGLAmountBasis(
                    drafts[file.id].columns,
                    drafts[file.id].glAmountBasis,
                  ),
                  sheetName: drafts[file.id].preview?.sheetName ?? null,
                }
              : {}),
          },
        ]
      : [],
  )
}
