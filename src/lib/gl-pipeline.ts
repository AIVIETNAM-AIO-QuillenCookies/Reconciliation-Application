import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { QueuedFile } from './uploads.ts'
import type { ConfirmedFileMapping } from './data-mapping.ts'
import { sourceRecordRows } from './source-coordinates.ts'
import * as XLSX from 'xlsx'
import { cachedWorkbook } from './workbook-cache.ts'
import { dateSQL } from './reconciliation-sql.ts'
import {
  glFingerprint,
  validateGLPatch,
  type GLCorrection,
  type GLDiagnostic,
  type GLRecord,
  type GLReviewSnapshot,
  type GLTransformation,
} from './gl-review.ts'
import { quoteLiteral as literal } from './sql-quoting.ts'

const money = (s: string) => `TRY_CAST(${s} AS DECIMAL(18,2))`
export const ACCOUNTING_GL_SQL = [
  `CREATE TEMP TABLE gl_normalized AS SELECT * EXCLUDE (journal_id, store_key, journal_type, posting_date, amount_usd, period, channel),
    NULLIF(TRIM(journal_id), '') AS journal_id,
    COALESCE(NULLIF(TRIM(store_key), ''), '-1') AS store_key,
    UPPER(NULLIF(TRIM(journal_type), '')) AS journal_type,
    ${dateSQL('posting_date')} AS posting_date,
    ${money('amount_usd')} AS amount_usd,
    COALESCE(NULLIF(TRIM(period), ''), strftime(${dateSQL('posting_date')}, '%Y-%m')) AS period,
    COALESCE(UPPER(NULLIF(TRIM(channel), '')), CASE WHEN NULLIF(TRIM(store_key), '') IS NULL OR TRIM(store_key) = '-1' THEN 'UNALLOCATED' WHEN TRIM(store_key) = '999999' THEN 'WEB' ELSE 'STORE' END) AS channel
    FROM raw_gl`,
  `CREATE TEMP TABLE gl_clean AS SELECT * FROM gl_normalized`,
  `CREATE TEMP VIEW vw_gl AS SELECT *, -amount_usd AS revenue_usd FROM gl_clean`,
  `CREATE TEMP VIEW vw_gl_manual AS SELECT * FROM vw_gl WHERE journal_type = 'MANUAL'`,
  `CREATE TEMP VIEW vw_gl_system AS SELECT * FROM vw_gl WHERE journal_type <> 'MANUAL'`,
]

const text = (value: unknown): string | null =>
  value == null ? null : String(value)
function cents(value: unknown): number | null {
  if (value == null) return null
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) return null
  const n =
    (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))) *
    (match[1] ? -1n : 1n)
  return n <= BigInt(Number.MAX_SAFE_INTEGER) &&
    n >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(n)
    : null
}
const centsSQL = (value: number) => {
  const n = BigInt(value)
  const absolute = n < 0n ? -n : n
  return `${n < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

/** Capture every GL row; evidence previews remain bounded separately. Apply overlays only on exact source/config matches. */
export async function prepareGLReview(
  connection: AsyncDuckDBConnection,
  options: {
    runId: string
    files: QueuedFile[]
    columnMappings?: readonly ConfirmedFileMapping[]
    configuration: unknown
    corrections?: readonly GLCorrection[]
    glPaths?: readonly string[]
    signal?: AbortSignal
  },
): Promise<GLReviewSnapshot> {
  const configurationVersion = glFingerprint(options.configuration)
  const sourceFiles = options.files.filter((file) => file.source === 'GL')
  const rows = (
    await connection.query(
      'SELECT * EXCLUDE (posting_date, amount_usd), CAST(posting_date AS VARCHAR) AS posting_date, CAST(amount_usd AS VARCHAR) AS amount_usd FROM gl_normalized ORDER BY __reconcile_file_order, __reconcile_row_order',
    )
  ).toArray()
  const records: GLRecord[] = []
  const transformations: GLTransformation[] = []
  const diagnostics: GLDiagnostic[] = []
  const coordinates = new Map<string, number[] | null>()
  const sheetNames = new Map<string, string>()
  const sourceValues = new Map<string, Record<string, string | null>[]>()
  for (const [fileIndex, file] of sourceFiles.entries()) {
    coordinates.set(
      file.id,
      await sourceRecordRows(file.file, file.headerRow ?? 1, file.sheetName),
    )
    const path = options.glPaths?.[fileIndex]
    if (path) {
      const original = await connection.query(
        `SELECT * FROM read_csv_auto(${literal(path)}, header=true, all_varchar=true)`,
      )
      sourceValues.set(
        file.id,
        original
          .toArray()
          .map((row) =>
            Object.fromEntries(
              original.schema.fields.map((field) => [
                field.name,
                text(row[field.name]),
              ]),
            ),
          ),
      )
    }
    if (file.file.name.toLowerCase().endsWith('.xlsx')) {
      try {
        const workbook =
          cachedWorkbook(file.file) ??
          XLSX.read(await file.file.arrayBuffer(), {
            type: 'array',
            bookSheets: true,
          })
        if (file.sheetName ?? workbook.SheetNames[0])
          sheetNames.set(file.id, file.sheetName ?? workbook.SheetNames[0])
      } catch {
        /* Unknown worksheet remains labeled explicitly below. */
      }
    }
  }
  const counts = new Map<string, number>()
  const allJournalCounts = new Map<string, number>()
  for (const row of rows)
    if (row.journal_id != null) {
      const key = `${Number(row.__reconcile_file_order)}:${String(row.journal_id)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      const journal = String(row.journal_id)
      allJournalCounts.set(journal, (allJournalCounts.get(journal) ?? 0) + 1)
    }
  for (let index = 0; index < rows.length; index++) {
    options.signal?.throwIfAborted()
    if (index > 0 && index % 1000 === 0)
      await new Promise((resolve) => setTimeout(resolve, 0))
    const row = rows[index]
    const file = sourceFiles[Number(row.__reconcile_file_order)]
    const mapping = options.columnMappings?.find(
      (entry) => entry.fileId === file.id,
    )
    const sourceRecord = Number(row.__reconcile_row_order)
    const sourceRow = coordinates.get(file.id)?.[sourceRecord - 1] ?? null
    const journalId = text(row.journal_id)
    const duplicated =
      journalId &&
      (counts.get(`${Number(row.__reconcile_file_order)}:${journalId}`) ?? 0) >
        1
    const id = `gl:${encodeURIComponent(file.id)}:${encodeURIComponent(journalId ?? `record-${sourceRecord}`)}${duplicated ? `:record-${sourceRecord}` : ''}`
    const raw = {
      journalId: text(row.raw_journal_id),
      postingDate: text(row.raw_posting_date),
      period: text(row.raw_period),
      storeKey: text(row.raw_store_key),
      storeCode: text(row.raw_store_code),
      channel: text(row.raw_channel),
      amount: text(row.raw_amount),
      journalType: text(row.raw_journal_type),
      sourceRef: text(row.raw_source_ref),
      description: text(row.raw_description),
    }
    const amountCents = cents(row.amount_usd)
    const original = {
      postingDate: text(row.posting_date),
      period: text(row.period),
      storeKey: String(row.store_key),
      channel: String(row.channel),
      amountCents,
      revenueCents: amountCents === null ? null : -amountCents,
    }
    const record: GLRecord = {
      id,
      sourceFingerprint: glFingerprint({
        values: text(row.source_values),
        fileName: file.file.name,
        normalized: original,
      }),
      configurationVersion,
      fileId: file.id,
      fileName: file.file.name,
      sheetName:
        mapping?.sheetName ??
        sheetNames.get(file.id) ??
        (file.file.name.toLowerCase().endsWith('.csv')
          ? 'CSV'
          : 'Không xác định'),
      sourceRow,
      sourceRecord,
      journalId,
      journalType: text(row.journal_type),
      ...original,
      storeCode: text(row.store_code),
      sourceRef: text(row.source_ref)?.trim() || null,
      description: text(row.description)?.trim() || null,
      amountBasis: row.amount_basis === 'revenue' ? 'revenue' : 'ledger',
      raw,
      original,
      staleCorrection: false,
    }
    record.sourceValues = sourceValues.get(file.id)?.[sourceRecord - 1]
    const diagnostic = (
      code: string,
      field: string,
      value: string | null,
      reason: string,
      blocking: boolean,
    ) =>
      diagnostics.push({
        id: `${id}:${code}`,
        code,
        recordId: id,
        journalId,
        field,
        value,
        fileName: record.fileName,
        sheetName: record.sheetName,
        sourceRow,
        reason,
        blocking,
      })
    const transformation = (
      rule: string,
      sourceField: string,
      outputField: string,
      before: string | null,
      after: string | null,
      impactCents = 0,
    ) =>
      transformations.push({
        id: `${id}:${rule}:${outputField}`,
        rule,
        recordId: id,
        journalId,
        sourceField,
        outputField,
        before,
        after,
        impactCents,
      })
    if (amountCents !== null) {
      const representationImpact =
        record.amountBasis === 'ledger' ? BigInt(-amountCents) * 2n : 0n
      if (
        representationImpact > BigInt(Number.MAX_SAFE_INTEGER) ||
        representationImpact < BigInt(Number.MIN_SAFE_INTEGER)
      )
        diagnostic(
          'GL_REPRESENTATION_RANGE',
          'amount_usd',
          raw.amount,
          'Tác động đổi quy ước dấu vượt phạm vi xu chính xác.',
          true,
        )
      else
        transformation(
          record.amountBasis === 'ledger'
            ? 'Chuẩn hóa dấu sổ cái sang doanh thu'
            : 'Giữ cơ sở doanh thu đã chuẩn hóa',
          String(row.amount_source_field),
          'revenue_usd',
          raw.amount,
          centsSQL(-amountCents),
          Number(representationImpact),
        )
    }
    if (record.storeKey === '-1')
      transformation(
        'Ánh xạ nhóm kỹ thuật Chưa phân bổ',
        'store_key',
        'store_key',
        raw.storeKey,
        '-1',
      )
    if (!raw.channel?.trim())
      transformation(
        'Xác định kênh từ nhóm kỹ thuật / khóa đã ánh xạ',
        'store_key',
        'channel',
        raw.channel,
        record.channel,
      )
    if (!raw.period?.trim() && record.period)
      transformation(
        'Suy ra kỳ từ ngày hạch toán',
        'posting_date',
        'period',
        raw.period,
        record.period,
      )
    else if (raw.period !== record.period)
      transformation(
        'Chuẩn hóa kỳ hạch toán',
        'period',
        'period',
        raw.period,
        record.period,
      )
    for (const [key, output] of [
      ['journalId', record.journalId],
      ['journalType', record.journalType],
      ['channel', record.channel],
      ['storeKey', record.storeKey],
      ['sourceRef', record.sourceRef],
      ['description', record.description],
    ] as const)
      if (
        raw[key] != null &&
        raw[key] !== output &&
        !(key === 'storeKey' && record.storeKey === '-1')
      )
        transformation('Chuẩn hóa văn bản / mã', key, key, raw[key], output)
    if (
      raw.postingDate &&
      record.postingDate &&
      raw.postingDate !== record.postingDate
    )
      transformation(
        'Parse ngày theo cấu hình nguồn',
        'posting_date',
        'posting_date',
        raw.postingDate,
        record.postingDate,
      )
    const corrections = (options.corrections ?? []).filter(
      (correction) => correction.active && correction.recordId === id,
    )
    for (const correction of corrections) {
      if (journalId && (allJournalCounts.get(journalId) ?? 0) > 1) {
        diagnostic(
          'GL_AMBIGUOUS_CORRECTION',
          'journal_id',
          journalId,
          'Không áp dụng chỉnh sửa khi Journal ID trùng và chưa xác định bản ghi nguồn duy nhất.',
          true,
        )
        continue
      }
      if (
        correction.sourceFingerprint !== record.sourceFingerprint ||
        correction.configurationVersion !== configurationVersion
      ) {
        record.staleCorrection = true
        diagnostic(
          'GL_STALE_CORRECTION',
          'source_fingerprint',
          correction.sourceFingerprint,
          'Nguồn hoặc cấu hình đã thay đổi; chỉnh sửa cũ không được áp dụng, cần rà soát lại.',
          false,
        )
        continue
      }
      try {
        validateGLPatch(record, correction.patch, correction.reason)
      } catch (error) {
        diagnostic(
          'GL_INVALID_CORRECTION',
          'correction',
          correction.id,
          error instanceof Error ? error.message : String(error),
          true,
        )
        continue
      }
      const patch = correction.patch
      const assignments: string[] = []
      if (patch.amountCents !== undefined) {
        record.amountCents = patch.amountCents
        record.revenueCents = -patch.amountCents
        assignments.push(`amount_usd = ${centsSQL(patch.amountCents)}`)
      }
      if (patch.postingDate !== undefined) {
        record.postingDate = patch.postingDate
        record.period = patch.period ?? patch.postingDate.slice(0, 7)
        assignments.push(
          `posting_date = DATE ${literal(patch.postingDate)}`,
          `period = ${literal(record.period)}`,
        )
      }
      if (patch.period !== undefined && patch.postingDate === undefined) {
        record.period = patch.period
        assignments.push(`period = ${literal(patch.period)}`)
      }
      if (patch.storeKey !== undefined) {
        record.storeKey = patch.storeKey.trim().toUpperCase()
        assignments.push(`store_key = ${literal(record.storeKey)}`)
      }
      if (patch.channel !== undefined) {
        record.channel = patch.channel
        assignments.push(`channel = ${literal(patch.channel)}`)
      }
      if (assignments.length)
        await connection.query(
          `UPDATE gl_clean SET ${assignments.join(', ')} WHERE __reconcile_file_order = ${Number(row.__reconcile_file_order)} AND __reconcile_row_order = ${Number(row.__reconcile_row_order)}`,
        )
    }
    if (!record.journalId)
      diagnostic(
        'GL_JOURNAL_ID_MISSING',
        'journal_id',
        raw.journalId,
        'Thiếu định danh journal; không thể tính GL đầy đủ.',
        true,
      )
    if (!record.journalType)
      diagnostic(
        'GL_JOURNAL_TYPE_MISSING',
        'journal_type',
        raw.journalType,
        'Thiếu loại bút toán. MANUAL hợp lệ không phải lỗi.',
        true,
      )
    if (!record.postingDate)
      diagnostic(
        'GL_POSTING_DATE_INVALID',
        'posting_date',
        raw.postingDate,
        'Ngày hạch toán không đọc được hoặc không hợp lệ; kiểm tra ánh xạ nguồn.',
        true,
      )
    if (record.amountCents === null)
      diagnostic(
        'GL_AMOUNT_INVALID',
        'amount_usd',
        raw.amount,
        'Số tiền không đọc được hoặc vượt phạm vi xu USD chính xác; không được loại dòng và công bố tổng thiếu.',
        true,
      )
    if ((record.storeKey === '-1') !== (record.channel === 'UNALLOCATED'))
      diagnostic(
        'GL_ALLOCATION_CONFLICT',
        'store_key/channel',
        `${raw.storeKey ?? '(trống)'}/${raw.channel ?? '(trống)'}`,
        'Khóa Chưa phân bổ -1 phải đi với kênh UNALLOCATED; phân bổ hiện tại mâu thuẫn và cần người dùng quyết định.',
        true,
      )
    if (!['STORE', 'WEB', 'UNALLOCATED'].includes(record.channel))
      diagnostic(
        'GL_CHANNEL_INVALID',
        'channel',
        raw.channel,
        'Kênh chưa được ánh xạ sang STORE, WEB hoặc UNALLOCATED.',
        true,
      )
    if (
      record.period &&
      record.postingDate &&
      record.period !== record.postingDate.slice(0, 7)
    )
      diagnostic(
        'GL_PERIOD_REVIEW',
        'period',
        raw.period,
        'Kỳ nguồn khác tháng của ngày hạch toán; giữ nguyên và chờ Finance xác nhận.',
        false,
      )
    records.push(record)
  }
  const journalCounts = new Map<string, number>()
  for (const record of records)
    if (record.journalId)
      journalCounts.set(
        record.journalId,
        (journalCounts.get(record.journalId) ?? 0) + 1,
      )
  for (const record of records)
    if (record.journalId && journalCounts.get(record.journalId)! > 1)
      diagnostics.push({
        id: `${record.id}:GL_JOURNAL_ID_DUPLICATE:${record.sourceRow}`,
        code: 'GL_JOURNAL_ID_DUPLICATE',
        recordId: record.id,
        journalId: record.journalId,
        field: 'journal_id',
        value: record.raw.journalId,
        fileName: record.fileName,
        sheetName: record.sheetName,
        sourceRow: record.sourceRow,
        reason:
          'Journal ID trùng giữa các dòng/tệp; source_ref lặp giữa hai journal độc lập vẫn hợp lệ.',
        blocking: true,
      })
  return {
    runId: options.runId,
    records,
    transformations,
    diagnostics,
    configurationVersion,
    complete: !diagnostics.some((issue) => issue.blocking),
  }
}
