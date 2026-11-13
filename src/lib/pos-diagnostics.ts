import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { QueuedFile, Source } from './uploads.ts'
import { sourceRecordRows } from './source-coordinates.ts'

export interface PosDiagnosticSample {
  sourceFile: string
  /** Physical worksheet/CSV line is unavailable when the decoder only retained record ordinals. */
  sourceRow: number | null
  sourceRecord: number
  raw: Record<string, string | null>
  normalized: Record<string, string | null>
}
export interface PosDiagnosticReason {
  code: string
  label: string
  rowCount: number
  keyGroupCount: number
  samples: PosDiagnosticSample[]
}
export interface PosDiagnostics {
  runId: string
  stage?: 'staging' | 'usd'
  uniqueInvalidRows: number
  /** Distinct receipt/line groups touched by invalid rows, never a sum of overlapping reasons. */
  invalidKeyGroups: number
  reasons: PosDiagnosticReason[]
  branchCounts: Record<string, number>
  currencyCounts: Record<string, number>
  validLocalMissingUsdRows: number
  duplicateConflictGroups: number
  duplicateGroups?: {
    keyGroups: number
    rowsInGroups: number
    discardedRows: number
  } | null
}
export interface PosRowIssue {
  code: string
  label: string
  where: string
}
export class PosValidationError extends Error {
  readonly diagnostics: PosDiagnostics
  constructor(diagnostics: PosDiagnostics) {
    const details = diagnostics.reasons
      .filter((reason) => reason.rowCount > 0)
      .map((reason) => `${reason.code}: ${reason.rowCount}`)
      .join('; ')
    super(
      `[POS_VALIDATION] ${diagnostics.uniqueInvalidRows} dòng POS lỗi duy nhất; ${diagnostics.invalidKeyGroups} nhóm receipt/line bị ảnh hưởng. ${details}`,
    )
    this.name = 'PosValidationError'
    this.diagnostics = diagnostics
  }
}
const quote = (text: string) => `"${text.replaceAll('"', '""')}"`
const literal = (text: string) => `'${text.replaceAll("'", "''")}'`

/** Full-table counts and bounded original records, from the same run connection. */
export async function capturePosDiagnostics(
  connection: AsyncDuckDBConnection,
  options: {
    runId: string
    rules: readonly PosRowIssue[]
    files: QueuedFile[]
    paths: Map<Source, string[]>
    fileIds: Map<string, string>
    signal?: AbortSignal
    /** Failed USD validation must not publish a revenue fact. */
    factReady?: boolean
    relation?: 'pos_staging' | 'pos_clean'
    branches?: readonly string[]
  },
): Promise<PosDiagnostics> {
  const query = async (sql: string) => {
    options.signal?.throwIfAborted()
    return connection.query(sql)
  }
  const count = async (sql: string) => Number((await query(sql)).toArray()[0].n)
  const branchCounts: Record<string, number> = {}
  const relation = quote(options.relation ?? 'pos_clean')
  for (const branch of options.branches ?? [
    'raw_pos',
    'pos_staging',
    'pos_ranked',
    'q_POS_First_Export',
    'q_POS_Cleaning',
    'q_POS_Mapped',
    'q_POS_USD',
    'fact_POS_final',
    'q_POS_Dup_Keys',
    'q_POS_Dup_Rows',
    'q_POS_Dup_Impact',
  ]) {
    if (branch === 'fact_POS_final' && !options.factReady) continue
    branchCounts[branch] = await count(
      `SELECT COUNT(*) AS n FROM ${quote(branch)}`,
    )
  }
  const schema = (await query(`SELECT * FROM ${relation} LIMIT 0`)).schema
    .fields
  const projection = schema
    .map(
      (field) =>
        `CAST(${quote(field.name)} AS VARCHAR) AS ${quote(field.name)}`,
    )
    .join(', ')
  const rawCache = new Map<string, Record<string, string | null>>()
  const coordinates = new Map<string, Promise<number[] | null>>()
  async function sampleRecord(
    row: Record<string, unknown>,
  ): Promise<PosDiagnosticSample> {
    const path = options.paths.get('POS')![Number(row.__reconcile_file_order)]
    const fileId = options.fileIds.get(path)
    const file = options.files.find((entry) => entry.id === fileId)
    const sourceRecord = Number(row.__reconcile_row_order)
    const cacheKey = `${path}:${sourceRecord}`
    if (!rawCache.has(cacheKey)) {
      const inputSchema = (
        await query(
          `SELECT * FROM read_csv_auto(${literal(path)}, header=true, all_varchar=true) LIMIT 0`,
        )
      ).schema.fields
      let ordinal = '__pos_diagnostic_record'
      while (inputSchema.some((field) => field.name === ordinal)) ordinal += '_'
      const original = await query(`SELECT * EXCLUDE (${quote(ordinal)}) FROM (
        SELECT ROW_NUMBER() OVER () AS ${quote(ordinal)}, input.*
        FROM read_csv_auto(${literal(path)}, header=true, all_varchar=true) AS input
      ) WHERE ${quote(ordinal)} = ${sourceRecord}`)
      const record = original.toArray()[0]
      rawCache.set(
        cacheKey,
        record
          ? Object.fromEntries(
              original.schema.fields.map((field) => [
                field.name,
                record[field.name] == null ? null : String(record[field.name]),
              ]),
            )
          : {},
      )
    }
    if (file && !coordinates.has(path))
      coordinates.set(path, sourceRecordRows(file.file, file.headerRow ?? 1))
    const sourceRows = await coordinates.get(path)
    return {
      sourceFile: file?.file.name ?? fileId ?? '',
      sourceRow: sourceRows?.[sourceRecord - 1] ?? null,
      sourceRecord,
      raw: rawCache.get(cacheKey)!,
      normalized: Object.fromEntries(
        schema
          .filter((field) => !field.name.startsWith('__reconcile_'))
          .map((field) => [
            field.name,
            row[field.name] == null ? null : String(row[field.name]),
          ]),
      ),
    }
  }
  const reasons: PosDiagnosticReason[] = []
  for (const rule of options.rules) {
    const rowCount = await count(
      `SELECT COUNT(*) AS n FROM ${relation} WHERE ${rule.where}`,
    )
    const keyGroupCount = await count(
      `SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM ${relation} WHERE ${rule.where} GROUP BY receipt_no, line_no)`,
    )
    const records = rowCount
      ? (
          await query(
            `SELECT ${projection} FROM ${relation} WHERE ${rule.where} ORDER BY __reconcile_file_order, __reconcile_row_order LIMIT 5`,
          )
        ).toArray()
      : []
    const samples: PosDiagnosticSample[] = []
    for (const record of records) samples.push(await sampleRecord(record))
    reasons.push({
      code: rule.code,
      label: rule.label,
      rowCount,
      keyGroupCount,
      samples,
    })
  }
  const invalid =
    options.rules.map((rule) => `(${rule.where})`).join(' OR ') || 'FALSE'
  const uniqueInvalidRows = await count(
    `SELECT COUNT(*) AS n FROM ${relation} WHERE ${invalid}`,
  )
  const invalidKeyGroups = await count(
    `SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM ${relation} WHERE ${invalid} GROUP BY receipt_no, line_no)`,
  )
  const currencies = await query(
    `SELECT COALESCE(currency, '(trống)') AS currency, COUNT(*) AS n FROM ${relation} WHERE ${invalid} GROUP BY currency ORDER BY currency`,
  )
  const validLocalMissingUsdRows =
    options.relation === 'pos_staging'
      ? 0
      : await count(
          'SELECT COUNT(*) AS n FROM pos_clean WHERE net_local IS NOT NULL AND net_local >= 0 AND net_usd_month_end IS NULL',
        )
  const duplicateConflictGroups =
    branchCounts.q_POS_Dup_Keys == null
      ? 0
      : await count(
          'SELECT COUNT(*) AS n FROM q_POS_Dup_Keys WHERE content_variants > 1',
        )
  const duplicateGroups =
    branchCounts.q_POS_Dup_Keys == null
      ? null
      : {
          keyGroups: branchCounts.q_POS_Dup_Keys,
          rowsInGroups: await count(
            'SELECT COALESCE(SUM(export_rows), 0) AS n FROM q_POS_Dup_Keys',
          ),
          discardedRows: branchCounts.q_POS_Dup_Rows,
        }
  return {
    runId: options.runId,
    stage: options.relation === 'pos_staging' ? 'staging' : 'usd',
    uniqueInvalidRows,
    invalidKeyGroups,
    reasons,
    branchCounts,
    currencyCounts: Object.fromEntries(
      currencies.toArray().map((row) => [String(row.currency), Number(row.n)]),
    ),
    validLocalMissingUsdRows,
    duplicateConflictGroups,
    duplicateGroups,
  }
}
