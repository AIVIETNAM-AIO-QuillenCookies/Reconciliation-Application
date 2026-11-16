import type * as XLSX from 'xlsx'
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { FilePreview, ColumnMapping } from './data-mapping.ts'
import type { MasterConfiguration } from './master-data.ts'
import type { QueuedFile, Source } from './uploads.ts'
import { rememberWorkbook } from './workbook-cache.ts'

export const GUIDE_SAMPLE_NAME = 'Nexa_Home_Recon_Dataset_Final.xlsx'
export const GUIDE_SAMPLE_PATH = `demo/${GUIDE_SAMPLE_NAME}`
export const GUIDE_SOURCE_SHEETS = {
  POS: '01a_Nguon_POS',
  WEB: '01b_Nguon_WEB',
  GL: '01c_Nguon_GL',
  Flash: '01d_Nguon_Flash',
} as const
export const GUIDE_MASTER_SHEETS = {
  store: '01e_Master_Cua_Hang',
  calendar: '01f_Master_Lich',
  fxDaily: '01g_Master_TyGia_Ngay',
  fxMonthEnd: '01h_Master_TyGia_Thang',
} as const
export const GUIDE_COLUMNS: Record<Exclude<Source, 'Dim'>, ColumnMapping> = {
  POS: {
    transaction_id: 'receipt_no',
    line_no: 'line_no',
    date: 'business_date',
    store_key: 'store_id',
    gross_amount: 'line_amount',
    discount: 'discount_amount',
    currency: 'currency',
    exported_at: 'exported_at',
  },
  WEB: {
    transaction_id: 'web_order_id',
    date: 'order_date',
    delivery_date: 'delivery_date',
    return_date: 'return_date',
    order_status: 'order_status',
    gross_amount: 'gross_amount',
    discount: 'discount_amount',
    net_amount: 'net_amount',
    currency: 'currency',
  },
  GL: {
    transaction_id: 'journal_id',
    date: 'posting_date',
    store_key: 'store_code',
    journal_type: 'journal_type',
    net_amount: 'amount_usd',
    currency: 'currency',
  },
  Flash: { date: 'Tháng', gross_amount: 'Doanh số (USD)' },
}
export type GuideCell = string | number | boolean | null
export interface GuideSourceException {
  id: string
  stage: string
  source: string
  description: string
  impactUSD: number
  periodLabel: string
  category: string
  resolution: string
  owner: string
  status: string
  sourceRow: number
  values: Record<string, GuideCell>
}
export interface GuideSample {
  file: File
  files: QueuedFile[]
  workbook: XLSX.WorkBook
  previews: Record<string, FilePreview[]>
  preset: MasterConfiguration
  sourceExceptions: GuideSourceException[]
  evidence: {
    posRows: number
    uniquePOSKeys: number
    duplicateGroups: number
    duplicateRows: number
    excessPOSRows: number
    webRows: number
    cancelledAll: number
    cancelled2025: number
    glRows: number
    manualGL: number
    flashRows: number
    flashUSD: number
    glRevenueUSD: number
    qcUnassessed: number
    formulas: {
      sheet: string
      cell: string
      formula: string
      cached: unknown
    }[]
  }
  limitations: string[]
}

/** Original values remain in workbook; these are the same canonical dates used on import. */
export async function guideTableRows(
  sample: Pick<GuideSample, 'workbook'>,
  name: string,
  limit = 20,
) {
  const [{ normalizeSpreadsheetValues }, xlsx] = await Promise.all([
    import('./spreadsheet-values.ts'),
    import('xlsx'),
  ])
  const source = sample.workbook.Sheets[name]
  if (!source?.['!ref']) throw new Error(`Không có sheet ${name} trong bộ mẫu.`)
  const sheet = normalizeSpreadsheetValues(
    source,
    1,
    !!sample.workbook.Workbook?.WBProps?.date1904,
  )
  const values = xlsx.utils.sheet_to_json<GuideCell[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })
  const headers = (values[0] ?? []).map(String)
  return { headers, rows: values.slice(1, limit + 1), total: values.length - 1 }
}

export async function loadGuideSample(
  signal?: AbortSignal,
): Promise<GuideSample> {
  const base =
    (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env
      ?.BASE_URL ?? '/'
  const response = await fetch(`${base}${GUIDE_SAMPLE_PATH}`, { signal })
  if (!response.ok)
    throw new Error(
      `Không tải được workbook mẫu (HTTP ${response.status}). Hãy thử lại.`,
    )
  const buffer = await response.arrayBuffer()
  signal?.throwIfAborted()
  return inspectGuideSample(buffer, signal)
}

/** Also used by the production-asset integration test; never fetches during app startup. */
export async function inspectGuideSample(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<GuideSample> {
  const [{ readWorkbook }, { sheetPreview }] = await Promise.all([
    import('./spreadsheet.ts'),
    import('./mapping-preview.ts'),
  ])
  signal?.throwIfAborted()
  const workbook = readWorkbook(buffer)
  for (const name of [
    ...Object.values(GUIDE_SOURCE_SHEETS),
    ...Object.values(GUIDE_MASTER_SHEETS),
    '05_Nhat_ky_ngoai_le',
  ])
    if (!workbook.Sheets[name]?.['!ref'])
      throw new Error(`Bộ mẫu thiếu sheet ${name}.`)
  const file = new File([buffer], GUIDE_SAMPLE_NAME, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: 0,
  })
  rememberWorkbook(file, workbook)
  const files: QueuedFile[] = (
    Object.entries(GUIDE_SOURCE_SHEETS) as [Exclude<Source, 'Dim'>, string][]
  ).map(([source, sheetName]) => ({
    id: `guide-${source.toLowerCase()}`,
    file,
    source,
    sample: true,
    headerRow: 1,
    sheetName,
  }))
  files.push({
    id: 'guide-dim',
    file,
    source: 'Dim',
    sample: true,
    headerRow: 1,
  })
  const preview = (name: string): FilePreview => ({
    ...sheetPreview(
      workbook.Sheets[name],
      name,
      1,
      !!workbook.Workbook?.WBProps?.date1904,
    ),
    sheetNames: workbook.SheetNames,
  })
  const previews: GuideSample['previews'] = Object.fromEntries(
    files
      .filter((f) => f.sheetName)
      .map((f) => [f.id, [preview(f.sheetName!)]]),
  )
  previews['guide-dim'] = Object.values(GUIDE_MASTER_SHEETS).map(preview)
  const preset: MasterConfiguration = {
    revision: 1,
    fileId: 'guide-dim',
    sheets: Object.fromEntries(
      Object.values(GUIDE_MASTER_SHEETS).map((name) => [
        name,
        { headerRow: 1 },
      ]),
    ),
    roles: {
      store: {
        usage: 'enabled',
        sheetName: GUIDE_MASTER_SHEETS.store,
        columns: {
          pos_store_id: 'pos_store_id',
          finance_store_code: 'finance_store_code',
          country: 'country',
          currency: 'currency',
        },
        relationships: [
          {
            id: 'guide-store-pos',
            source: 'POS',
            keys: [
              {
                sourceField: 'store_key',
                referenceField: 'pos_store_id',
                type: 'text',
              },
            ],
            outputs: ['finance_store_code'],
            purpose: 'store-map',
            unmatched: 'error',
          },
        ],
      },
      calendar: {
        usage: 'enabled',
        sheetName: GUIDE_MASTER_SHEETS.calendar,
        columns: { date: 'date', working_day: 'working_day', period: 'period' },
        relationships: [
          {
            id: 'guide-calendar-pos',
            source: 'POS',
            keys: [
              { sourceField: 'date', referenceField: 'date', type: 'date' },
            ],
            outputs: ['working_day', 'period'],
            purpose: 'enrich',
            unmatched: 'error',
          },
        ],
      },
      fxDaily: {
        usage: 'enabled',
        sheetName: GUIDE_MASTER_SHEETS.fxDaily,
        columns: {
          date: 'rate_date',
          currency: 'currency',
          rate: 'usd_to_ccy',
        },
        relationships: [
          {
            id: 'guide-fx-daily',
            source: 'POS',
            keys: [
              { sourceField: 'date', referenceField: 'date', type: 'date' },
              {
                sourceField: 'currency',
                referenceField: 'currency',
                type: 'text',
              },
            ],
            outputs: ['rate'],
            purpose: 'enrich',
            unmatched: 'error',
          },
        ],
      },
      fxMonthEnd: {
        usage: 'enabled',
        sheetName: GUIDE_MASTER_SHEETS.fxMonthEnd,
        columns: {
          period: 'period_text',
          currency: 'currency',
          rate: 'usd_to_ccy',
        },
        relationships: [
          {
            id: 'guide-fx-month',
            source: 'POS',
            keys: [
              {
                sourceField: 'recognition_period',
                referenceField: 'period',
                type: 'period',
              },
              {
                sourceField: 'currency',
                referenceField: 'currency',
                type: 'text',
              },
            ],
            outputs: ['rate'],
            purpose: 'enrich',
            unmatched: 'error',
          },
        ],
      },
    },
  }
  const sample = { file, files, workbook, previews, preset } as GuideSample
  const objects = async (name: string) => {
    const table = await guideTableRows(sample, name, Number.MAX_SAFE_INTEGER)
    return table.rows.map((row) =>
      Object.fromEntries(
        table.headers.map((header, index) => [header, row[index]]),
      ),
    )
  }
  const [pos, web, gl, flash, exceptionRows, qc] = await Promise.all([
    objects(GUIDE_SOURCE_SHEETS.POS),
    objects(GUIDE_SOURCE_SHEETS.WEB),
    objects(GUIDE_SOURCE_SHEETS.GL),
    objects(GUIDE_SOURCE_SHEETS.Flash),
    objects('05_Nhat_ky_ngoai_le'),
    objects('QC_Summary'),
  ])
  const counts = new Map<string, number>()
  pos.forEach((row) => {
    const key = `${row.receipt_no}\u0000${row.line_no}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const repeated = [...counts.values()].filter((n) => n > 1)
  sample.evidence = {
    posRows: pos.length,
    uniquePOSKeys: counts.size,
    duplicateGroups: repeated.length,
    duplicateRows: repeated.reduce((a, b) => a + b, 0),
    excessPOSRows: pos.length - counts.size,
    webRows: web.length,
    cancelledAll: web.filter((row) => row.order_status === 'Cancelled').length,
    cancelled2025: web.filter(
      (row) =>
        row.order_status === 'Cancelled' &&
        String(row.order_date).startsWith('2025'),
    ).length,
    glRows: gl.length,
    manualGL: gl.filter((row) => row.journal_type === 'MANUAL').length,
    flashRows: flash.length,
    flashUSD: flash.reduce(
      (sum, row) => sum + Number(row['Doanh số (USD)']),
      0,
    ),
    glRevenueUSD:
      gl
        .filter((row) => String(row.period).startsWith('2025'))
        .reduce(
          (sum, row) => sum - Math.round(Number(row.amount_usd) * 100),
          0,
        ) / 100,
    qcUnassessed: qc.filter(
      (row) => row['Chỉ tiêu kiểm tra'] && !row['Trạng thái'],
    ).length,
    formulas: [
      'QC_Summary',
      '04a_Cau_noi_Flash_GL',
      '04b_Truy_vet',
      '04c_So_sanh_ty_gia',
    ].flatMap((sheet) =>
      Object.entries(workbook.Sheets[sheet])
        .filter(([, cell]) => cell?.f)
        .map(([cell, value]) => ({
          sheet,
          cell,
          formula: value.f as string,
          cached: value.v,
        })),
    ),
  }
  sample.sourceExceptions = exceptionRows.map((row, index) => ({
    id: String(row['Mã']),
    stage: String(row['Phát hiện ở bước']),
    source: String(row['Nguồn']),
    description: String(row['Mô tả']),
    impactUSD: Number(row['Ảnh hưởng (USD)']),
    periodLabel: String(row['Kỳ']),
    category: String(row['Phân loại']),
    resolution: String(row['Hướng xử lý']),
    owner: String(row['Người phụ trách']),
    status: String(row['Trạng thái']),
    sourceRow: index + 2,
    values: row,
  }))
  sample.limitations = [
    'Raw WEB trong workbook là nội tệ. Pipeline hiện chỉ quy đổi FX cho POS; chưa có quy đổi WEB theo ngày đặt, ngày giao và ngày trả. Không thể coi các cột này là USD.',
    'Lịch wd_date là ngày làm việc trong master; pipeline chưa tái tạo đầy đủ quy tắc ghi sổ kế tiếp và các ca chuyển kỳ riêng của workbook.',
    'Dashboard tham chiếu Excel sử dụng kết quả tính sẵn của workbook, không chứng minh toàn bộ pipeline Raw đã đối soát thành công.',
  ]
  signal?.throwIfAborted()
  return sample
}

export function assertGuideRawSupported(sample: GuideSample): void {
  // This is an explicit preflight, before the generic USD adapter receives local
  // WEB values. Structural validation is still run through the real engine.
  if (sample.limitations.length)
    throw new Error(
      `Luồng Raw chưa hỗ trợ đầy đủ bộ Nexa Home. ${sample.limitations[0]} ${sample.limitations[1]}`,
    )
}

/** Real GL normalization/review services, in a separate connection scoped to the sample. */
export async function prepareGuideGL(
  database: Pick<AsyncDuckDB, 'registerFileText' | 'dropFile' | 'connect'>,
  sample: GuideSample,
  signal?: AbortSignal,
) {
  const [
    { sheetCSV },
    { accountingProjection },
    { ACCOUNTING_GL_SQL, prepareGLReview },
  ] = await Promise.all([
    import('./spreadsheet.ts'),
    import('./reconciliation-accounting.ts'),
    import('./gl-pipeline.ts'),
  ])
  const glFile = sample.files.find((entry) => entry.source === 'GL')!
  const columns = sample.previews[glFile.id][0].headers
  const path = `guide-gl-${crypto.randomUUID()}.csv`
  await database.registerFileText(
    path,
    sheetCSV(
      sample.workbook.Sheets[GUIDE_SOURCE_SHEETS.GL],
      1,
      !!sample.workbook.Workbook?.WBProps?.date1904,
    ),
  )
  const connection = await database.connect()
  try {
    signal?.throwIfAborted()
    const projection = accountingProjection(
      'GL',
      columns,
      GUIDE_COLUMNS.GL,
      {},
      { glAmountBasis: 'ledger' },
    )
    await connection.query(
      `CREATE TEMP TABLE raw_gl AS SELECT ${projection.projection}, 0 AS __reconcile_file_order, ROW_NUMBER() OVER () AS __reconcile_row_order FROM read_csv_auto('${path}', header=true, all_varchar=true) AS input`,
    )
    for (const sql of ACCOUNTING_GL_SQL) {
      signal?.throwIfAborted()
      await connection.query(sql)
    }
    return await prepareGLReview(connection as AsyncDuckDBConnection, {
      runId: `guide-${crypto.randomUUID()}`,
      files: [glFile],
      columnMappings: [
        {
          fileId: glFile.id,
          fileName: glFile.file.name,
          source: 'GL',
          columns: GUIDE_COLUMNS.GL,
          headerRow: 1,
          sheetName: glFile.sheetName,
          glAmountBasis: 'ledger',
        },
      ],
      configuration: {
        guide: true,
        source: GUIDE_SAMPLE_NAME,
        sheet: glFile.sheetName,
      },
      glPaths: [path],
      signal,
    })
  } finally {
    await connection.close()
    await database.dropFile(path)
  }
}
