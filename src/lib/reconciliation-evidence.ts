import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type {
  ReconciliationPeriod,
  DimTableInfo,
} from './reconciliation-types.ts'
import type { QueuedFile, Source } from './uploads.ts'
import type { PosDiagnostics } from './pos-diagnostics.ts'
import {
  ROLE_LABELS,
  PURPOSE_LABELS,
  type MasterConfiguration,
  type JoinValidation,
} from './master-data.ts'

export type ProcessingPhase =
  | 'registering'
  | 'dimensions'
  | 'projecting'
  | 'normalizing'
  | 'classifying'
  | 'cleaning'
  | 'mapping'
  | 'converting'
  | 'validating'
  | 'recognition'
  | 'reconciling'
  | 'evidence'
export type EvidenceRow = Record<string, string | null>
export interface EvidenceColumn {
  name: string
  type: string
}
export interface EvidenceTable {
  id: string
  label: string
  kind: 'input' | 'normalized' | 'logical' | 'aggregate' | 'dimension'
  source: Source | null
  grain: string
  rowCount: number
  columns: EvidenceColumn[]
  rows: EvidenceRow[]
  truncated: boolean
}
export interface EvidenceFileConfig {
  fileId: string
  fileName: string
  source: Source
  headerRow: number
  mappingMode: 'confirmed' | 'native'
  columns: Record<string, string>
  netStrategy: 'supplied' | 'gross-minus-discount' | null
  notes: string[]
}
export interface EvidenceValidation {
  id: string
  ruleId: string
  message: string
  invalidCount: number
  status: 'passed'
}
export interface EvidenceRuleApplication {
  id: string
  status: 'applied' | 'not-applicable' | 'not-evaluated'
  detail: string
  affectedRows?: number
}
export interface RunEvidence {
  posDiagnostics?: PosDiagnostics
  masterConfiguration?: MasterConfiguration
  masterJoins?: JoinValidation[]
  runId: string
  period: ReconciliationPeriod
  previewLimit: number
  scope: string
  sourceRowNote: string
  files: EvidenceFileConfig[]
  tables: EvidenceTable[]
  validations: EvidenceValidation[]
  ruleApplications: EvidenceRuleApplication[]
}
export const EVIDENCE_PREVIEW_LIMIT = 50
const quote = (text: string) => `"${text.replaceAll('"', '""')}"`
const literal = (text: string) => `'${text.replaceAll("'", "''")}'`
const metadata = new Set(['__reconcile_file_order', '__reconcile_row_order'])

/** Read bounded output from the run's existing relations; never recalculate revenue in JavaScript. */
export async function captureRunEvidence(
  connection: AsyncDuckDBConnection,
  options: {
    runId: string
    period: ReconciliationPeriod
    files: QueuedFile[]
    fileConfigs: EvidenceFileConfig[]
    paths: Map<Source, string[]>
    fileIds: Map<string, string>
    dimTables: DimTableInfo[]
    validations: EvidenceValidation[]
    duplicatePOSLines: number
    posPostingDateFallback: boolean
    signal?: AbortSignal
    masterConfiguration?: MasterConfiguration
    masterJoins?: JoinValidation[]
    posDiagnostics?: PosDiagnostics
  },
): Promise<RunEvidence> {
  const { signal } = options
  const tables: EvidenceTable[] = []
  const sourceFiles = (source: Source) =>
    options.files.filter((file) => file.source === source)
  async function readTable(
    query: string,
    info: Omit<EvidenceTable, 'columns' | 'rowCount' | 'rows' | 'truncated'>,
    order = '',
  ) {
    signal?.throwIfAborted()
    const schema = await connection.query(
      `SELECT * FROM (${query}) AS sample LIMIT 0`,
    )
    const fields = schema.schema.fields
    const count = await connection.query(
      `SELECT CAST(COUNT(*) AS VARCHAR) AS n FROM (${query}) AS sample`,
    )
    const rowCount = Number(count.toArray()[0].n)
    const projection = fields
      .map(
        (field) =>
          `CAST(${quote(field.name)} AS VARCHAR) AS ${quote(field.name)}`,
      )
      .join(', ')
    const result = await connection.query(
      `SELECT ${projection} FROM (${query}) AS sample ${order} LIMIT ${EVIDENCE_PREVIEW_LIMIT}`,
    )
    const rows: EvidenceRow[] = result
      .toArray()
      .map((row) =>
        Object.fromEntries(
          fields.map((field) => [
            field.name,
            row[field.name] == null ? null : String(row[field.name]),
          ]),
        ),
      )
    signal?.throwIfAborted()
    const table: EvidenceTable = {
      ...info,
      rowCount,
      columns: fields.map((field) => ({
        name: field.name,
        type: field.type.toString(),
      })),
      rows,
      truncated: rowCount > rows.length,
    }
    tables.push(table)
    return table
  }

  const inputColumns = new Map<string, string[]>()
  for (const source of ['POS', 'WEB', 'GL', 'Flash'] as const) {
    for (const path of options.paths.get(source) ?? []) {
      const fileId = options.fileIds.get(path)!
      const selected = options.files.find((file) => file.id === fileId)!
      const input = await readTable(
        `SELECT * FROM read_csv_auto(${literal(path)}, header=true, all_varchar=true)`,
        {
          id: `uploaded:${fileId}`,
          label: selected.file.name,
          kind: 'input',
          source,
          grain: 'One imported source record, before accounting projection',
        },
      )
      inputColumns.set(
        path,
        input.columns.map((column) => column.name),
      )
    }
  }

  const relations: [
    string,
    string,
    EvidenceTable['kind'],
    Source | null,
    string,
  ][] = [
    ...(['POS', 'WEB', 'GL', 'Flash'] as const).map(
      (source) =>
        [
          `raw_${source.toLowerCase()}`,
          `${source} configured projections & lookup outputs`,
          'normalized',
          source,
          'One source record after validated left lookups',
        ] as [string, string, EvidenceTable['kind'], Source, string],
    ),
    [
      'pos_clean',
      'POS converted audit lines (all exports)',
      'normalized',
      'POS',
      'One uploaded receipt line, including repeated exports',
    ],
    [
      'pos_staging',
      'POS staging',
      'normalized',
      'POS',
      'One raw export with typed local fields',
    ],
    [
      'q_POS_First_Export',
      'POS first export keepers',
      'normalized',
      'POS',
      'One receipt_no + line_no, earliest exported_at',
    ],
    [
      'q_POS_Cleaning',
      'POS Cleaning',
      'normalized',
      'POS',
      'One cleaned keeper per receipt_no + line_no',
    ],
    [
      'q_POS_Mapped',
      'POS reference mapping',
      'normalized',
      'POS',
      'One cleaned keeper with configured store, posting and FX attributes',
    ],
    [
      'q_POS_USD',
      'POS USD',
      'normalized',
      'POS',
      'One cleaned keeper after reference mapping and USD conversion',
    ],
    [
      'fact_POS_final',
      'POS final fact',
      'normalized',
      'POS',
      'One receipt_no + line_no, discarded exports excluded',
    ],
    [
      'q_POS_Dup_Keys',
      'POS duplicate key groups',
      'aggregate',
      'POS',
      'One receipt_no + line_no with multiple exports',
    ],
    [
      'q_POS_Dup_Rows',
      'POS discarded exports',
      'normalized',
      'POS',
      'One discarded export with keeper rank and reason',
    ],
    [
      'q_POS_Dup_Impact',
      'POS duplicate impact',
      'aggregate',
      'POS',
      'Audit impact of discarded exports, excluded from fact',
    ],
    [
      'pos_ranked',
      'POS export ranking',
      'normalized',
      'POS',
      'One uploaded receipt line with computed keeper rank',
    ],
    [
      'vw_pos',
      'POS keeper lines',
      'normalized',
      'POS',
      'One receipt_no + line_no after deduplication',
    ],
    [
      'vw_web',
      'WEB orders',
      'normalized',
      'WEB',
      'One unique web_order_id, including cancelled orders',
    ],
    [
      'gl_normalized',
      'GL chuẩn hóa — trước chỉnh sửa phiên',
      'normalized',
      'GL',
      'Một journal từ Raw, chuẩn hóa theo cấu hình nguồn; không có override',
    ],
    [
      'gl_clean',
      'GL hiệu lực — chỉnh sửa trong phiên',
      'normalized',
      'GL',
      'Một journal; cùng snapshot với bridge và dashboard, không sửa ERP',
    ],
    [
      'vw_gl_manual',
      'GL bút toán tay',
      'logical',
      'GL',
      'View MANUAL từ GL hiệu lực; không cộng thêm lần nữa vào GL',
    ],
    [
      'vw_gl_system',
      'GL bút toán hệ thống',
      'logical',
      'GL',
      'View bút toán hệ thống từ GL hiệu lực',
    ],
    [
      'vw_gl',
      'Finance revenue journals',
      'normalized',
      'GL',
      'One journal_id; revenue sign reversed once',
    ],
    [
      'vw_flash',
      'Monthly Sales Flash',
      'normalized',
      'Flash',
      'One uploaded month-end summary row; no assumed channel or market fields',
    ],
    [
      'expected_events',
      'Recognition events',
      'logical',
      null,
      'One POS sale, WEB delivery or WEB return recognition event',
    ],
    [
      'expected_daily',
      'Expected source revenue',
      'aggregate',
      null,
      'One store_key × posting_date',
    ],
    [
      'gl_daily',
      'Actual ledger revenue',
      'aggregate',
      'GL',
      'One store_key × posting_date',
    ],
    [
      'daily_comparison',
      'Daily source / GL comparison',
      'aggregate',
      null,
      'One store_key × posting_date from a full outer join',
    ],
  ]
  for (const [id, label, kind, source, grain] of relations) {
    const order =
      id === 'expected_events'
        ? 'ORDER BY source, __reconcile_file_order, __reconcile_row_order, event_type'
        : ''
    const table = await readTable(
      `SELECT * FROM ${quote(id)}`,
      { id, label, kind, source, grain },
      order,
    )
    if (table.columns.some((column) => metadata.has(column.name))) {
      table.columns = table.columns.filter(
        (column) => !metadata.has(column.name),
      )
      table.columns.push(
        { name: 'source_file', type: 'VARCHAR' },
        { name: 'source_file_id', type: 'VARCHAR' },
        { name: 'source_record', type: 'BIGINT' },
        { name: 'source_row', type: 'VARCHAR' },
        { name: 'applied_rule_ids', type: 'VARCHAR' },
      )
      for (const row of table.rows) {
        const rowSource = (row.source ?? source) as Source
        const file = sourceFiles(rowSource)[Number(row.__reconcile_file_order)]
        row.source_file = file?.file.name ?? null
        row.source_file_id = file?.id ?? null
        row.source_record = row.__reconcile_row_order
        row.source_row = null
        const ids = ['header-selection', 'date-normalization', 'row-validation']
        if (rowSource === 'POS' || rowSource === 'WEB')
          ids.push('net-precedence')
        if (rowSource === 'POS' && id !== 'pos_clean') ids.push('pos-dedup')
        if (
          rowSource === 'POS' &&
          ['daily', 'month-end'].includes(row.net_usd_basis ?? '')
        )
          ids.push('report-fx')
        if (rowSource === 'WEB' && id === 'expected_events')
          ids.push('web-recognition')
        if (rowSource === 'GL') ids.push('gl-sign')
        row.applied_rule_ids = ids.join(', ')
        delete row.__reconcile_file_order
        delete row.__reconcile_row_order
      }
    }
  }

  // Resolve the actual imported cells for bounded event records. This is lineage
  // inspection of the same registered file, not a second recognition calculator.
  const events = tables.find((table) => table.id === 'expected_events')!
  events.columns.push(
    { name: 'input_values', type: 'JSON' },
    { name: 'fx_basis', type: 'VARCHAR' },
  )
  for (const event of events.rows) {
    event.input_values = null
    event.fx_basis = null
  }
  for (const source of ['POS', 'WEB'] as const) {
    for (const path of options.paths.get(source) ?? []) {
      const fileId = options.fileIds.get(path)!
      const related = events.rows.filter((row) => row.source_file_id === fileId)
      const records = [
        ...new Set(
          related
            .map((row) => Number(row.source_record))
            .filter((record) => Number.isSafeInteger(record) && record > 0),
        ),
      ]
      if (!records.length) continue
      const columns = inputColumns.get(path)!
      let recordColumn = '__evidence_record_ordinal'
      while (columns.includes(recordColumn)) recordColumn += '_'
      signal?.throwIfAborted()
      const raw = await connection.query(
        `SELECT * FROM (SELECT ROW_NUMBER() OVER () AS ${quote(recordColumn)}, input.* FROM read_csv_auto(${literal(path)}, header=true, all_varchar=true) AS input) WHERE ${quote(recordColumn)} IN (${records.join(',')}) LIMIT ${EVIDENCE_PREVIEW_LIMIT}`,
      )
      const inputs = new Map(
        raw
          .toArray()
          .map((row) => [
            String(row[recordColumn]),
            JSON.stringify(
              Object.fromEntries(
                columns.map((column) => [
                  column,
                  row[column] == null ? null : String(row[column]),
                ]),
              ),
            ),
          ]),
      )
      for (const event of related)
        event.input_values = inputs.get(event.source_record!) ?? null
      if (source === 'POS') {
        const fileOrder = options.paths.get('POS')!.indexOf(path)
        const basis =
          await connection.query(`SELECT CAST(__reconcile_row_order AS VARCHAR) AS source_record, net_usd_basis
          FROM fact_POS_final WHERE __reconcile_file_order = ${fileOrder}
          AND __reconcile_row_order IN (${records.join(',')})`)
        const bases = new Map(
          basis
            .toArray()
            .map((row) => [
              String(row.source_record),
              String(row.net_usd_basis),
            ]),
        )
        for (const event of related) {
          event.fx_basis = bases.get(event.source_record!) ?? null
          if (['daily', 'month-end'].includes(event.fx_basis ?? ''))
            event.applied_rule_ids += ', report-fx'
        }
      }
    }
  }
  for (const dim of options.dimTables)
    await readTable(`SELECT * FROM dim.${quote(dim.name)}`, {
      id: `dim:${dim.name}`,
      label: dim.name,
      kind: 'dimension',
      source: 'Dim',
      grain: 'One uploaded dimension record; keys depend on worksheet schema',
    })

  const configuredStore =
    options.masterConfiguration?.roles.store.relationships.some(
      (r) => r.purpose === 'store-map',
    ) && options.masterJoins?.some((j) => j.role === 'store')
  const configuredCalendarPosting =
    options.masterConfiguration?.roles.calendar.relationships.some(
      (r) => r.purpose === 'calendar-posting',
    ) && options.masterJoins?.some((j) => j.role === 'calendar')
  const convertedPOSRows = Number(
    (
      await connection.query(`SELECT COUNT(*) AS n FROM q_POS_USD
    WHERE currency <> 'USD' AND (uses_local_gross OR uses_local_discount)
      AND (fx_daily_status = 'matched' OR fx_month_end_status = 'matched')`)
    ).toArray()[0].n,
  )
  const ruleApplications: EvidenceRuleApplication[] = [
    {
      id: 'header-selection',
      status: 'applied',
      detail:
        'The selected header row was used by the same parser and file registration as this run.',
    },
    {
      id: 'date-normalization',
      status: 'applied',
      detail:
        'Production date projections and row validation completed for all selected fact sources.',
    },
    {
      id: 'pos-dedup',
      status: 'applied',
      detail:
        'Computed earliest-export ranking selects rank 1; discarded lines remain in pos_ranked.',
      affectedRows: options.duplicatePOSLines,
    },
    {
      id: 'net-precedence',
      status: 'applied',
      detail:
        'Each POS/WEB file used its recorded supplied-net or gross-minus-discount configuration. Invalid selected cells are never replaced.',
    },
    {
      id: 'report-fx',
      status: convertedPOSRows ? 'applied' : 'not-applicable',
      affectedRows: convertedPOSRows,
      detail: convertedPOSRows
        ? 'Confirmed POS usd_to_ccy rates converted local amounts into separate daily and recognition USD columns. Mapped USD net stayed authoritative.'
        : 'No keeper required foreign-currency conversion with a confirmed rate. Supplied USD values remained authoritative.',
    },
    {
      id: 'web-recognition',
      status: 'applied',
      detail:
        'The actual expected_events view includes non-cancelled deliveries and negative full-net returns.',
    },
    {
      id: 'gl-sign',
      status: 'applied',
      detail: 'vw_gl computes revenue_usd = -amount_usd exactly once.',
    },
    {
      id: 'store-lookup',
      status: configuredStore ? 'applied' : 'not-applicable',
      detail: configuredStore
        ? 'Confirmed Store Master relationships were executed per source file using the recorded keys, returned fields and unmatched policy.'
        : 'No Store Master relationship used. Source keys are normalized; unmapped WEB store uses 999999.',
    },
    {
      id: 'calendar-posting',
      status:
        configuredCalendarPosting || options.posPostingDateFallback
          ? 'applied'
          : 'not-applicable',
      detail: configuredCalendarPosting
        ? 'The confirmed Calendar posting relationship supplied POS recognition dates. No working-day offset is inferred.'
        : options.posPostingDateFallback
          ? 'At least one POS file omitted posting date; business date was used. No calendar worksheet or working-day offset is inferred.'
          : 'POS files supplied a posting-date mapping; no business-date fallback was configured.',
    },
    {
      id: 'aggregate-grain',
      status: 'applied',
      detail:
        'Both sides were summed at store_key × posting_date before full outer comparison.',
    },
    {
      id: 'variance-signs',
      status: 'applied',
      detail:
        'Daily SQL uses GL − source; exceptions use source − GL. Dashboard headline uses GL − Flash.',
    },
    {
      id: 'exception-threshold',
      status: 'not-evaluated',
      detail:
        'The engine publishes all traceable nonzero cases. The Exception Log applies its own strict default |delta| > $200 display filter; no 1% test is applied.',
    },
    {
      id: 'bridge-residual',
      status: 'applied',
      detail:
        'Unexplained is computed as GL less Flash and classified adjustments, without forcing the residual to zero.',
    },
    {
      id: 'row-validation',
      status: 'applied',
      detail: `${options.validations.length} executed row/key validation queries returned zero invalid rows or groups.`,
    },
  ]
  for (const join of options.masterJoins ?? []) {
    const ref = options.masterConfiguration!.roles[join.role]
    const rel = ref.relationships.find((r) => r.id === join.relationshipId)!
    ruleApplications.push({
      id: `master:${join.relationshipId}:${join.fileId}`,
      status: 'applied',
      affectedRows: join.rowsBefore,
      detail: `${ROLE_LABELS[join.role]} / ${ref.sheetName}, header ${options.masterConfiguration!.sheets[ref.sheetName].headerRow}: ${rel.source} ${rel.keys.map((k) => `${k.sourceField} → ${ref.columns[k.referenceField]}`).join(' AND ')}; return ${rel.outputs.map((f) => ref.columns[f]).join(', ')}. ${PURPOSE_LABELS[rel.purpose]}. ${join.unmatchedRows} unmatched; ${join.rowsBefore} → ${join.rowsAfter} rows. FX lookup never reconverts supplied USD or GL amount_usd.`,
    })
  }
  signal?.throwIfAborted()
  return {
    posDiagnostics: options.posDiagnostics,
    runId: options.runId,
    masterConfiguration: options.masterConfiguration,
    masterJoins: options.masterJoins,
    period: { ...options.period },
    previewLimit: EVIDENCE_PREVIEW_LIMIT,
    scope:
      'Previews contain at most 50 rows per relation from all selected files, including adjacent periods used for recognition timing. Search and filters operate only on these preview rows.',
    sourceRowNote:
      'source_record is the one-based imported data-record ordinal, excluding the selected header. source_row is unavailable: conversion removes blank worksheet rows and quoted CSV records may span physical lines. Input values are the actual registered text after spreadsheet date/formatted-cell conversion, not original binary cells.',
    files: options.fileConfigs,
    tables,
    validations: options.validations,
    ruleApplications,
  }
}
