import type { EngineProgressEvent } from './processing-progress.ts'
import { captureDashboardSnapshot } from './dashboard-model.ts'
import { captureRunFailure, type RunFailure } from './run-failure.ts'
import { captureValidationFailure } from './validation-failure.ts'
import { ACCOUNTING_GL_SQL, prepareGLReview } from './gl-pipeline.ts'
import {
  GLValidationError,
  type GLCorrection,
  type GLReviewSnapshot,
} from './gl-review.ts'
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import {
  MAX_FILES,
  MAX_BATCH_BYTES,
  REQUIRED_SOURCES,
  SOURCES,
  validateFile,
  type QueuedFile,
  type Source,
} from './uploads.ts'
import {
  BRIDGE_KEYS,
  type BridgeKey,
  type BridgeMetrics,
  type ReconciliationPeriod,
  type ReconciliationResult,
  type DimTableInfo,
} from './reconciliation-types.ts'
import {
  bridgeSQL,
  DAILY_SQL,
  dailyDifferenceSQL,
  exceptionSQL,
  NORMALIZATION_SQL,
  VALIDATION_SQL,
} from './reconciliation-sql.ts'
import { REQUIRED_COLUMNS } from './reconciliation-schema.ts'
import type { ReconciliationException } from './exceptions.ts'
import type { DecodedSheet } from './spreadsheet-types.ts'
import type { ConfirmedFileMapping } from './data-mapping.ts'
import { validateHeaderRow } from './header-row.ts'
import {
  masterConfigurationIssues,
  REFERENCE_ROLES,
  type MasterConfiguration,
  type MasterValidation,
  type JoinValidation,
} from './master-data.ts'
import { buildMasterJoins } from './master-joins.ts'
import {
  accountingProjection,
  ACCOUNTING_POS_STAGING_SQL,
  ACCOUNTING_POS_CLASSIFICATION_SQL,
  ACCOUNTING_POS_CLEANING_SQL,
  ACCOUNTING_POS_MAPPING_SQL,
  ACCOUNTING_POS_CONVERSION_SQL,
  ACCOUNTING_POS_FACT_SQL,
  POS_ROW_ISSUES,
  POS_STAGING_ISSUES,
} from './reconciliation-accounting.ts'
import {
  capturePosDiagnostics,
  PosValidationError,
  type PosDiagnostics,
} from './pos-diagnostics.ts'
import {
  compatibleProjection,
  type SchemaMode,
} from './reconciliation-compatibility.ts'
import {
  captureRunEvidence,
  type EvidenceFileConfig,
  type EvidenceValidation,
  type ProcessingPhase,
} from './reconciliation-evidence.ts'

type Database = Pick<
  AsyncDuckDB,
  'registerFileBuffer' | 'registerFileText' | 'dropFile' | 'connect'
>
export type SpreadsheetDecoder = (
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow?: number,
  format?: 'csv' | 'xlsx',
) => Promise<string>
export type DimSpreadsheetDecoder = (
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow?: number,
  selectedSheets?: Record<string, { headerRow: number }>,
) => Promise<DecodedSheet[]>
export interface UploadProcessingOptions {
  onFailure?: (failure: RunFailure) => void
  glCorrections?: readonly GLCorrection[]
  onGLSnapshot?: (snapshot: GLReviewSnapshot) => void
  signal?: AbortSignal
  onFileRegistered?: (id: string) => void
  onQueryStart?: () => void
  /** Actual awaited processing stages; no estimated progress or timer animation. */
  onPhaseChange?: (phase: ProcessingPhase) => void
  onProgress?: (event: EngineProgressEvent) => void
  onDimTablesReady?: (tables: DimTableInfo[]) => void
  canReconcile?: boolean
  columnMappings?: readonly ConfirmedFileMapping[]
  masterConfiguration?: MasterConfiguration | null
  validationOnly?: boolean
  onMasterValidation?: (validation: MasterValidation) => void
  masterFingerprint?: string
}
export interface ReconciliationEngineOptions {
  /** Accounting is the production default; compatible is a legacy preview only. */
  schemaMode?: SchemaMode
  onWarning?: (warning: string) => void
}
const locks = new WeakMap<Database, Promise<void>>()
export { MAX_BATCH_BYTES } from './uploads.ts'
export const SCHEMA = REQUIRED_COLUMNS

class PeriodValidationError extends Error {
  readonly reasonCode: string
  readonly fields: string[]
  constructor(message: string, reasonCode: string, fields: string[]) {
    super(message)
    this.name = 'PeriodValidationError'
    this.reasonCode = reasonCode
    this.fields = fields
  }
}
export function validatePeriod(period: ReconciliationPeriod): void {
  for (const value of [period.start, period.end]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new PeriodValidationError(
        'Use valid ISO dates (YYYY-MM-DD) for the reporting period.',
        'REPORTING_PERIOD_DATE_INVALID',
        ['period.start', 'period.end'],
      )
  }
  if (period.start > period.end)
    throw new PeriodValidationError(
      'The period end must be on or after its start.',
      'REPORTING_PERIOD_ORDER_INVALID',
      ['period.start', 'period.end'],
    )
  const last = new Date(`${period.end}T00:00:00Z`)
  last.setUTCDate(last.getUTCDate() + 1)
  if (!period.start.endsWith('-01') || last.getUTCDate() !== 1)
    throw new PeriodValidationError(
      'Use complete calendar months: Flash is supplied at month-end grain.',
      'REPORTING_PERIOD_INCOMPLETE_MONTH',
      ['period.start', 'period.end'],
    )
}

function checkAbort(signal?: AbortSignal) {
  signal?.throwIfAborted()
}
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`
function exactCents(value: unknown): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match)
    throw new Error(`Unexpected financial aggregate: ${String(value)}`)
  const cents =
    (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))) *
    (match[1] ? -1n : 1n)
  if (
    cents > BigInt(Number.MAX_SAFE_INTEGER) ||
    cents < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error(
      'The financial total exceeds the supported exact-cent range.',
    )
  return Number(cents)
}

/** A run owns its connection, temporary relations, and virtual files. */
export class ReconciliationEngine {
  private database: Database
  private decodeSpreadsheet: SpreadsheetDecoder
  private decodeDimSpreadsheet: DimSpreadsheetDecoder
  private schemaMode: SchemaMode
  private onWarning: (warning: string) => void
  constructor(
    database: Database,
    decodeSpreadsheet?: SpreadsheetDecoder,
    decodeDimSpreadsheet?: DimSpreadsheetDecoder,
    options: ReconciliationEngineOptions = {},
  ) {
    this.database = database
    this.schemaMode = options.schemaMode ?? 'accounting'
    this.onWarning =
      options.onWarning ??
      ((warning) => console.warn(`[Reconciliation mapping] ${warning}`))
    this.decodeSpreadsheet =
      decodeSpreadsheet ??
      ((buffer, signal, headerRow = 1, format = 'xlsx') =>
        import('./spreadsheet.ts').then(({ workbookToCSV }) =>
          workbookToCSV(buffer, signal, headerRow, format),
        ))
    this.decodeDimSpreadsheet =
      decodeDimSpreadsheet ??
      ((buffer, signal, headerRow = 1, selectedSheets) =>
        import('./spreadsheet.ts').then(({ workbookToSheets }) =>
          workbookToSheets(buffer, signal, headerRow, selectedSheets),
        ))
  }

  async run(
    files: QueuedFile[],
    period: ReconciliationPeriod,
    signal?: AbortSignal,
    options: Omit<UploadProcessingOptions, 'signal'> = {},
  ): Promise<ReconciliationResult> {
    validatePeriod(period)
    this.validateFiles(files)
    for (const source of REQUIRED_SOURCES)
      if (!files.some((entry) => entry.source === source))
        throw new Error(`Add at least one ${source} file.`)
    const result = await this.processUploads(files, period, {
      ...options,
      signal,
    })
    if (!result) throw new Error('All four sources are required to reconcile.')
    return result
  }

  private validateFiles(files: QueuedFile[]): void {
    if (
      files.some((entry) => entry.sample) &&
      !files.every((entry) => entry.sample)
    )
      throw new Error('Remove sample files before reconciling uploaded data.')
    if (!files.length || files.length > MAX_FILES)
      throw new Error(`Select 1–${MAX_FILES} source files.`)
    for (const entry of files) {
      const issue = validateFile(entry.file)
      if (issue) throw new Error(issue)
      if (!SOURCES.includes(entry.source as Source))
        throw new Error(`Choose a source for ${entry.file.name}.`)
      validateHeaderRow(entry.headerRow ?? 1)
    }
    if (
      files.reduce((sum, entry) => sum + entry.file.size, 0) > MAX_BATCH_BYTES
    )
      throw new Error('The batch exceeds the 200 MiB memory limit.')
  }

  /** Register partial uploads immediately; calculate only once all four sources exist. */
  async processUploads(
    files: QueuedFile[],
    period: ReconciliationPeriod,
    options: UploadProcessingOptions = {},
  ): Promise<ReconciliationResult | null> {
    // Empty batches clear an earlier Dim selection without requiring fact files.
    if (files.length) this.validateFiles(files)

    // Serialize runs on a shared database. Aborted/stale results never replace current results.
    const previous = locks.get(this.database) ?? Promise.resolve()
    const operation = previous
      .catch(() => undefined)
      .then(() => this.execute(files, period, options))
    const settled = operation.then(
      () => undefined,
      () => undefined,
    )
    locks.set(this.database, settled)
    try {
      return await operation
    } finally {
      if (locks.get(this.database) === settled) locks.delete(this.database)
    }
  }

  /** File names are generated internally: uploaded names never enter SQL. */
  private async registerFiles(
    files: QueuedFile[],
    registered: string[],
    signal?: AbortSignal,
    onFileRegistered?: (id: string) => void,
    masterConfiguration?: MasterConfiguration | null,
    onFileStart?: (file: QueuedFile) => void,
  ) {
    const paths = new Map<Source, string[]>(
      SOURCES.map((source) => [source, []]),
    )
    const runId = crypto.randomUUID().replaceAll('-', '')
    let totalBytes = 0
    const dimSheets: { name: string; path: string }[] = []
    const dimNames = new Set<string>()
    const fileNames = new Map<string, string>()
    const fileIds = new Map<string, string>()
    for (const [index, entry] of files.entries()) {
      if (
        entry.source === 'Dim' &&
        masterConfiguration !== undefined &&
        (!masterConfiguration || masterConfiguration.fileId !== entry.id)
      )
        continue
      checkAbort(signal)
      onFileStart?.(entry)
      const buffer = await entry.file.arrayBuffer()
      checkAbort(signal)
      const isExcel = entry.file.name.toLowerCase().endsWith('.xlsx')
      const headerRow = entry.headerRow ?? 1
      const selectedSheets =
        entry.source === 'Dim' && masterConfiguration
          ? Object.fromEntries(
              REFERENCE_ROLES.flatMap((role) => {
                const ref = masterConfiguration.roles[role]
                return ref.usage === 'enabled'
                  ? [[ref.sheetName, masterConfiguration.sheets[ref.sheetName]]]
                  : []
              }),
            )
          : undefined
      let sheets: (DecodedSheet | { name: string; bytes: Uint8Array })[]
      try {
        if (isExcel || headerRow !== 1) {
          sheets =
            entry.source === 'Dim' && isExcel
              ? await this.decodeDimSpreadsheet(
                  buffer,
                  signal,
                  headerRow,
                  selectedSheets,
                )
              : [
                  {
                    name:
                      entry.source === 'Dim'
                        ? entry.file.name.replace(/\.csv$/i, '')
                        : entry.source,
                    csv: await this.decodeSpreadsheet(
                      buffer,
                      signal,
                      selectedSheets
                        ? Object.values(selectedSheets)[0].headerRow
                        : headerRow,
                      isExcel ? 'xlsx' : 'csv',
                    ),
                  },
                ]
          if (!sheets.length) throw new Error('No dimension sheets found.')
        } else {
          sheets = [
            {
              name:
                entry.source === 'Dim'
                  ? entry.file.name.replace(/\.csv$/i, '')
                  : entry.source,
              bytes: new Uint8Array(buffer),
            },
          ]
        }
      } catch (error) {
        checkAbort(signal)
        throw new Error(
          `${entry.file.name} (${entry.source}): ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      if (entry.source === 'Dim' && selectedSheets) {
        if (!isExcel)
          sheets = sheets.map((sheet) => ({
            ...sheet,
            name: Object.keys(selectedSheets)[0],
          }))
        sheets = sheets.filter((sheet) =>
          Object.hasOwn(selectedSheets, sheet.name),
        )
        for (const name of Object.keys(selectedSheets))
          if (!sheets.some((sheet) => sheet.name === name))
            throw new Error(`Selected worksheet no longer exists: ${name}`)
      }
      for (const [sheetIndex, sheet] of sheets.entries()) {
        checkAbort(signal)
        if (entry.source === 'Dim') {
          if (!sheet.name.trim() || dimNames.has(sheet.name.toLowerCase()))
            throw new Error(
              `Dim sheet names must be non-empty and unique: ${sheet.name}`,
            )
          dimNames.add(sheet.name.toLowerCase())
        }
        totalBytes +=
          'csv' in sheet
            ? new TextEncoder().encode(sheet.csv).byteLength
            : sheet.bytes.byteLength
        if (totalBytes > MAX_BATCH_BYTES)
          throw new Error(`${entry.file.name}: expanded batch exceeds 200 MiB.`)
        const basename =
          entry.source === 'Dim'
            ? sheet.name.replace(/[^a-zA-Z0-9_-]/g, '_')
            : entry.source.toLowerCase()
        const path = `reconcile_${runId}_${index}_${sheetIndex}_${basename}.csv`
        // Excel has already been parsed by SheetJS. DuckDB receives CSV text only;
        // POS/WEB CSV uploads retain the direct byte-buffer registration path.
        if ('csv' in sheet)
          await this.database.registerFileText(path, sheet.csv)
        else await this.database.registerFileBuffer(path, sheet.bytes)
        registered.push(path)
        fileNames.set(path, entry.file.name)
        fileIds.set(path, entry.id)
        paths.get(entry.source as Source)!.push(path)
        if (entry.source === 'Dim') dimSheets.push({ name: sheet.name, path })
      }
      checkAbort(signal)
      onFileRegistered?.(entry.id)
    }
    return { paths, dimSheets, fileNames, fileIds }
  }

  private async loadDimTables(
    connection: AsyncDuckDBConnection,
    sheets: { name: string; path: string }[],
    signal?: AbortSignal,
  ): Promise<DimTableInfo[]> {
    const tables: DimTableInfo[] = []
    await connection.query('BEGIN TRANSACTION')
    try {
      for (const sheet of sheets) {
        checkAbort(signal)
        const table = `dim.${quoteIdentifier(sheet.name)}`
        // Materialize data so it survives connection close and virtual-file cleanup.
        // Preserve dimension keys and rate text; future joins can cast explicit columns.
        await connection.query(
          `CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${sheet.path}', header=true, all_varchar=true)`,
        )
        const columns = (
          await connection.query(`SELECT * FROM ${table} LIMIT 0`)
        ).schema.fields.map((field) => field.name)
        const count = await connection.query(
          `SELECT CAST(COUNT(*) AS VARCHAR) AS n FROM ${table}`,
        )
        tables.push({
          name: sheet.name,
          rowCount: Number(count.toArray()[0].n),
          columns,
        })
      }
      checkAbort(signal)
      await connection.query('COMMIT')
      return tables
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  }

  private async execute(
    files: QueuedFile[],
    period: ReconciliationPeriod,
    options: UploadProcessingOptions,
  ): Promise<ReconciliationResult | null> {
    const { signal, onFileRegistered, onQueryStart } = options
    const runId = crypto.randomUUID()
    let activePhase: ProcessingPhase = 'registering'
    let progressContext: Pick<
      EngineProgressEvent,
      'source' | 'fileId' | 'fileName'
    > = {}
    const emit = (value: Omit<EngineProgressEvent, 'runId'>) => {
      checkAbort(signal)
      options.onProgress?.({ ...progressContext, ...value, runId })
    }
    const phase = (value: ProcessingPhase) => {
      activePhase = value
      progressContext = {}
      checkAbort(signal)
      options.onPhaseChange?.(value)
      emit({ phase: value, status: 'running' })
    }
    const done = (
      value: ProcessingPhase,
      data: Partial<EngineProgressEvent> = {},
    ) => emit({ phase: value, status: 'completed', ...data })
    let connection: AsyncDuckDBConnection | undefined
    let posDiagnostics: PosDiagnostics | undefined
    let glReview: GLReviewSnapshot | undefined
    let validationFailure: Partial<RunFailure> | undefined
    const registered: string[] = []
    try {
      checkAbort(signal)
      phase('registering')
      connection = await this.database.connect()
      // This app owns the dim namespace. Clear stale dimensions on replacement/removal,
      // including when parsing the next workbook fails, before accepting another snapshot.
      await connection.query('DROP SCHEMA IF EXISTS dim CASCADE')
      await connection.query('CREATE SCHEMA dim')
      const master =
        this.schemaMode === 'accounting'
          ? (options.masterConfiguration ?? null)
          : options.masterConfiguration
      if (
        this.schemaMode === 'accounting' &&
        files.some((f) => f.source === 'Dim') &&
        !master
      )
        throw new Error(
          'Confirm Master / Dim mappings and joins, or remove the workbook.',
        )
      if (master && this.schemaMode !== 'accounting')
        throw new Error(
          'Configured Master / Dim relationships require the accounting pipeline.',
        )
      if (
        this.schemaMode === 'accounting' &&
        files.filter((f) => f.source === 'Dim').length > 1
      )
        throw new Error('Use one combined Master workbook.')
      if (master) {
        const issues = masterConfigurationIssues(master)
        if (!files.some((f) => f.id === master.fileId && f.source === 'Dim'))
          issues.push('Master workbook no longer exists.')
        if (issues.length) throw new Error(issues.join('\n'))
      }
      const { paths, dimSheets, fileNames, fileIds } = await this.registerFiles(
        files,
        registered,
        signal,
        (fileId) => {
          onFileRegistered?.(fileId)
          const file = files.find((entry) => entry.id === fileId)
          emit({
            phase: 'registering',
            status: 'running',
            fileId,
            fileName: file?.file.name,
            source: file?.source,
            detail: `Đã đọc ${file?.file.name ?? fileId}`,
          })
        },
        master,
        (file) => {
          progressContext = {
            source: file.source,
            fileId: file.id,
            fileName: file.file.name,
          }
          emit({
            phase: 'registering',
            status: 'running',
            detail: `Đang đọc ${file.file.name}`,
          })
        },
      )
      checkAbort(signal)
      done('registering', {
        metrics: [{ label: 'Tệp đã đọc', value: files.length }],
        tableIds: files
          .filter((file) => file.source !== 'Dim' && file.source !== '')
          .map((file) => `uploaded:${file.id}`),
      })
      phase('dimensions')
      const dimTables = await this.loadDimTables(connection, dimSheets, signal)
      checkAbort(signal)
      options.onDimTablesReady?.(dimTables)
      done('dimensions', {
        status: dimTables.length ? 'completed' : 'not-applicable',
        detail: dimTables.length
          ? 'Các bảng tham chiếu đã nạp.'
          : 'Không có bảng tham chiếu được sử dụng trong phiên này.',
        metrics: dimTables.map((table) => ({
          label: table.name,
          value: `${table.rowCount} dòng`,
        })),
        tableIds: dimTables.map((table) => `dim:${table.name}`),
      })
      if (
        options.canReconcile === false ||
        REQUIRED_SOURCES.some((source) => !paths.get(source)!.length)
      )
        return null
      validatePeriod(period)
      onQueryStart?.()
      const rowCounts = {} as ReconciliationResult['rowCounts']
      let posPostingDateFallback = false
      const compatibilityWarnings: string[] = []
      const fileConfigs: EvidenceFileConfig[] = []
      const validations: EvidenceValidation[] = []
      const masterJoins: JoinValidation[] = []
      const deferredPosMasterErrors: string[] = []
      if (this.schemaMode === 'compatible') {
        const warning =
          'Temporary preview: all POS, WEB, GL, and Flash row-integrity checks are disabled, including key uniqueness and date/status/amount checks. Blank keys use generated IDs or NX001; invalid dates use the reporting period, order date, or delivery date; unknown statuses use Delivered; invalid amounts use 0. Slash dates use MM/DD/YYYY first. Results are provisional.'
        compatibilityWarnings.push(warning)
        this.onWarning(warning)
      }
      phase('projecting')
      for (const source of REQUIRED_SOURCES) {
        const selects: string[] = []
        for (const [fileIndex, path] of paths.get(source)!.entries()) {
          checkAbort(signal)
          progressContext = {
            source,
            fileId: fileIds.get(path),
            fileName: fileNames.get(path),
          }
          emit({
            phase: 'projecting',
            status: 'running',
            detail: `Đang kiểm tra ${source}: ${fileNames.get(path)}`,
          })
          const schema = await connection.query(
            `SELECT * FROM read_csv_auto('${path}', header=true, all_varchar=true) LIMIT 0`,
          )
          const columns = new Set(
            schema.schema.fields.map((field) => field.name),
          )
          const missing = SCHEMA[source].filter(
            (column) => !columns.has(column),
          )
          if (missing.length && this.schemaMode === 'strict')
            throw new Error(
              `${source}: missing columns: ${missing.join(', ')}. See the source schema below.`,
            )
          const needsPostingDate =
            source === 'POS' && !columns.has('posting_date')
          if (this.schemaMode === 'accounting') {
            let adapter: ReturnType<typeof accountingProjection>
            let joins: Awaited<ReturnType<typeof buildMasterJoins>> | undefined
            try {
              const mapping = options.columnMappings?.find(
                (entry) => entry.fileId === fileIds.get(path),
              )
              if (
                options.columnMappings &&
                (!mapping || mapping.source !== source)
              )
                throw new Error(
                  `Missing confirmed ${source} mapping for this file. Reopen Import Data.`,
                )
              adapter = accountingProjection(
                source,
                [...columns],
                mapping?.columns,
                {},
                { glAmountBasis: mapping?.glAmountBasis },
              )
              if (master) {
                joins = await buildMasterJoins(connection, {
                  config: master,
                  source,
                  fileId: fileIds.get(path)!,
                  path,
                  columns: adapter.resolvedColumns,
                  signal,
                  onCheck: (context) =>
                    emit({
                      phase: 'projecting',
                      status: 'running',
                      source: context.source,
                      fileId: context.fileId,
                      detail: `Kiểm tra khóa và phép nối: ${context.role} · ${source}`,
                    }),
                  onResult: (report) =>
                    emit({
                      phase: 'projecting',
                      status: 'running',
                      joins: [report],
                    }),
                })
                masterJoins.push(...joins.reports)
                if (
                  source === 'POS' ||
                  !joins.reports.some((report) => report.errors.length)
                )
                  adapter = accountingProjection(
                    source,
                    [...columns],
                    mapping?.columns,
                    joins.overrides,
                    { glAmountBasis: mapping?.glAmountBasis },
                  )
              }
            } catch (error) {
              throw new Error(
                `${fileNames.get(path)}: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
            if (adapter.posPostingDateFallback) posPostingDateFallback = true
            const selectedFile = files.find(
              (file) => file.id === fileIds.get(path),
            )!
            fileConfigs.push({
              fileId: selectedFile.id,
              fileName: selectedFile.file.name,
              source,
              headerRow: selectedFile.headerRow ?? 1,
              mappingMode: options.columnMappings ? 'confirmed' : 'native',
              columns: adapter.resolvedColumns,
              netStrategy: adapter.netStrategy,
              notes: [...adapter.notes],
            })
            const notes = adapter.notes.map(
              (note) => `${source} (${fileNames.get(path)}): ${note}`,
            )
            compatibilityWarnings.push(...notes)
            notes.forEach(this.onWarning)
            const usableJoins =
              source === 'POS' ||
              joins?.reports.every((report) => report.errors.length === 0)
                ? joins
                : undefined
            selects.push(
              `SELECT ${adapter.projection}${usableJoins?.outputs.length ? ', ' + usableJoins.outputs.join(', ') : ''}, ${fileIndex} AS __reconcile_file_order, ${usableJoins?.ordinal ?? 'ROW_NUMBER() OVER ()'} AS __reconcile_row_order FROM ${usableJoins?.from ?? `read_csv_auto('${path}', header=true, all_varchar=true) AS input`}`,
            )
          } else if (this.schemaMode === 'compatible') {
            const adapter = compatibleProjection(
              source,
              [...columns],
              period,
              fileIndex,
            )
            if (adapter.posPostingDateFallback) posPostingDateFallback = true
            const context = `${source} (${fileNames.get(path)}): `
            compatibilityWarnings.push(
              ...adapter.warnings.map((warning) => context + warning),
            )
            if (adapter.warnings.length)
              this.onWarning(context + adapter.warnings.join(' '))
            selects.push(
              `SELECT ${adapter.projection}, ${fileIndex} AS __reconcile_file_order, ROW_NUMBER() OVER () AS __reconcile_row_order FROM read_csv_auto('${path}', header=true, all_varchar=true)`,
            )
          } else {
            if (needsPostingDate) posPostingDateFallback = true
            selects.push(
              `SELECT *${needsPostingDate ? ', business_date AS posting_date' : ''}, ${fileIndex} AS __reconcile_file_order, ROW_NUMBER() OVER () AS __reconcile_row_order FROM read_csv_auto('${path}', header=true, all_varchar=true)`,
            )
          }
        }
        await connection.query(
          `CREATE TEMP TABLE raw_${source.toLowerCase()} AS ${selects.join(' UNION ALL BY NAME ')}`,
        )
        const count = await connection.query(
          `SELECT CAST(COUNT(*) AS VARCHAR) AS n FROM raw_${source.toLowerCase()}`,
        )
        rowCounts[source] = Number(count.toArray()[0].n)
      }
      if (master) {
        const errors = masterJoins.flatMap((report) =>
          report.errors.map(
            (error) => `${report.source} / ${report.role}: ${error}`,
          ),
        )
        const validation: MasterValidation = {
          fingerprint: options.masterFingerprint ?? '',
          scope: 'full',
          passed: errors.length === 0,
          joins: masterJoins,
          errors,
        }
        options.onMasterValidation?.(validation)
        if (errors.length) {
          const failed = masterJoins.find((report) => report.errors.length)
          if (failed)
            progressContext = {
              source: failed.source,
              fileId: failed.fileId,
              fileName: files.find((file) => file.id === failed.fileId)?.file
                .name,
            }
          if (options.validationOnly) return null
          const blocking = masterJoins
            .filter((report) => report.source !== 'POS')
            .flatMap((report) => report.errors)
          if (blocking.length) throw new Error(errors.join('\n'))
          deferredPosMasterErrors.push(...errors)
        }
      }
      done('projecting', {
        metrics: Object.entries(rowCounts).map(([source, count]) => ({
          label: `${source} sau projection`,
          value: `${count} dòng`,
        })),
        tableIds: ['raw_pos', 'raw_web', 'raw_gl', 'raw_flash'],
      })
      if (options.validationOnly) return null
      const normalization =
        this.schemaMode === 'accounting'
          ? [
              ...ACCOUNTING_POS_STAGING_SQL,
              ...NORMALIZATION_SQL.slice(3, 5),
              ...ACCOUNTING_GL_SQL,
              ...NORMALIZATION_SQL.slice(7),
            ]
          : NORMALIZATION_SQL
      phase('normalizing')
      for (const sql of normalization) {
        checkAbort(signal)
        await connection.query(sql)
      }
      if (this.schemaMode === 'accounting') {
        glReview = await prepareGLReview(connection, {
          runId,
          files,
          columnMappings: options.columnMappings,
          configuration: {
            parserVersion: 'gl-normalization-v1',
            files: files
              .filter((file) => file.source === 'GL')
              .map((file) => ({
                id: file.id,
                headerRow: file.headerRow ?? 1,
                fileName: file.file.name,
              })),
            mappings:
              options.columnMappings?.filter(
                (mapping) => mapping.source === 'GL',
              ) ?? 'native-ledger-contract-v1',
            master: master ?? null,
          },
          corrections: options.glCorrections,
          glPaths: paths.get('GL'),
          signal,
        })
        options.onGLSnapshot?.(glReview)
      }
      if (this.schemaMode === 'accounting') {
        const invalid = POS_STAGING_ISSUES.map(
          (rule) => `(${rule.where})`,
        ).join(' OR ')
        const staged = await connection.query(
          `SELECT COUNT(*) AS n FROM pos_staging WHERE ${invalid}`,
        )
        if (Number(staged.toArray()[0].n)) {
          posDiagnostics = await capturePosDiagnostics(connection, {
            runId,
            rules: POS_STAGING_ISSUES,
            files,
            paths,
            fileIds,
            signal,
            relation: 'pos_staging',
            branches: ['raw_pos', 'pos_staging'],
          })
          progressContext = { source: 'POS' }
          throw new PosValidationError(posDiagnostics)
        }
      }
      const normalizedCounts = await connection.query(
        `SELECT (SELECT COUNT(*) FROM ${this.schemaMode === 'accounting' ? 'pos_staging' : 'vw_pos'}) AS pos_rows, (SELECT COUNT(*) FROM vw_web WHERE is_cancelled) AS web_cancelled`,
      )
      const normalizedRow = normalizedCounts.toArray()[0]
      done('normalizing', {
        metrics: [
          { label: 'Dòng POS đầu vào', value: rowCounts.POS },
          {
            label: 'Dòng POS chuẩn hóa',
            value: Number(normalizedRow.pos_rows),
          },
          {
            label: 'Đơn WEB hủy (không ghi nhận)',
            value: Number(normalizedRow.web_cancelled),
          },
        ],
        tableIds: [
          this.schemaMode === 'accounting' ? 'pos_staging' : 'vw_pos',
          'vw_web',
          'vw_gl',
          'vw_flash',
        ],
      })
      if (this.schemaMode === 'accounting') {
        const stages: [ProcessingPhase, readonly string[], string[]][] = [
          ['classifying', ACCOUNTING_POS_CLASSIFICATION_SQL, ['pos_ranked']],
          [
            'cleaning',
            ACCOUNTING_POS_CLEANING_SQL,
            ['q_POS_First_Export', 'q_POS_Cleaning', 'q_POS_Dup_Keys'],
          ],
          ['mapping', ACCOUNTING_POS_MAPPING_SQL, ['q_POS_Mapped']],
          [
            'converting',
            ACCOUNTING_POS_CONVERSION_SQL,
            ['q_POS_USD', 'q_POS_Dup_Rows', 'q_POS_Dup_Impact'],
          ],
        ]
        for (const [stage, statements, tableIds] of stages) {
          phase(stage)
          for (const sql of statements) {
            checkAbort(signal)
            await connection.query(sql)
          }
          const metrics: EngineProgressEvent['metrics'] = []
          for (const id of tableIds) {
            const rows = await connection.query(
              `SELECT COUNT(*) AS n FROM ${quoteIdentifier(id)}`,
            )
            metrics.push({ label: id, value: Number(rows.toArray()[0].n) })
          }
          done(stage, { tableIds, metrics })
        }
      }
      if (this.schemaMode !== 'compatible') {
        phase('validating')
        if (glReview && !glReview.complete) {
          progressContext = { source: 'GL' }
          throw new GLValidationError(glReview)
        }
        if (this.schemaMode === 'accounting') {
          posDiagnostics = await capturePosDiagnostics(connection, {
            runId,
            rules: POS_ROW_ISSUES,
            files,
            paths,
            fileIds,
            signal,
          })
          emit({
            phase: 'validating',
            status: 'running',
            source: 'POS',
            diagnostics: posDiagnostics,
          })
          if (posDiagnostics.uniqueInvalidRows)
            throw new PosValidationError(posDiagnostics)
          if (deferredPosMasterErrors.length)
            throw new Error(
              `[POS_REFERENCE] ${deferredPosMasterErrors.join('\n')}`,
            )
          for (const sql of ACCOUNTING_POS_FACT_SQL) {
            checkAbort(signal)
            await connection.query(sql)
          }
          posDiagnostics.branchCounts.fact_POS_final = Number(
            (
              await connection.query('SELECT COUNT(*) AS n FROM fact_POS_final')
            ).toArray()[0].n,
          )
          const grain = await connection.query(
            'SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM fact_POS_final GROUP BY receipt_no, line_no HAVING COUNT(*) > 1)',
          )
          if (Number(grain.toArray()[0].n))
            throw new Error(
              '[POS_FACT_GRAIN] fact_POS_final contains duplicate receipt_no + line_no groups.',
            )
          const cardinality = posDiagnostics.branchCounts
          if (
            cardinality.q_POS_Cleaning !== cardinality.q_POS_Mapped ||
            cardinality.q_POS_Mapped !== cardinality.q_POS_USD ||
            cardinality.q_POS_USD !== cardinality.fact_POS_final ||
            cardinality.q_POS_Cleaning + cardinality.q_POS_Dup_Rows !==
              rowCounts.POS
          )
            throw new Error(
              '[POS_CARDINALITY] POS keeper, USD, fact or audit row conservation failed.',
            )
          if (posDiagnostics.duplicateConflictGroups) {
            const warning = `[POS_DUPLICATE_CONFLICT] ${posDiagnostics.duplicateConflictGroups} receipt/line groups have different export contents; earliest export retained. See duplicate audit.`
            compatibilityWarnings.push(warning)
            this.onWarning(warning)
          }
          validations.push(
            ...posDiagnostics.reasons.map((reason) => ({
              id: reason.code,
              ruleId: 'row-validation',
              message: reason.label,
              invalidCount: reason.rowCount,
              status: 'passed' as const,
            })),
          )
        }
        const rules =
          this.schemaMode === 'accounting'
            ? VALIDATION_SQL.slice(3)
            : VALIDATION_SQL
        for (const rule of rules) {
          checkAbort(signal)
          progressContext = {
            source: /^(POS|WEB|GL|Flash)/.exec(rule.message)?.[1],
          }
          const result = await connection.query(rule.sql)
          const count = Number(result.toArray()[0].n)
          if (count) {
            emit({
              phase: 'validating',
              status: 'running',
              metrics: [
                { label: 'Dòng hoặc nhóm khóa không hợp lệ', value: count },
              ],
            })
            // Capture the actual failed fields before the connection is closed.
            // Diagnostics must not replace or weaken the original validator.
            try {
              validationFailure = await captureValidationFailure(connection, {
                source: progressContext.source,
                files,
                paths,
                count,
                message: rule.message,
              })
            } catch {
              validationFailure = undefined
            }
            throw new Error(
              `${rule.message} (${count} invalid rows or key groups.)`,
            )
          }
          validations.push({
            id: `row-validation:${validations.length + 1}`,
            ruleId: 'row-validation',
            message: rule.message,
            invalidCount: count,
            status: 'passed',
          })
        }
      }
      if (this.schemaMode !== 'compatible')
        done('validating', {
          diagnostics: posDiagnostics,
          metrics: [
            { label: 'Phép kiểm tra đã chạy', value: validations.length },
            { label: 'Dòng/nhóm khóa không hợp lệ', value: 0 },
          ],
        })
      else
        emit({
          phase: 'validating',
          status: 'not-applicable',
          detail:
            'Chế độ tương thích bỏ qua kiểm tra kế toán; không phải validation thành công.',
        })
      phase('recognition')
      for (const sql of DAILY_SQL) {
        checkAbort(signal)
        await connection.query(sql)
      }
      if (glReview) {
        const expected = (
          await connection.query(
            'SELECT store_key, CAST(posting_date AS VARCHAR) AS posting_date, CAST(expected_revenue AS VARCHAR) AS expected_revenue FROM expected_daily ORDER BY store_key, posting_date',
          )
        ).toArray()
        glReview = {
          ...glReview,
          expectedDaily: expected.map((item) => ({
            storeKey: String(item.store_key),
            postingDate: String(item.posting_date),
            revenueCents: exactCents(item.expected_revenue),
          })),
        }
        options.onGLSnapshot?.(glReview)
      }
      checkAbort(signal)
      done('recognition', {
        tableIds: [
          'expected_events',
          'expected_daily',
          'gl_daily',
          'daily_comparison',
        ],
      })
      phase('reconciling')
      const table = await connection.query(
        bridgeSQL(period, this.schemaMode === 'accounting'),
      )
      checkAbort(signal)
      const row = table.toArray()[0]
      if (
        this.schemaMode === 'accounting' &&
        Number(row.flash_period_rows) === 0
      ) {
        const note = `Flash has no month_end_date rows in ${period.start} through ${period.end}. Its displayed total is zero; check the reporting period and uploaded Flash sheet.`
        compatibilityWarnings.push(note)
        this.onWarning(note)
      }
      const cents = Object.fromEntries(
        BRIDGE_KEYS.map((key) => [key, exactCents(row[key])]),
      ) as Record<BridgeKey, number>
      const metrics = Object.fromEntries(
        BRIDGE_KEYS.map((key) => [key, cents[key] / 100]),
      ) as BridgeMetrics
      // Keep the residual explicit. Never invent an adjustment just to make a bridge close.
      const explained = BRIDGE_KEYS.filter(
        (key) => key !== 'GL_Finance',
      ).reduce((sum, key) => sum + BigInt(cents[key]), 0n)
      const residual = BigInt(cents.GL_Finance) - explained
      if (
        residual > BigInt(Number.MAX_SAFE_INTEGER) ||
        residual < BigInt(Number.MIN_SAFE_INTEGER)
      )
        throw new Error('The residual exceeds the exact-cent range.')
      let cumulative = 0n
      for (const key of BRIDGE_KEYS.filter((key) => key !== 'GL_Finance')) {
        cumulative += BigInt(cents[key])
        if (
          cumulative > BigInt(Number.MAX_SAFE_INTEGER) ||
          cumulative < BigInt(Number.MIN_SAFE_INTEGER)
        )
          throw new Error('The running bridge exceeds the exact-cent range.')
      }
      const differences = await connection.query(dailyDifferenceSQL(period))
      checkAbort(signal)
      const dailyRows = differences.toArray()
      const exceptionRows = (
        await connection.query(
          exceptionSQL(period, this.schemaMode === 'accounting'),
        )
      ).toArray()
      const exceptions: ReconciliationException[] = []
      for (let index = 0; index < exceptionRows.length; index++) {
        if (index % 1000 === 0) {
          checkAbort(signal)
          // Large exception sets must not monopolize the UI while Arrow rows are mapped.
          if (index > 0) await new Promise((resolve) => setTimeout(resolve, 0))
        }
        const item = exceptionRows[index]
        const storeKey = String(item.store_key)
        const date = String(item.event_date)
        const reference = String(item.reference)
        const base = {
          id: `exc:${[String(item.category), storeKey, date, reference].map(encodeURIComponent).join(':')}`,
          storeKey,
          date,
          reference,
          deltaCents: exactCents(item.delta),
        }
        if (item.category === 'Data Error') {
          const duplicateLineCount = Number(item.duplicate_count)
          exceptions.push({
            ...base,
            category: 'Data Error',
            type: 'Duplicate POS',
            duplicateLineCount,
            description: `${duplicateLineCount} discarded POS export ${duplicateLineCount === 1 ? 'line' : 'lines'} for receipt / line ${reference} at ${storeKey}. This is the duplicated net revenue before its removal from the bridge.`,
          })
        } else if (item.category === 'Missing GL') {
          exceptions.push({
            ...base,
            category: 'Missing GL',
            type: 'Missing GL',
            description: `Normalized source revenue at ${storeKey} on ${date} has no GL store-day group. Compare the daily source total with Finance and review whether a catchup is required.`,
          })
        } else {
          exceptions.push({
            ...base,
            category: 'Unexplained',
            type:
              item.exception_type === 'Manual Journal'
                ? 'Manual Journal'
                : 'Daily Variance',
            description: `Source minus GL variance at ${storeKey} on ${date}, calculated after store/date aggregation.${item.manual_refs ? ` Manual journal references: ${String(item.manual_refs)}.` : ''} A journal is identified individually only when it is the sole manual posting on a day with zero expected source revenue.`,
          })
        }
      }
      checkAbort(signal)
      // Evidence is captured from the same successful connection/configuration,
      // before temporary relations close. Legacy bypass modes publish no evidence.
      done('reconciling', {
        tableIds: ['daily_comparison', 'expected_daily', 'gl_daily'],
        metrics: [
          {
            label: 'Dòng POS xuất lặp bị loại',
            value: Number(row.duplicate_count),
          },
          {
            label: 'Nhóm cửa hàng/ngày thiếu GL',
            value: Number(row.missing_count),
          },
          { label: 'Ngoại lệ có thể truy vết', value: exceptions.length },
        ],
      })
      phase('evidence')
      const dashboard =
        this.schemaMode === 'accounting'
          ? await captureDashboardSnapshot(connection, period, signal)
          : undefined
      const evidence =
        this.schemaMode === 'accounting'
          ? await captureRunEvidence(connection, {
              runId,
              period,
              files,
              fileConfigs,
              paths,
              fileIds,
              dimTables,
              validations,
              duplicatePOSLines: Number(row.duplicate_count),
              posPostingDateFallback,
              masterConfiguration: master ?? undefined,
              masterJoins,
              posDiagnostics,
              signal,
            })
          : undefined
      checkAbort(signal)
      done('evidence', {
        status: evidence ? 'completed' : 'not-applicable',
        detail: evidence
          ? 'Đã lưu preview cùng phiên.'
          : 'Chế độ legacy không cung cấp snapshot kiểm chứng.',
        metrics: evidence
          ? [
              {
                label: 'Bảng có preview cùng phiên',
                value: evidence.tables.length,
              },
            ]
          : [],
        tableIds: evidence?.tables.map((table) => table.id) ?? [],
      })
      return {
        dashboard,
        glReview,
        evidence,
        schemaMode: this.schemaMode,
        compatibilityWarnings,
        dimTables,
        exceptions,
        ...metrics,
        cents,
        Unexplained: Number(residual) / 100,
        unexplainedCents: Number(residual),
        duplicatePOSLines: Number(row.duplicate_count),
        missingGLEntries: Number(row.missing_count),
        duplicatePOSAdjustment: exactCents(row.duplicate_adjustment) / 100,
        missingGLAdjustment: exactCents(row.missing_adjustment) / 100,
        duplicatePOSAdjustmentCents: exactCents(row.duplicate_adjustment),
        missingGLAdjustmentCents: exactCents(row.missing_adjustment),
        period: { ...period },
        rowCounts,
        posPostingDateFallback,
        dailyDifferenceCount: dailyRows.length
          ? Number(dailyRows[0].total_count)
          : 0,
        dailyDifferences: dailyRows.map((row) => ({
          storeKey: String(row.store_key),
          postingDate: String(row.posting_date),
          expectedCents: exactCents(row.expected_revenue),
          glCents: exactCents(row.gl_revenue),
          varianceCents: exactCents(row.variance),
          missingGL: Boolean(row.missing_gl),
        })),
      }
    } catch (issue) {
      if (!signal?.aborted) {
        const intrinsic = captureRunFailure(issue)
        const failure = captureRunFailure(issue, {
          runId,
          source: intrinsic.source ?? progressContext.source ?? null,
          stage:
            issue instanceof PeriodValidationError ? 'period' : activePhase,
          fileId: progressContext.fileId,
          fileName: progressContext.fileName,
          period: { ...period },
          ...validationFailure,
        })
        options.onFailure?.(failure)
        emit({
          phase: activePhase,
          status: 'error',
          error: issue instanceof Error ? issue.message : String(issue),
          diagnostics: posDiagnostics,
        })
      }
      throw issue
    } finally {
      // Close relations before dropping the virtual files they referenced.
      try {
        try {
          if (options.validationOnly && connection)
            await connection.query('DROP SCHEMA IF EXISTS dim CASCADE')
        } finally {
          await connection?.close()
        }
      } finally {
        await Promise.all(
          registered.map((path) => this.database.dropFile(path)),
        )
      }
    }
  }
}
