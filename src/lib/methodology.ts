import type { Source } from './uploads.ts'

/** Documentation describes the production accounting path; it never calculates revenue. */
export type ModelStage =
  | 'source'
  | 'cleaning'
  | 'recognition'
  | 'reconciliation'
  | 'output'
  | 'reference'
export type Implementation = 'implemented' | 'reference' | 'unsupported'
export interface ModelField {
  name: string
  type: string
  description: string
}
export interface ModelNode {
  id: string
  title: string
  relation: string
  role: string
  grain: string
  keys: string[]
  fields: ModelField[]
  source?: Source
  stage: ModelStage
  logic: string[]
  implementation: Implementation
  caution?: string
}
export interface ModelConnection {
  id: string
  from: string
  to: string
  label: string
  operation: string
  keys: string[]
  cardinality: string
  condition: string
  explanation: string
}
export interface MethodologyRule {
  id: string
  title: string
  group: string
  purpose: string
  sourceIds: Source[]
  inputFields: string[]
  condition: string
  logic: string
  output: string
  nullError: string
  implementation: Implementation
  evidenceTables: string[]
  technical: string
  technicalSource: string
}
export interface ReportReference {
  id: string
  title: string
  team: string
  pages: string
  scope: string
  provenance: string
  verified: false
}

const field = (
  name: string,
  type: string,
  description: string,
): ModelField => ({ name, type, description })
const usd = (name: string, description: string) =>
  field(name, 'DECIMAL(18,2) · USD', description)
const date = (name: string, description: string) =>
  field(name, 'DATE', description)
const key = (name: string, description: string) =>
  field(name, 'VARCHAR', description)
const posFields = [
  key('receipt_no', 'Receipt identity.'),
  key('line_no', 'Line identity within a receipt.'),
  key('store_key', 'Normalized ledger store key.'),
  date('business_date', 'Date of the in-store sale.'),
  date('posting_date', 'Finance recognition date.'),
  usd(
    'net_usd_month_end',
    'Authoritative supplied net, or selected gross minus selected discount.',
  ),
  usd(
    'discount_usd_daily',
    'USD discount retained for the gross-to-net bridge.',
  ),
]
const webFields = [
  key('web_order_id', 'Unique order identity across selected files.'),
  key(
    'store_key',
    'Mapped ledger store, or documented online store 999999 when unmapped.',
  ),
  date('order_date', 'Customer order date.'),
  date('delivery_date', 'Positive recognition date for non-cancelled orders.'),
  date('return_date', 'Full net reversal date for returned orders.'),
  key('order_status', 'delivered, cancelled or returned.'),
  usd('gross_usd_daily', 'Gross USD amount.'),
  usd('net_usd_month_end', 'Supplied net or gross USD minus USD discount.'),
  usd('discount_usd_daily', 'USD discount, including cancelled orders.'),
]

export const modelNodes: ModelNode[] = [
  {
    id: 'raw_pos',
    title: 'POS source projection',
    relation: 'raw_pos',
    role: 'Combines selected POS files after applying each file’s confirmed column mapping.',
    grain: 'One uploaded receipt-line export; duplicates still present.',
    keys: [
      'receipt_no',
      'line_no',
      '__reconcile_file_order',
      '__reconcile_row_order',
    ],
    fields: posFields.map((item) => ({ ...item, type: 'VARCHAR projection' })),
    source: 'POS',
    stage: 'source',
    implementation: 'implemented',
    logic: [
      'The selected header row is applied before registration.',
      'Mapped headers are SQL-quoted; columns are projected into canonical names.',
      'File and row order provide stable duplicate-order tie breakers.',
    ],
    caution:
      'raw_pos is already a mapped projection. It is not an untouched copy of the spreadsheet.',
  },
  {
    id: 'pos_ranked',
    title: 'Ranked POS exports',
    relation: 'pos_staging → pos_ranked → q_POS_First_Export / q_POS_Dup_Rows',
    role: 'Chuẩn hóa dữ liệu nguồn và phân loại keeper theo receipt_no + line_no trước khi quy đổi USD.',
    grain: 'One POS export row, with computed export_seq and keep_rank.',
    keys: ['receipt_no', 'line_no'],
    fields: [
      ...posFields,
      field(
        'exported_at',
        'TIMESTAMP',
        'Parsed source export timestamp when mapped.',
      ),
      field(
        'source_export_seq',
        'BIGINT',
        'Original source sequence, used after timestamp ordering.',
      ),
      field(
        'export_seq',
        'BIGINT',
        'Computed rank, not the uploaded sequence.',
      ),
      field(
        'keep_rank',
        'BIGINT',
        'Computed duplicate order retained for bridge traceability.',
      ),
    ],
    source: 'POS',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Order by exported_at ascending, source_export_seq, then stable file and row order.',
      'Both computed ranks partition by receipt_no + line_no.',
      'Nhánh q_POS_Dup_Keys đếm nhóm khóa trùng; q_POS_Dup_Rows chỉ chứa các bản xuất bị loại và giữ lý do loại.',
      'q_POS_Dup_Impact cung cấp ảnh hưởng cho bridge và ngoại lệ; dòng xuất lặp không quay lại fact.',
    ],
  },
  {
    id: 'vw_pos',
    title: 'POS keeper lines',
    relation:
      'q_POS_First_Export → q_POS_Cleaning → q_POS_Mapped → q_POS_USD → fact_POS_final → vw_pos',
    role: 'Fact chỉ lấy keeper đã làm sạch, ánh xạ và quy đổi USD; duy nhất theo receipt_no + line_no.',
    grain: 'One retained receipt line.',
    keys: ['receipt_no', 'line_no'],
    fields: posFields,
    source: 'POS',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Keep computed export_seq = 1.',
      'Posting date is mapped when available; otherwise explicit calendar posting mapping, then business date.',
      'Tiền nguyên tệ dùng net_local = line_amount − discount_amount rồi chia usd_to_ccy theo cơ sở FX đã xác nhận.',
      'Net USD được map là giá trị chuẩn, gồm cả 0; không trừ discount hoặc quy đổi thêm lần nữa.',
      'Phép nối tham chiếu phải giữ nguyên số dòng; kiểm tra grain fact trước khi tạo sự kiện ghi nhận.',
    ],
    caution:
      'A repeated receipt or line number in another store is not an additional partition key in the current deduplication rule.',
  },
  {
    id: 'q_POS_Dup_Impact',
    title: 'POS audit & bridge basis',
    relation: 'pos_clean → q_POS_Dup_Rows → q_POS_Dup_Impact',
    role: 'Giữ dữ liệu quy đổi của mọi bản xuất cho audit, tách riêng dòng xuất lặp và tác động; không đưa lại vào fact.',
    grain:
      'pos_clean: mỗi bản xuất; q_POS_Dup_Rows: mỗi bản xuất bị loại; q_POS_Dup_Impact: nhóm receipt + line + store + business_date.',
    keys: ['receipt_no', 'line_no', 'keep_rank', 'store_key', 'business_date'],
    fields: [
      key('receipt_no', 'Receipt identity.'),
      key('line_no', 'Line identity within a receipt.'),
      field(
        'keep_rank',
        'BIGINT',
        'Hạng xuất được tính; lớn hơn 1 là bản xuất bị loại.',
      ),
      usd(
        'net_usd_daily',
        'Net USD theo tỷ giá ngày để tính ảnh hưởng xuất lặp.',
      ),
      usd(
        'discount_usd_daily',
        'Chiết khấu USD của mọi bản xuất, phục vụ bridge từ Flash gộp.',
      ),
      key('discard_reason', 'Lý do loại khỏi nhánh doanh thu.'),
    ],
    source: 'POS',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Cùng bước phân loại tạo keeper và discarded exports. Nhánh audit vẫn giữ giá trị gốc, nguồn và nội dung khác nhau.',
      'pos_clean là cơ sở audit đã quy đổi của mọi bản xuất; không phải nguồn fact.',
      'Bridge lấy discount của mọi bản xuất từ pos_clean và net USD ngày của discarded exports từ q_POS_Dup_Rows; q_POS_Dup_Impact giữ tổng ảnh hưởng cùng cơ sở.',
      'Không trừ discount xuất lặp hai lần; không append audit vào q_POS_USD hay fact_POS_final.',
    ],
  },
  {
    id: 'raw_web',
    title: 'WEB source projection',
    relation: 'raw_web',
    role: 'Maps online exports into one canonical order relation.',
    grain: 'One uploaded order row before validation.',
    keys: ['web_order_id'],
    fields: webFields.map((item) => ({ ...item, type: 'VARCHAR projection' })),
    source: 'WEB',
    stage: 'source',
    implementation: 'implemented',
    logic: [
      'Per-file mappings choose the columns used.',
      'Canceled is normalized to cancelled.',
      'An explicitly unmapped store uses online ledger store 999999.',
    ],
  },
  {
    id: 'vw_web',
    title: 'Validated WEB orders',
    relation: 'web_clean → vw_web',
    role: 'Validates order identity, dates and status, with explicit cancellation and return flags.',
    grain: 'One unique online order.',
    keys: ['web_order_id'],
    fields: [
      ...webFields,
      field(
        'is_cancelled',
        'BOOLEAN',
        'Controls omission from recognition events.',
      ),
      field(
        'is_returned',
        'BOOLEAN',
        'Controls the additional negative return event.',
      ),
    ],
    source: 'WEB',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Non-cancelled orders require a delivery date on or after order date.',
      'Returned orders require a return date on or after delivery.',
      'Cancelled orders cannot have delivery or return dates; non-returned orders cannot have return dates.',
    ],
    caution:
      'Partial returns are not modeled. A returned order reverses its full net.',
  },
  {
    id: 'raw_gl',
    title: 'Finance source projection',
    relation: 'raw_gl',
    role: 'Maps signed revenue journals without joining them to receipts or orders.',
    grain: 'One uploaded journal row before validation.',
    keys: ['journal_id'],
    fields: [
      key('journal_id', 'Unique journal identifier.'),
      key('store_key', 'Normalized ledger store key.'),
      date('posting_date', 'Finance posting date.'),
      key('journal_type', 'Supplied journal classification.'),
      usd('amount_usd', 'Original signed ledger amount.'),
    ].map((item) => ({ ...item, type: 'VARCHAR projection' })),
    source: 'GL',
    stage: 'source',
    implementation: 'implemented',
    logic: [
      'The GL Net Amount mapping is required.',
      'Store aliases can resolve through the same validated store lookup.',
      'All included journal types contribute to the finance total.',
    ],
  },
  {
    id: 'vw_gl',
    title: 'Finance revenue journals',
    relation: 'gl_clean → vw_gl',
    role: 'Produces the authoritative financial revenue after one accounting sign reversal.',
    grain: 'One unique journal.',
    keys: ['journal_id'],
    fields: [
      key('journal_id', 'Unique across all selected GL files.'),
      key('store_key', 'Ledger store key.'),
      date('posting_date', 'Financial recognition date.'),
      key('journal_type', 'Trimmed, uppercase journal type.'),
      usd('amount_usd', 'Signed uploaded ledger amount.'),
      usd('revenue_usd', 'Revenue = −amount_usd, reversed exactly once.'),
    ],
    source: 'GL',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Validate nonblank keys, posting date, journal type and signed amount.',
      'Reject duplicate journal IDs across files.',
      'Keep GL separate until both sides are aggregated.',
    ],
    caution: 'A MANUAL label alone does not create a bridge adjustment.',
  },
  {
    id: 'vw_flash',
    title: 'Sales Flash baseline',
    relation: 'raw_flash → flash_clean → vw_flash',
    role: 'Provides the monthly gross starting total of the revenue bridge.',
    grain:
      'One uploaded monthly summary row. Channel and market are not modeled by current SQL.',
    keys: ['month_end_date (reporting period filter)'],
    fields: [
      date('month_end_date', 'Must be a real calendar month end.'),
      usd('revenue_usd', 'Non-negative supplied monthly gross USD.'),
    ],
    source: 'Flash',
    stage: 'source',
    implementation: 'implemented',
    logic: [
      'Sum only month-end rows within the selected complete-month reporting period.',
      'The selected header row controls metadata exclusion; Row 5 is not hardcoded.',
      'Do not join monthly Flash rows to daily orders or calendar rows.',
    ],
    caution:
      'The report describes Month × channel × market. Current engine projects month_end_date + revenue_usd and sums supplied rows; it does not validate channel/market uniqueness.',
  },
  {
    id: 'dim_store',
    title: 'Store Master',
    relation: 'confirmed worksheet → configured left lookup',
    role: 'Uses the selected sheet, column mappings, source fields and join pairs to resolve ledger store codes or return attributes.',
    grain: 'One unique selected reference key or composite key.',
    keys: ['User-selected source/reference pairs, combined with AND'],
    fields: [
      key(
        'store_key',
        'Finance store code is required when store resolution is selected.',
      ),
      key(
        'store_key / store_code / store_id / branch_code / location_code',
        'Actual column names are selected explicitly and may be arbitrary.',
      ),
    ],
    source: 'Dim',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Trim and uppercase aliases; numeric Excel keys ending in .0 normalize without stripping text leading zeros.',
      'Check full reference key uniqueness without deleting duplicate rows.',
      'Preserve all source rows through a left lookup; unmatched policy is explicit.',
    ],
    caution:
      'Many POS store IDs may share one Finance store code. Uniqueness is checked on the selected reference join keys, not on returned Finance codes.',
  },
  {
    id: 'dim_date',
    title: 'Calendar',
    relation: 'confirmed worksheet → configured date/attribute lookup',
    role: 'Resolves calendar keys and supplies an explicit optional POS posting-date mapping.',
    grain: 'One unambiguous calendar key maps to one date/posting-date pair.',
    keys: ['date_key → calendar_date, posting_date'],
    fields: [
      key('date_key / date_id', 'Optional source calendar key.'),
      date(
        'calendar_date / full_date / date / business_date',
        'Recognized date column, or parsed calendar key.',
      ),
      date(
        'posting_date / finance_posting_date',
        'Optional explicit posting mapping.',
      ),
    ],
    source: 'Dim',
    stage: 'cleaning',
    implementation: 'implemented',
    logic: [
      'Use only the explicitly assigned Calendar worksheet and its selected header.',
      'Resolve the selected date field or POS posting date only when that purpose is configured.',
      'Check the configured single/composite reference key before lookup.',
    ],
    caution:
      'working_day is a reference flag. The current engine does not calculate a working-day posting offset.',
  },
  {
    id: 'fx_daily',
    title: 'FX Daily',
    relation: 'dim.<uploaded worksheet>',
    role: 'Tra tỷ giá theo ngày AND currency đã cấu hình để quy đổi gross, discount và net nguyên tệ POS sang cơ sở USD hằng ngày.',
    grain: 'Report reference: day × currency.',
    keys: ['date + currency (reference composite key)'],
    fields: [
      date(
        'date',
        'Reference FX date; actual uploaded column names are preserved.',
      ),
      key('currency', 'Reference local currency.'),
      field(
        'usd_to_ccy',
        'Reference rate',
        'Report: local-currency units per USD.',
      ),
    ],
    source: 'Dim',
    stage: 'reference',
    implementation: 'implemented',
    logic: [
      'Only the confirmed sheet is loaded; date and currency form a composite key.',
      'Full validation checks key types, uniqueness, rate values, unmatched keys and row preservation.',
    ],
    caution:
      'Chỉ dùng workbook, sheet, cột và khóa đã xác nhận. Thiếu, trùng hoặc sai tỷ giá phải báo riêng; không mặc định ngoại tệ là USD.',
  },
  {
    id: 'fx_month_end',
    title: 'FX Month End',
    relation: 'dim.<uploaded worksheet>',
    role: 'Tra tỷ giá theo kỳ ghi nhận AND currency đã cấu hình để tạo net USD cuối kỳ; giữ nguyên supplied USD net.',
    grain: 'Report reference: month × currency.',
    keys: ['month + currency (reference composite key)'],
    fields: [
      date('month_end_date', 'Reference month-end period.'),
      key('currency', 'Reference local currency.'),
      field(
        'usd_to_ccy',
        'Reference rate',
        'Report formula: USD = local amount / usd_to_ccy.',
      ),
    ],
    source: 'Dim',
    stage: 'reference',
    implementation: 'implemented',
    logic: [
      'Supplied net_usd_month_end remains authoritative.',
      'Do not apply a second conversion to a supplied USD amount.',
    ],
    caution:
      'Only actual executed lookup evidence is marked Applied. No rule classifies daily versus month-end rate effects as explained rounding.',
  },
  {
    id: 'expected_events',
    title: 'Recognition events',
    relation: 'expected_events · temporary logical view',
    role: 'Unifies POS and WEB revenue recognition while retaining source traceability in the run preview.',
    grain:
      'One revenue recognition event; one returned order contributes two events.',
    keys: [
      'store_key + posting_date are aggregation keys, not a unique event identity',
    ],
    fields: [
      key('store_key', 'Shared normalized ledger store key.'),
      date(
        'posting_date',
        'Recognition date: POS posting, WEB delivery or WEB return.',
      ),
      usd(
        'revenue_usd',
        'Positive keeper/delivery net or negative full return net.',
      ),
    ],
    stage: 'recognition',
    implementation: 'implemented',
    logic: [
      'UNION ALL keeper POS net on posting date.',
      'UNION ALL non-cancelled WEB net on delivery date.',
      'UNION ALL returned WEB negative net on return date.',
      'Cancelled WEB orders create no normal recognition event, but stay in source and cancellation classification.',
    ],
    caution:
      'There is no persistent table named unified_transactions. This connection-scoped view is captured only as a bounded same-run preview; GL, Flash and dimensions remain separate.',
  },
  {
    id: 'expected_daily',
    title: 'Expected daily revenue',
    relation: 'expected_daily',
    role: 'Sums source recognition events at the same grain as financial comparison.',
    grain: 'One store_key × posting_date.',
    keys: ['store_key', 'posting_date'],
    fields: [
      key('store_key', 'Shared store key.'),
      date('posting_date', 'Recognition day.'),
      usd('expected_revenue', 'SUM(revenue_usd) from recognition events.'),
    ],
    stage: 'reconciliation',
    implementation: 'implemented',
    logic: [
      'Aggregate all source events by store and posting date.',
      'Keep adjacent-period input rows until timing and recognition are evaluated.',
    ],
  },
  {
    id: 'gl_daily',
    title: 'Actual daily ledger',
    relation: 'gl_daily',
    role: 'Aggregates journals to a compatible daily store grain.',
    grain: 'One store_key × posting_date.',
    keys: ['store_key', 'posting_date'],
    fields: [
      key('store_key', 'Shared store key.'),
      date('posting_date', 'Posting day.'),
      usd('gl_revenue', 'SUM once-reversed journal revenue.'),
      field(
        'journals',
        'BIGINT',
        'Journal count; distinguishes absent groups from a present zero journal.',
      ),
    ],
    source: 'GL',
    stage: 'reconciliation',
    implementation: 'implemented',
    logic: [
      'SUM revenue and COUNT journals before comparison.',
      'A zero-valued journal still means the GL group exists.',
    ],
  },
  {
    id: 'daily_comparison',
    title: 'Store-day reconciliation',
    relation: 'daily_comparison',
    role: 'Compares complete expected and actual daily aggregates, including source-only and GL-only days.',
    grain: 'One store_key × posting_date from either side.',
    keys: ['store_key', 'posting_date'],
    fields: [
      key('store_key', 'Coalesced key from both sides.'),
      date('posting_date', 'Coalesced posting date.'),
      usd(
        'expected_revenue',
        'Source aggregate; absent side contributes zero at comparison grain.',
      ),
      usd(
        'gl_revenue',
        'Ledger aggregate; absent side contributes zero at comparison grain.',
      ),
      usd('variance', 'GL − expected source.'),
      field(
        'missing_gl',
        'BOOLEAN',
        'No GL group, and nonzero expected revenue.',
      ),
    ],
    stage: 'reconciliation',
    implementation: 'implemented',
    logic: [
      'FULL OUTER JOIN expected_daily and gl_daily on store_key + posting_date.',
      'A present GL group with a wrong amount is a variance, not missing GL.',
      'Source-minus-GL exception deltas reverse the daily SQL variance sign.',
    ],
  },
  {
    id: 'bridge',
    title: 'Revenue bridge',
    relation: 'bridgeSQL(period) + exact-cent residual',
    role: 'Explains the difference from monthly gross Flash to financial ledger revenue.',
    grain: 'One selected complete-month reporting period.',
    keys: ['period.start', 'period.end'],
    fields: [
      usd('Flash_Sales', 'Monthly gross baseline.'),
      usd('Discounts', 'Negative raw discounts.'),
      usd('Cancellations', 'Negative cancelled WEB gross less discount.'),
      usd(
        'Timing_Differences',
        'Recognition-date net less transaction-date net within the period.',
      ),
      usd('Returns', 'Negative returned WEB net on return date.'),
      usd(
        'Data_Errors',
        'Discarded POS net plus genuine missing-GL store-day adjustments.',
      ),
      usd('Unexplained', 'GL minus baseline and classified adjustments.'),
      usd('GL_Finance', 'Once-sign-reversed finance revenue.'),
    ],
    stage: 'reconciliation',
    implementation: 'implemented',
    logic: [
      'Apply each bridge bucket using its own date and source grain.',
      'Preserve an explicit residual; do not invent rounding, shipping, FX or channel adjustments.',
      'Convert decimal strings into safe integer cents and reject unsafe totals.',
    ],
  },
  {
    id: 'results',
    title: 'Dashboard & Exception Log',
    relation: 'Atomic application result snapshot',
    role: 'Publishes exact-cent totals, complete exceptions and bounded model previews from one successful run.',
    grain: 'One run/configuration snapshot, plus traceable exception cases.',
    keys: ['run identity', 'reporting period', 'confirmed file configuration'],
    fields: [
      field('cents', 'Integer cents', 'Authoritative bridge money values.'),
      field(
        'exceptions',
        'Cases',
        'Duplicate receipt/line exports and nonzero daily differences.',
      ),
      field(
        'dailyDifferences',
        'Bounded preview',
        'At most 200 largest nonzero store-day differences.',
      ),
      field(
        'evidence',
        'Bounded run metadata',
        'Captured before SQL connection cleanup; unavailable until a successful supported run.',
      ),
    ],
    stage: 'output',
    implementation: 'implemented',
    logic: [
      'Dashboard and exceptions publish together after success.',
      'Changes to files, mapping, header or period invalidate the result and its evidence.',
      'Local exports create review drafts; no financial data is uploaded or posted to an ERP.',
    ],
  },
]

export const modelConnections: ModelConnection[] = [
  {
    id: 'pos-normalize',
    from: 'raw_pos',
    to: 'pos_ranked',
    label: 'Type & rank exports',
    operation: 'Projection + window ranking',
    keys: ['PARTITION BY receipt_no, line_no'],
    cardinality: '1 input row → 1 ranked row',
    condition:
      'Staging kiểm tra khóa, ngày/timestamp và tiền nguyên tệ; không yêu cầu Raw đã có USD.',
    explanation:
      'ROW_NUMBER orders by exported_at, source_export_seq, file order and row order. Original source export_seq is not blindly filtered.',
  },
  {
    id: 'pos-keep',
    from: 'pos_ranked',
    to: 'vw_pos',
    label: 'Keep earliest export',
    operation: 'Filter',
    keys: ['Computed export_seq = 1'],
    cardinality: 'Many exports → one keeper per receipt line',
    condition: 'Use computed rank, not the uploaded sequence.',
    explanation:
      'Keeper đi qua q_POS_Cleaning → q_POS_USD → fact_POS_final. Nhánh audit q_POS_Dup_Rows / q_POS_Dup_Impact giữ dòng loại và lý do, tách khỏi doanh thu fact.',
  },
  {
    id: 'pos-audit',
    from: 'pos_ranked',
    to: 'q_POS_Dup_Impact',
    label: 'Giữ nhánh audit & quy đổi',
    operation: 'Nhánh riêng sau phân loại và quy đổi USD',
    keys: ['receipt_no + line_no', 'keep_rank > 1 cho discarded exports'],
    cardinality:
      'Mọi bản xuất giữ audit; N bản xuất cùng khóa → N−1 dòng bị loại',
    condition:
      'Audit giữ mọi dòng nguồn và nguyên nhân; dữ liệu fact chỉ theo nhánh keeper.',
    explanation:
      'q_POS_Dup_Rows chỉ lọc bản xuất bị loại từ audit đã quy đổi. q_POS_Dup_Impact tổng hợp net USD ngày và cuối kỳ, không nối ngược vào fact.',
  },
  {
    id: 'web-normalize',
    from: 'raw_web',
    to: 'vw_web',
    label: 'Validate order lifecycle',
    operation: 'Projection + validation',
    keys: ['web_order_id must be unique'],
    cardinality: '1 order → 1 normalized order',
    condition:
      'Valid status, unique ID, valid dates and non-negative net/discount.',
    explanation:
      'Cancelled and returned flags control subsequent recognition. Invalid supplied dates are not silently invented.',
  },
  {
    id: 'gl-normalize',
    from: 'raw_gl',
    to: 'vw_gl',
    label: 'Normalize ledger sign',
    operation: 'Projection + validation',
    keys: ['journal_id must be unique'],
    cardinality: '1 journal → 1 revenue journal',
    condition:
      'Signed amount, posting date, store and journal type are required.',
    explanation: 'revenue_usd = −amount_usd, applied once.',
  },
  {
    id: 'store-pos',
    from: 'dim_store',
    to: 'raw_pos',
    label: 'Resolve POS store alias',
    operation: 'Configured left lookup in accounting projection',
    keys: ['Configured source/reference pairs combined with AND'],
    cardinality: 'Many fact rows → at most one lookup target',
    condition:
      'A confirmed Store Master relationship selects this source and its reference keys.',
    explanation:
      'The engine performs the configured left lookup. Duplicate reference keys fail; unmatched rows either block processing or preserve the source key according to the selected policy.',
  },
  {
    id: 'store-web',
    from: 'dim_store',
    to: 'raw_web',
    label: 'Resolve WEB store alias',
    operation: 'Configured left lookup in accounting projection',
    keys: ['Configured source/reference pairs combined with AND'],
    cardinality: 'Many fact rows → at most one target',
    condition:
      'WEB store is mapped; otherwise online ledger store 999999 is explicit.',
    explanation:
      'Repeated finance target codes are compatible with many aliases; one alias cannot map to multiple stores.',
  },
  {
    id: 'store-gl',
    from: 'dim_store',
    to: 'raw_gl',
    label: 'Resolve GL store alias',
    operation: 'Configured left lookup in accounting projection',
    keys: ['Configured source/reference pairs combined with AND'],
    cardinality: 'Many journals → at most one target',
    condition: 'A confirmed Store Master relationship selects GL.',
    explanation:
      'The same normalized ledger key is used before source and GL aggregation. There is no many-to-many revenue join.',
  },
  {
    id: 'calendar-pos',
    from: 'dim_date',
    to: 'raw_pos',
    label: 'Resolve dates & posting map',
    operation: 'Configured left lookup + explicit purpose',
    keys: [
      'Configured source/reference pairs combined with AND',
      'Selected date or posting-date output',
    ],
    cardinality: 'Many source rows → at most one date mapping',
    condition:
      'A confirmed Calendar relationship explicitly resolves a date or supplies POS posting date.',
    explanation:
      'If no explicit posting mapping exists, use business_date. working_day is not used to calculate an offset.',
  },
  {
    id: 'calendar-web',
    from: 'dim_date',
    to: 'raw_web',
    label: 'Resolve WEB calendar keys',
    operation: 'Configured date-resolution left lookup',
    keys: ['Selected source/reference date key pairs'],
    cardinality: 'Many orders → at most one date mapping per date role',
    condition:
      'A confirmed Calendar date-resolution relationship selects the source date field.',
    explanation:
      'Each date role stays separate. Delivery and return sequence is validated after normalization.',
  },
  {
    id: 'calendar-gl',
    from: 'dim_date',
    to: 'raw_gl',
    label: 'Resolve posting calendar key',
    operation: 'Configured date-resolution left lookup',
    keys: ['Selected source/reference key pairs'],
    cardinality: 'Many journals → at most one date mapping',
    condition: 'A confirmed Calendar relationship selects GL posting date.',
    explanation:
      'This resolves an explicit date key; it does not infer Finance recognition timing.',
  },
  {
    id: 'pos-events',
    from: 'vw_pos',
    to: 'expected_events',
    label: 'POS recognition',
    operation: 'UNION ALL branch',
    keys: ['store_key', 'posting_date'],
    cardinality: '1 keeper line → 1 event',
    condition: 'Keeper POS row has passed validation.',
    explanation:
      'Recognize net_usd_month_end on posting_date. This is event construction, not a receipt-to-journal join.',
  },
  {
    id: 'web-events',
    from: 'vw_web',
    to: 'expected_events',
    label: 'Delivery & return events',
    operation: 'Two UNION ALL branches',
    keys: ['store_key', 'delivery_date / return_date'],
    cardinality: 'Cancelled: 0 events; delivered: 1; returned: 2',
    condition:
      'Non-cancelled orders recognize positive net on delivery; returned orders additionally reverse full net on return.',
    explanation:
      'The original order is retained in vw_web so both events can be traced. No partial return is inferred.',
  },
  {
    id: 'events-daily',
    from: 'expected_events',
    to: 'expected_daily',
    label: 'Aggregate source revenue',
    operation: 'GROUP BY store_key, posting_date',
    keys: ['store_key', 'posting_date'],
    cardinality: 'Many recognition events → 1 store-day',
    condition:
      'Retain all selected input dates until period-sensitive recognition has been calculated.',
    explanation:
      'A common grain prevents multiple receipts from being multiplied by multiple journals.',
  },
  {
    id: 'gl-daily',
    from: 'vw_gl',
    to: 'gl_daily',
    label: 'Aggregate finance revenue',
    operation: 'GROUP BY store_key, posting_date',
    keys: ['store_key', 'posting_date'],
    cardinality: 'Many journals → 1 store-day',
    condition: 'All included revenue journal types contribute.',
    explanation:
      'SUM revenue_usd and COUNT journals. A present zero journal is a real group.',
  },
  {
    id: 'compare-expected',
    from: 'expected_daily',
    to: 'daily_comparison',
    label: 'Compare compatible aggregates',
    operation: 'FULL OUTER JOIN gl_daily USING (store_key, posting_date)',
    keys: ['store_key', 'posting_date'],
    cardinality: 'One store-day ↔ one store-day, including unmatched sides',
    condition: 'Each side has already been grouped to the same keys.',
    explanation:
      'Missing sides become zero at aggregate comparison grain. Daily variance = GL − source. No receipt/order-to-journal join occurs.',
  },
  {
    id: 'compare-gl',
    from: 'gl_daily',
    to: 'daily_comparison',
    label: 'Retain ledger-only days',
    operation: 'FULL OUTER JOIN expected_daily USING (store_key, posting_date)',
    keys: ['store_key', 'posting_date'],
    cardinality: 'One store-day ↔ one store-day, including unmatched sides',
    condition: 'GL aggregate exists with its journal count.',
    explanation:
      'Extra ledger days remain visible variances. They are not automatically treated as missing GL or invented data errors.',
  },
  {
    id: 'flash-bridge',
    from: 'vw_flash',
    to: 'bridge',
    label: 'Monthly gross baseline',
    operation: 'Reporting-period filter + SUM; scalar bridge composition',
    keys: ['month_end_date BETWEEN period.start AND period.end'],
    cardinality: 'Many monthly rows → 1 reporting-period total',
    condition: 'Complete calendar months; Flash dates are actual month ends.',
    explanation:
      'There is no Flash-to-daily-Calendar join. Joining a monthly amount to every day and then summing would multiply revenue.',
  },
  {
    id: 'pos-bridge',
    from: 'q_POS_Dup_Impact',
    to: 'bridge',
    label: 'POS bridge adjustments',
    operation: 'SUM audit pos_clean discounts + q_POS_Dup_Rows daily net',
    keys: ['business_date', 'keep_rank > 1 cho duplicate net'],
    cardinality: 'Nhánh audit → tổng điều chỉnh trong kỳ',
    condition:
      'Discount lấy từ pos_clean trên mọi bản xuất. Duplicate net lấy riêng từ q_POS_Dup_Rows theo tỷ giá ngày; q_POS_Dup_Impact cho tổng ảnh hưởng cùng cơ sở.',
    explanation:
      'Giữ quy ước dấu âm cho duplicate adjustment. Không trừ discount thêm lần nữa và không đưa discarded exports trở lại fact. Flash được đối chiếu theo giả định bao gồm mọi bản xuất nguồn.',
  },
  {
    id: 'pos-timing-bridge',
    from: 'vw_pos',
    to: 'bridge',
    label: 'Thời điểm ghi nhận keeper',
    operation: 'Tổng chênh lệch kỳ posting_date và business_date',
    keys: ['posting_date', 'business_date'],
    cardinality: 'Keeper đã quy đổi → điều chỉnh thời điểm trong kỳ',
    condition:
      'Chỉ fact keeper được dùng cho timing; không dùng dòng xuất lặp.',
    explanation:
      'Đối chiếu net_usd_month_end tại posting_date và business_date. Giữ nguyên quy ước dấu và residual của bridge.',
  },
  {
    id: 'web-bridge',
    from: 'vw_web',
    to: 'bridge',
    label: 'WEB bridge adjustments',
    operation: 'Separate date-aware aggregate calculations',
    keys: ['order_date', 'delivery_date', 'return_date', 'order_status'],
    cardinality: 'Many orders → reporting-period bucket totals',
    condition:
      'Discounts include cancelled orders; cancellations remove cancelled gross minus discount; returned net reverses on return date.',
    explanation:
      'Cross-period delivery creates incoming or outgoing timing. A return may relate to an order in a previous period.',
  },
  {
    id: 'comparison-bridge',
    from: 'daily_comparison',
    to: 'bridge',
    label: 'Genuine missing-GL adjustment',
    operation: 'Filter missing_gl + period SUM',
    keys: ['missing_gl', 'posting_date'],
    cardinality: 'Many missing store-days → 1 Data Errors component',
    condition: 'No GL journals and nonzero expected revenue.',
    explanation:
      'Adjustment = 0 − expected revenue. A missing refund day therefore contributes a positive adjustment. Present-but-wrong GL amounts stay residual.',
  },
  {
    id: 'gl-bridge',
    from: 'vw_gl',
    to: 'bridge',
    label: 'Finance endpoint',
    operation: 'Posting-period filter + SUM',
    keys: ['posting_date BETWEEN period.start AND period.end'],
    cardinality: 'Many journals → 1 finance total',
    condition:
      'Signed revenue journals only; normalized revenue sign has already been applied.',
    explanation:
      'The actual GL total is the endpoint; unexplained = GL − classified bridge total.',
  },
  {
    id: 'bridge-results',
    from: 'bridge',
    to: 'results',
    label: 'Publish one result snapshot',
    operation: 'Atomic store publication',
    keys: ['generation token', 'confirmed configuration', 'reporting period'],
    cardinality: '1 successful run → 1 current snapshot',
    condition:
      'Run is still current and not aborted; all required sources and mappings are confirmed.',
    explanation:
      'Bounded evidence, bridge and exception results belong to the same run. Edits invalidate them together.',
  },
  {
    id: 'comparison-results',
    from: 'daily_comparison',
    to: 'results',
    label: 'Trace daily differences',
    operation: 'Nonzero period filter + exception projection',
    keys: ['store_key', 'posting_date'],
    cardinality: '1 nonzero store-day → 1 daily exception case',
    condition:
      'Exception output is complete; Dashboard daily preview is capped at 200.',
    explanation:
      'Exception delta = source − GL. The default UI filter is strict |delta| > $200; exports include all filtered cases before pagination.',
  },
]

const rule = (item: MethodologyRule): MethodologyRule => item
export const methodologyRules: MethodologyRule[] = [
  rule({
    id: 'header-selection',
    title: 'Read the selected header row',
    group: 'Parsing',
    purpose:
      'Exclude export metadata without changing which source rows mean data.',
    sourceIds: ['POS', 'WEB', 'GL', 'Flash', 'Dim'],
    inputFields: ['file', 'headerRow', 'worksheet'],
    condition:
      'Each selected CSV/XLSX file; one-based header row defaults to 1.',
    logic:
      'Use the same selected header for bounded preview and full ingestion. Fact exports use the first worksheet; each selected Master sheet has its own header shared by all roles using that sheet.',
    output: 'Mapped headers and source rows after the selected header.',
    nullError:
      'Missing or duplicate headers produce a recoverable warning. Corrupt files and invalid cached formula/error cells fail visibly. No unconditional Flash row skip.',
    implementation: 'implemented',
    evidenceTables: [],
    technical:
      'readMappingPreviews(..., headerRow); workbookToCSV(..., headerRow); validateHeaderRow(headerRow)',
    technicalSource: 'src/lib/mapping-preview.ts; src/lib/spreadsheet.ts',
  }),
  rule({
    id: 'date-normalization',
    title: 'Normalize each date role',
    group: 'Normalization',
    purpose:
      'Make sales, delivery, return and posting dates comparable without inventing dates.',
    sourceIds: ['POS', 'WEB', 'GL', 'Flash'],
    inputFields: ['selected date columns', 'confirmed Calendar relationships'],
    condition: 'A date field is mapped or is required by a row’s lifecycle.',
    logic:
      'Parse supported timestamps, ISO dates and calendar keys. Slash dates try US month-first before day-first. If direct parsing does not resolve a value, use a validated calendar lookup where available.',
    output: 'Typed DATE/TIMESTAMP values in normalized source relations.',
    nullError:
      'Unresolved required dates fail row validation; invalid mapped dates do not become a fabricated reporting date.',
    implementation: 'implemented',
    evidenceTables: ['vw_pos', 'vw_web', 'vw_gl', 'vw_flash'],
    technical:
      'COALESCE(TRY_CAST(... AS TIMESTAMP), TRY_STRPTIME(...)); configured Calendar output overrides; CAST(... AS DATE)',
    technicalSource:
      'src/lib/reconciliation-sql.ts; src/lib/reconciliation-accounting.ts',
  }),
  rule({
    id: 'pos-dedup',
    title: 'Keep the earliest POS export',
    group: 'Source integrity',
    purpose:
      'Count each receipt line once while retaining discarded export evidence.',
    sourceIds: ['POS'],
    inputFields: [
      'receipt_no',
      'line_no',
      'exported_at',
      'source_export_seq',
      'file/row order',
    ],
    condition:
      'All selected POS export rows, including duplicates across files.',
    logic:
      'Partition by receipt_no + line_no. Rank by earliest exported_at, then source sequence, stable file order and row order. Keep computed export_seq = 1.',
    output:
      'q_POS_First_Export → q_POS_Cleaning → q_POS_USD → fact_POS_final; q_POS_Dup_Rows và q_POS_Dup_Impact giữ nhánh audit cho bridge và ngoại lệ.',
    nullError:
      'Required identities and amounts fail when invalid. Missing export timestamps use the documented sequence/file-order fallback; malformed supplied timestamps fail.',
    implementation: 'implemented',
    evidenceTables: [
      'pos_staging',
      'pos_ranked',
      'q_POS_First_Export',
      'q_POS_Cleaning',
      'q_POS_Dup_Keys',
      'q_POS_Dup_Rows',
      'q_POS_Dup_Impact',
      'q_POS_USD',
      'fact_POS_final',
      'vw_pos',
    ],
    technical:
      'ROW_NUMBER() OVER (PARTITION BY receipt_no, line_no ORDER BY exported_at ASC NULLS LAST, source_export_seq ASC NULLS LAST, __reconcile_file_order, __reconcile_row_order)',
    technicalSource:
      'src/lib/reconciliation-accounting.ts · ACCOUNTING_POS_SQL',
  }),
  rule({
    id: 'net-precedence',
    title: 'Honor mapped net amounts',
    group: 'Amounts',
    purpose: 'Preserve supplied net and avoid deducting a discount twice.',
    sourceIds: ['POS', 'WEB'],
    inputFields: [
      'selected net_amount',
      'selected gross_amount',
      'selected discount',
    ],
    condition:
      'Decision is made per file’s confirmed mapping, before SQL is generated.',
    logic:
      'Nếu net USD đã map, dùng nguyên giá trị được chọn, gồm 0. Nếu chưa map, POS tính net_local = gross_local − discount_local rồi quy đổi theo FX đã xác nhận; WEB dùng gross USD trừ discount USD.',
    output: 'net_usd_month_end as DECIMAL(18,2).',
    nullError:
      'Mapped blank/invalid net fails row validation; there is no per-cell fallback. POS non-USD line_amount cannot be combined with USD discount to derive USD net.',
    implementation: 'implemented',
    evidenceTables: ['vw_pos', 'vw_web'],
    technical:
      'mapped USD net: authoritative, including 0; unmapped POS local net: (line_amount − discount_amount) / usd_to_ccy; invalid mapped cells fail',
    technicalSource:
      'src/lib/reconciliation-accounting.ts · accountingProjection',
  }),
  rule({
    id: 'web-recognition',
    title: 'Recognize delivery and reverse returns',
    group: 'Recognition',
    purpose: 'Separate order activity from earned revenue.',
    sourceIds: ['WEB'],
    inputFields: [
      'web_order_id',
      'order_status',
      'order_date',
      'delivery_date',
      'return_date',
      'net_usd_month_end',
    ],
    condition:
      'Delivered, Cancelled/Canceled and Returned statuses only, normalized case-insensitively.',
    logic:
      'Delivered: positive net on delivery. Returned: positive net on delivery and full negative net on return. Cancelled: no recognition event; retain source row for cancellation bridge.',
    output: 'Zero, one or two recognition events per order.',
    nullError:
      'Dates must follow the actual order lifecycle. Missing delivery/return dates fail where required. Cancelled orders cannot carry delivery/return dates. Partial refunds are not modeled.',
    implementation: 'implemented',
    evidenceTables: ['vw_web', 'expected_events'],
    technical:
      'UNION ALL ... FROM vw_web WHERE NOT is_cancelled; UNION ALL ... -net_usd_month_end ... WHERE is_returned',
    technicalSource:
      'src/lib/reconciliation-sql.ts · DAILY_SQL + VALIDATION_SQL',
  }),
  rule({
    id: 'gl-sign',
    title: 'Normalize the finance sign once',
    group: 'Amounts',
    purpose: 'Express signed ledger credits as revenue consistently.',
    sourceIds: ['GL'],
    inputFields: ['selected signed amount_usd / Net Amount'],
    condition: 'Every validated included revenue journal.',
    logic:
      'revenue_usd = −amount_usd. All included journal types affect Finance revenue; MANUAL does not itself explain the bridge.',
    output: 'Once-reversed journal revenue in vw_gl.',
    nullError:
      'GL Net Amount remains required. Invalid signed amounts, missing identity/date/store/type or duplicate journal IDs fail.',
    implementation: 'implemented',
    evidenceTables: ['vw_gl'],
    technical:
      'CREATE TEMP VIEW vw_gl AS SELECT *, -amount_usd AS revenue_usd FROM gl_clean',
    technicalSource: 'src/lib/reconciliation-sql.ts',
  }),
  rule({
    id: 'store-lookup',
    title: 'Resolve stores without fanout',
    group: 'Dimensions',
    purpose:
      'Compare equivalent stores while preventing duplicated revenue through ambiguous joins.',
    sourceIds: ['POS', 'WEB', 'GL', 'Dim'],
    inputFields: [
      'selected store column',
      'mapped Finance store code',
      'selected reference join-key columns',
    ],
    condition:
      'A confirmed Store Master relationship chooses the source, worksheet, mappings, join pairs and returned Finance code.',
    logic:
      'Trim and uppercase text keys while preserving leading zeros. Check uniqueness on the exact chosen single/composite reference key; duplicates block the run. Execute a left lookup with the configured unmatched policy.',
    output: 'One normalized store_key per fact row.',
    nullError:
      'Conflicting alias targets fail. An unmapped WEB store alone uses documented online store 999999. No arbitrary store assignment is synthesized.',
    implementation: 'implemented',
    evidenceTables: ['vw_pos', 'vw_web', 'vw_gl'],
    technical:
      'LEFT JOIN selected reference ON configured key pairs combined with AND; GROUP BY selected keys HAVING COUNT(*) > 1 blocks processing',
    technicalSource: 'src/lib/master-joins.ts · buildMasterJoins',
  }),
  rule({
    id: 'calendar-posting',
    title: 'Use explicit POS posting dates',
    group: 'Recognition',
    purpose: 'Keep recognition timing tied to supplied accounting information.',
    sourceIds: ['POS', 'Dim'],
    inputFields: [
      'mapped posting_date',
      'business_date',
      'confirmed Calendar posting-date output',
    ],
    condition:
      'Each POS file; fallback applies only when posting date is unmapped.',
    logic:
      'An explicitly configured Calendar posting relationship supplies recognition dates. Otherwise mapped posting date takes precedence, then business date.',
    output: 'POS recognition posting_date.',
    nullError:
      'An invalid mapped posting date fails. No working-day offset is inferred from a working_day flag.',
    implementation: 'implemented',
    evidenceTables: ['vw_pos'],
    technical:
      'Configured LEFT JOIN Calendar key pairs; apply posting_date output according to selected purpose and unmatched policy',
    technicalSource: 'src/lib/reconciliation-accounting.ts',
  }),
  rule({
    id: 'aggregate-grain',
    title: 'Aggregate before comparing',
    group: 'Reconciliation',
    purpose:
      'Avoid multiplying receipts, orders and journals that have different grains.',
    sourceIds: ['POS', 'WEB', 'GL'],
    inputFields: [
      'expected_events.store_key/posting_date/revenue_usd',
      'vw_gl.store_key/posting_date/revenue_usd',
    ],
    condition:
      'Validated recognition events and ledger journals are available.',
    logic:
      'Sum source recognition by store × posting date; independently sum GL and count its journals at the same grain. Full-outer join these aggregates using both keys.',
    output: 'One daily_comparison row per store-day from either side.',
    nullError:
      'Missing aggregate sides contribute zero at this comparison boundary. This never authorizes filling missing source cells or IDs with zero.',
    implementation: 'implemented',
    evidenceTables: ['expected_daily', 'gl_daily', 'daily_comparison'],
    technical:
      'expected_daily GROUP BY store_key, posting_date; gl_daily GROUP BY store_key, posting_date; FULL OUTER JOIN USING (store_key, posting_date)',
    technicalSource: 'src/lib/reconciliation-sql.ts · DAILY_SQL',
  }),
  rule({
    id: 'variance-signs',
    title: 'Show the formula in each context',
    group: 'Metrics',
    purpose:
      'Make differently oriented differences understandable without reversing existing semantics.',
    sourceIds: ['POS', 'WEB', 'GL', 'Flash'],
    inputFields: [
      'Flash_Sales',
      'GL_Finance',
      'expected_revenue',
      'gl_revenue',
    ],
    condition: 'A successful current result snapshot is available.',
    logic:
      'Dashboard headline = GL − Flash. Daily SQL = GL − expected source. Exception delta = source − GL. Headline variance % = (GL − Flash) / Flash.',
    output: 'Exact-cent differences with clearly labeled sign conventions.',
    nullError:
      'A zero Flash denominator has no defined headline percentage and displays an em dash. The app does not infer a report ratio when GL = 0.',
    implementation: 'implemented',
    evidenceTables: ['daily_comparison'],
    technical:
      'daily_comparison.variance = gl_revenue − expected_revenue; exception delta = −variance',
    technicalSource: 'src/lib/reconciliation-sql.ts; src/pages/Dashboard.tsx',
  }),
  rule({
    id: 'exception-threshold',
    title: 'Filter review cases by absolute delta',
    group: 'Review controls',
    purpose:
      'Focus the current Exception Log without changing underlying reconciliation.',
    sourceIds: ['POS', 'WEB', 'GL'],
    inputFields: ['exception.deltaCents', 'selected category/search/threshold'],
    condition: 'UI review filter; default threshold is 20,000 cents.',
    logic:
      'Include cases only when |source − GL delta| > $200 by default; equality is excluded for either sign. Apply search/category and sorting before pagination; export all filtered rows.',
    output:
      'A filtered view of complete duplicate and store-day exception candidates.',
    nullError:
      'No 1% condition is added. Different exception categories can overlap economically; summed absolute case deltas are not a new bridge total.',
    implementation: 'implemented',
    evidenceTables: ['daily_comparison'],
    technical:
      'filterExceptions(): Math.abs(row.deltaCents) <= thresholdCents excludes row; filtered.slice(...) is display only',
    technicalSource:
      'src/lib/exceptions.ts; src/components/dashboard/ExceptionLog.tsx',
  }),
  rule({
    id: 'bridge-residual',
    title: 'Keep unexplained revenue explicit',
    group: 'Reconciliation',
    purpose:
      'Reconcile transparently without fabricating an adjustment to force agreement.',
    sourceIds: ['POS', 'WEB', 'GL', 'Flash'],
    inputFields: [
      'Flash_Sales',
      'Discounts',
      'Cancellations',
      'Timing_Differences',
      'Returns',
      'Data_Errors',
      'GL_Finance',
    ],
    condition:
      'A complete-month reporting period and all validated required sources.',
    logic:
      'Explained = Flash + Discounts + Cancellations + Timing + Returns + Data Errors. Unexplained = GL − Explained. Add a visible residual bucket whenever nonzero.',
    output:
      'Explained + Unexplained = GL, with each money value captured as exact cents.',
    nullError:
      'No unsupported shipping, FX, rounding or channel reclassification is invented. A zero residual does not prove zero source anomalies or daily differences.',
    implementation: 'implemented',
    evidenceTables: ['vw_flash', 'daily_comparison'],
    technical:
      'BigInt cents sums; residual = BigInt(cents.GL_Finance) − explained; reject unsafe integer-cent totals',
    technicalSource:
      'src/lib/ReconciliationEngine.ts; src/lib/reconciliation-types.ts',
  }),
  rule({
    id: 'row-validation',
    title: 'Validate source rows before publishing',
    group: 'Quality',
    purpose:
      'Stop malformed finance data from becoming a plausible-looking result.',
    sourceIds: ['POS', 'WEB', 'GL', 'Flash'],
    inputFields: [
      'required keys',
      'date roles',
      'amounts',
      'WEB status',
      'Flash month ends',
    ],
    condition:
      'Production schemaMode = accounting. Compatibility mode is an explicit legacy path only.',
    logic:
      'Run source-specific row and uniqueness checks. Validate WEB lifecycle, signed GL fields and unique journal IDs, and non-negative calendar-month-end Flash values.',
    output:
      'A successful result only after all executed accounting checks return zero invalid rows/groups.',
    nullError:
      'Any failed check aborts publication and clears both result views. Only actual run validation evidence may be labeled passed; existence of a rule is not proof it ran.',
    implementation: 'implemented',
    evidenceTables: ['vw_pos', 'vw_web', 'vw_gl', 'vw_flash'],
    technical:
      'ACCOUNTING_POS_VALIDATION + VALIDATION_SQL.slice(3); query COUNT invalid rows/groups; throw when count > 0',
    technicalSource:
      'src/lib/ReconciliationEngine.ts; src/lib/reconciliation-accounting.ts; src/lib/reconciliation-sql.ts',
  }),
  rule({
    id: 'missing-gl',
    title: 'Separate absent GL from an amount variance',
    group: 'Quality',
    purpose:
      'Classify genuine ledger coverage gaps without hiding ordinary mismatches.',
    sourceIds: ['POS', 'WEB', 'GL'],
    inputFields: ['expected_revenue', 'gl_daily.journals', 'posting_date'],
    condition: 'Daily store/date aggregates have been compared.',
    logic:
      'Missing GL means the ledger group is absent and expected source revenue is nonzero. Its bridge effect is 0 − expected revenue. Present journals, including a zero journal, create amount variance instead.',
    output:
      'Missing GL cases and signed Data Errors adjustments; other daily variances remain unexplained.',
    nullError:
      'A missing negative refund day contributes a positive bridge adjustment. A manual journal is attributed individually only when it is the sole manual journal on a zero-expected day.',
    implementation: 'implemented',
    evidenceTables: ['daily_comparison', 'gl_daily'],
    technical:
      'missing_gl = g.journals IS NULL AND COALESCE(e.expected_revenue,0) <> 0',
    technicalSource: 'src/lib/reconciliation-sql.ts · DAILY_SQL + exceptionSQL',
  }),
  rule({
    id: 'flash-coverage',
    title: 'Validate the monthly baseline',
    group: 'Quality',
    purpose: 'Use a monthly baseline without duplicating it across daily rows.',
    sourceIds: ['Flash'],
    inputFields: ['month_end_date', 'revenue_usd', 'reporting period'],
    condition: 'Reporting range consists of complete calendar months.',
    logic:
      'Require actual month-end dates and non-negative supplied USD. Sum only in-period Flash rows. If no rows match the period, disclose the zero baseline and coverage note.',
    output:
      'Flash_Sales and an explicit missing-coverage note when applicable.',
    nullError:
      'Partial-month periods fail. No Flash-to-Calendar period join is used. Empty coverage is not silently described as complete.',
    implementation: 'implemented',
    evidenceTables: ['vw_flash'],
    technical:
      'month_end_date = last_day(month_end_date); COUNT flash period rows; validatePeriod() requires month boundaries',
    technicalSource:
      'src/lib/reconciliation-sql.ts; src/lib/ReconciliationEngine.ts',
  }),
  rule({
    id: 'report-store-month',
    title: 'Store-month materiality policy',
    group: 'Report reference',
    purpose:
      'Describe the report’s combined absolute and relative materiality proposal separately from the live log.',
    sourceIds: ['GL'],
    inputFields: ['store × month difference', 'store × month GL'],
    condition:
      'Report reference, not the current store-day Exception Log filter.',
    logic: '|difference| > 200 USD AND |difference / GL| > 1%.',
    output: 'Reference policy only; not an applied app filter.',
    nullError:
      'GL = 0 needs a separately agreed policy. No percentage or pass/fail is invented, and this condition is not added to the current log.',
    implementation: 'reference',
    evidenceTables: [],
    technical: 'Not executed by current engine or filterExceptions().',
    technicalSource: 'Team report summary supplied by user · pp. 24–30',
  }),
  rule({
    id: 'report-working-day',
    title: 'Working-day posting calendar',
    group: 'Report reference',
    purpose:
      'Show the difference between a report recommendation and actual posting-date behavior.',
    sourceIds: ['POS', 'Dim'],
    inputFields: ['working_day', 'business_date', 'report posting policy'],
    condition:
      'Reference model only; an inferred workday offset is not supported.',
    logic:
      'The report discusses a working-day calendar. Current production uses mapped posting date, explicit calendar posting mapping, then business-date fallback.',
    output:
      'No inferred posting date; see the implemented calendar-posting rule.',
    nullError:
      'A working_day flag alone is not enough to infer recognition timing.',
    implementation: 'unsupported',
    evidenceTables: [],
    technical:
      'No working_day offset calculation exists in accountingProjection().',
    technicalSource: 'Team report summary supplied by user · pp. 17–23',
  }),
  rule({
    id: 'report-fx',
    title: 'Explicit FX conversion model',
    group: 'Amounts',
    purpose:
      'Quy đổi POS nguyên tệ sau phân loại keeper, giữ riêng cơ sở tỷ giá ngày và cuối kỳ, không quy đổi lại supplied USD.',
    sourceIds: ['POS', 'Dim'],
    inputFields: ['local amount', 'date/month + currency', 'usd_to_ccy'],
    condition:
      'POS có số tiền nguyên tệ và cấu hình FX được xác nhận; net USD đã map luôn là giá trị chuẩn.',
    logic:
      'Tra FX theo khóa ngày/kỳ AND currency đã cấu hình; USD = amount_local / usd_to_ccy. Daily và month-end có cột riêng; supplied USD net không bị quy đổi lần hai.',
    output:
      'q_POS_USD và fact_POS_final từ keeper; q_POS_Dup_Impact từ nhánh audit. Ảnh hưởng FX chưa phân loại vẫn là residual, không ép về 0.',
    nullError:
      'Thiếu, trùng hoặc sai tỷ giá phải báo đúng khóa FX và currency; không tự điền USD bằng 0 hoặc coi ngoại tệ là USD.',
    implementation: 'implemented',
    evidenceTables: ['q_POS_USD', 'fact_POS_final', 'q_POS_Dup_Impact'],
    technical:
      'amount_usd = amount_local / usd_to_ccy; only confirmed date/month AND currency lookup keys; mapped supplied USD net bypasses conversion',
    technicalSource:
      'src/lib/reconciliation-accounting.ts; src/lib/ReconciliationEngine.ts',
  }),
]

export const reportReferences: ReportReference[] = [
  {
    id: 'report-model',
    title: 'Báo cáo đối soát doanh thu',
    team: 'eDA_Sale, We Analyze',
    pages: '7–16',
    scope: 'Tables, grains, keys and relationships.',
    provenance:
      'Page range and scope supplied by the user. The PDF is not bundled with this app and these pages have not been independently verified.',
    verified: false,
  },
  {
    id: 'report-transform',
    title: 'Báo cáo đối soát doanh thu',
    team: 'eDA_Sale, We Analyze',
    pages: '17–23',
    scope: 'Conventions, cleaning, transformation and unified transactions.',
    provenance:
      'User-provided report summary. Current implementation is the authority for live processing behavior.',
    verified: false,
  },
  {
    id: 'report-validation',
    title: 'Báo cáo đối soát doanh thu',
    team: 'eDA_Sale, We Analyze',
    pages: '24–30',
    scope:
      'Validation and metric definitions, including the separate materiality proposal.',
    provenance:
      'User-provided report summary. Report QC counts and totals are not runtime results.',
    verified: false,
  },
  {
    id: 'report-controls',
    title: 'Báo cáo đối soát doanh thu',
    team: 'eDA_Sale, We Analyze',
    pages: '42–44',
    scope: 'Process controls and improvement proposals.',
    provenance:
      'User-provided report summary. Recommendations do not imply implemented engine support.',
    verified: false,
  },
]
