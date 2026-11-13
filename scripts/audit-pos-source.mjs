import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import * as XLSX from 'xlsx'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import { workbookToCSV } from '../src/lib/spreadsheet.ts'
import { sourceRecordRows } from '../src/lib/source-coordinates.ts'
import { dateSQL, timestampSQL } from '../src/lib/reconciliation-sql.ts'
import { accountingProjection } from '../src/lib/reconciliation-accounting.ts'
import {
  ACCOUNTING_POS_STAGING_SQL,
  ACCOUNTING_POS_CLASSIFICATION_SQL,
  ACCOUNTING_POS_CLEANING_SQL,
  ACCOUNTING_POS_MAPPING_SQL,
  ACCOUNTING_POS_CONVERSION_SQL,
  POS_ROW_ISSUES,
} from '../src/lib/pos-pipeline-sql.ts'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath)
  throw new Error(
    'Usage: node --experimental-strip-types scripts/audit-pos-source.mjs <POS.xlsx> <audit.json>',
  )
const bytes = await fs.readFile(inputPath)
const buffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength,
)
const workbook = XLSX.read(bytes, {
  type: 'buffer',
  cellDates: false,
  cellNF: true,
  cellText: true,
})
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const headers = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: false,
  blankrows: false,
})[0]
const required = [
  'receipt_no',
  'line_no',
  'business_date',
  'store_id',
  'line_amount',
  'discount_amount',
  'currency',
  'exported_at',
]
if (required.some((name) => !headers.includes(name)))
  throw new Error('The first worksheet is not the observed raw POS schema.')
const csv = await workbookToCSV(buffer)
const require = createRequire(import.meta.url)
const db = await createDuckDB(
  {
    mvp: {
      mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),
    },
    eh: {
      mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),
    },
  },
  new VoidLogger(),
  NODE_RUNTIME,
)
await db.instantiate()
db.open({ path: ':memory:' })
db.registerFileText('audited_pos.csv', csv)
const connection = db.connect()
const queryRows = (sql) =>
  connection
    .query(sql)
    .toArray()
    .map((row) => Object.fromEntries(Object.entries(row)))
const count = (where = 'TRUE') =>
  Number(
    queryRows(`SELECT COUNT(*) AS n FROM old_projection WHERE ${where}`)[0].n,
  )
try {
  // Reproduce the old native POS projection, before this repair: local non-USD
  // line_amount yielded no gross USD; no native USD discount existed, so its
  // native adapter used zero USD discount. This is not a recovered user mapping.
  connection.query(`CREATE TEMP TABLE old_projection AS SELECT ROW_NUMBER() OVER () AS source_record,
    NULLIF(TRIM(receipt_no), '') AS receipt_no, NULLIF(TRIM(line_no), '') AS line_no,
    NULLIF(TRIM(store_id), '') AS store_key, UPPER(NULLIF(TRIM(currency), '')) AS currency,
    ${dateSQL('business_date')} AS business_date, ${dateSQL('business_date')} AS posting_date,
    ${timestampSQL('exported_at')} AS exported_at,
    TRY_CAST(line_amount AS DECIMAL(18,2)) AS gross_local,
    TRY_CAST(discount_amount AS DECIMAL(18,2)) AS discount_local,
    TRY_CAST(line_amount AS DECIMAL(18,2)) - TRY_CAST(discount_amount AS DECIMAL(18,2)) AS net_local,
    CASE WHEN UPPER(TRIM(currency)) = 'USD' THEN TRY_CAST(line_amount AS DECIMAL(18,2)) END AS gross_usd_daily,
    0::DECIMAL(18,2) AS discount_usd_daily,
    CASE WHEN UPPER(TRIM(currency)) = 'USD' THEN TRY_CAST(line_amount AS DECIMAL(18,2)) END AS net_usd_month_end
    FROM read_csv_auto('audited_pos.csv', header=true, all_varchar=true)`)
  const predicates = {
    receiptInvalid: 'receipt_no IS NULL',
    lineInvalid: 'line_no IS NULL',
    storeKeyInvalid: 'store_key IS NULL',
    businessDateInvalid: 'business_date IS NULL',
    postingDateInvalid: 'posting_date IS NULL',
    exportTimestampInvalid: 'exported_at IS NULL',
    localAmountInvalid:
      'gross_local IS NULL OR gross_local < 0 OR discount_local IS NULL OR discount_local < 0 OR net_local IS NULL OR net_local < 0',
    usdNetNull: 'net_usd_month_end IS NULL',
    usdNetNegative: 'net_usd_month_end < 0',
    usdDiscountInvalid: 'discount_usd_daily IS NULL OR discount_usd_daily < 0',
  }
  const invalid = Object.entries(predicates)
    .filter(([name]) => name !== 'localAmountInvalid')
    .map(([, condition]) => `(${condition})`)
    .join(' OR ')
  const sampleColumns = connection
    .query('SELECT * FROM old_projection LIMIT 0')
    .schema.fields.map((field) => field.name)
  const records = queryRows(
    `SELECT ${sampleColumns.map((name) => `CAST("${name}" AS VARCHAR) AS "${name}"`).join(', ')} FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY currency ORDER BY source_record) AS currency_order FROM old_projection) WHERE currency_order = 1 ORDER BY currency`,
  )
  const physicalRows = await sourceRecordRows(
    new File([bytes], path.basename(inputPath)),
    1,
  )
  const samples = records.map((record) => {
    const sourceRecord = Number(record.source_record)
    const sourceRow = physicalRows?.[sourceRecord - 1] ?? null
    const normalized = Object.fromEntries(
      Object.entries(record).map(([name, value]) => [
        name,
        value == null ? null : String(value),
      ]),
    )
    const raw = Object.fromEntries(
      headers.map((name, index) => [
        name,
        sourceRow == null
          ? null
          : XLSX.utils.format_cell(
              sheet[XLSX.utils.encode_cell({ r: sourceRow - 1, c: index })] ?? {
                t: 's',
                v: '',
              },
            ),
      ]),
    )
    return {
      sourceFile: inputPath,
      sheet: sheetName,
      sourceRow,
      sourceRecord,
      raw,
      normalized,
    }
  })
  const groups = queryRows(
    'SELECT COUNT(*) AS key_groups, SUM(n) AS rows_in_groups, SUM(n - 1) AS discarded_exports FROM (SELECT receipt_no, line_no, COUNT(*) AS n FROM old_projection GROUP BY receipt_no, line_no HAVING COUNT(*) > 1)',
  )[0]
  const rawRows = count()
  const discarded = Number(groups.discarded_exports)
  const sourceColumns = connection
    .query(
      "SELECT * FROM read_csv_auto('audited_pos.csv', header=true, all_varchar=true) LIMIT 0",
    )
    .schema.fields.map((field) => field.name)
  const adapter = accountingProjection('POS', sourceColumns)
  connection.query(
    `CREATE TEMP TABLE raw_pos AS SELECT ${adapter.projection}, 0 AS __reconcile_file_order, ROW_NUMBER() OVER () AS __reconcile_row_order FROM read_csv_auto('audited_pos.csv', header=true, all_varchar=true) AS input`,
  )
  for (const sql of [
    ...ACCOUNTING_POS_STAGING_SQL,
    ...ACCOUNTING_POS_CLASSIFICATION_SQL,
    ...ACCOUNTING_POS_CLEANING_SQL,
    ...ACCOUNTING_POS_MAPPING_SQL,
    ...ACCOUNTING_POS_CONVERSION_SQL,
  ])
    connection.query(sql)
  const actualCount = (relation, where = 'TRUE') =>
    Number(
      queryRows(`SELECT COUNT(*) AS n FROM "${relation}" WHERE ${where}`)[0].n,
    )
  const fixedInvalid = POS_ROW_ISSUES.map((rule) => `(${rule.where})`).join(
    ' OR ',
  )
  const fixedNoFx = {
    method:
      'Actual repaired POS SQL executed against the full cached raw worksheet with no FX or Store/Calendar configuration supplied. No rates or reference mappings are manufactured. This audits POS only and does not run reconciliation or create a Fact.',
    branchCounts: Object.fromEntries(
      [
        'raw_pos',
        'pos_staging',
        'pos_ranked',
        'q_POS_First_Export',
        'q_POS_Cleaning',
        'q_POS_Mapped',
        'q_POS_USD',
        'q_POS_Dup_Keys',
        'q_POS_Dup_Rows',
        'q_POS_Dup_Impact',
      ].map((relation) => [relation, actualCount(relation)]),
    ),
    factStatus: 'not created; required USD validation has failures',
    factCreated: false,
    uniqueInvalidAuditRows: actualCount('pos_clean', fixedInvalid),
    uniqueInvalidKeeperRows: actualCount('q_POS_USD', fixedInvalid),
    validLocalMissingUsdAuditRows: actualCount(
      'pos_clean',
      'net_local IS NOT NULL AND net_local >= 0 AND net_usd_month_end IS NULL',
    ),
    validLocalMissingUsdKeeperRows: actualCount(
      'q_POS_USD',
      'net_local IS NOT NULL AND net_local >= 0 AND net_usd_month_end IS NULL',
    ),
    validUsdKeeperRows: actualCount('q_POS_USD', `NOT (${fixedInvalid})`),
    reasonCounts: Object.fromEntries(
      POS_ROW_ISSUES.map((rule) => [
        rule.code,
        actualCount('pos_clean', rule.where),
      ]),
    ),
    discardedCurrencyCounts: Object.fromEntries(
      queryRows(
        'SELECT currency, COUNT(*) AS n FROM q_POS_Dup_Rows GROUP BY currency ORDER BY currency',
      ).map((row) => [row.currency, Number(row.n)]),
    ),
    discardedRowsMissingDailyUsd: actualCount(
      'q_POS_Dup_Rows',
      'net_usd_daily IS NULL',
    ),
  }
  if (fixedNoFx.uniqueInvalidAuditRows === 0)
    throw new Error(
      'Unexpectedly valid local-currency source without any configured FX: investigate before reporting.',
    )
  const report = {
    inputPath,
    sheet: sheetName,
    headers,
    method:
      'Read-only reproduction of the old native projection from the full observed raw worksheet. The application user-confirmed mapping and run snapshot were not retained; no lookup configuration is inferred.',
    oldProjection: {
      sourceGross: 'line_amount',
      suppliedUsdNet: null,
      nativeUsdDiscount: 'absent; old native adapter uses zero',
      localDiscount: 'retained independently for diagnostic comparison',
      postingDate: 'business_date fallback',
      fxConversion: 'not performed by old projection',
    },
    rawRows,
    currencyCounts: Object.fromEntries(
      queryRows(
        'SELECT currency, COUNT(*) AS n FROM old_projection GROUP BY currency ORDER BY currency',
      ).map((row) => [row.currency, Number(row.n)]),
    ),
    reasonCounts: Object.fromEntries(
      Object.entries(predicates).map(([name, where]) => [name, count(where)]),
    ),
    uniqueInvalidRows: count(invalid),
    affectedReceiptLineGroups: Number(
      queryRows(
        `SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM old_projection WHERE ${invalid} GROUP BY receipt_no, line_no)`,
      )[0].n,
    ),
    validLocalMissingUsdRows: count(
      'net_local IS NOT NULL AND net_local >= 0 AND net_usd_month_end IS NULL',
    ),
    referenceChecks: {
      storeLookup: 'not assessed: user-confirmed configuration unavailable',
      fxKeys:
        'not assessed: selected workbook/sheet/columns unavailable in this input',
    },
    duplicateCounts: {
      keyGroups: Number(groups.key_groups),
      rowsInGroups: Number(groups.rows_in_groups),
      discardedExports: discarded,
      keeperRows: rawRows - discarded,
    },
    samples,
    fixedNoFx,
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(
    JSON.stringify({
      outputPath,
      rawRows,
      currencyCounts: report.currencyCounts,
      reasonCounts: report.reasonCounts,
      uniqueInvalidRows: report.uniqueInvalidRows,
      affectedReceiptLineGroups: report.affectedReceiptLineGroups,
      validLocalMissingUsdRows: report.validLocalMissingUsdRows,
      duplicateCounts: report.duplicateCounts,
      firstSample: samples[0],
      fixedNoFx,
    }) + '\n',
  )
} finally {
  connection.close()
  db.dropFile('audited_pos.csv')
}
