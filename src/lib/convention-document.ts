import { DEFAULT_EXCEPTION_THRESHOLD_CENTS } from './exceptions.ts'
import {
  STORE_MONTH_THRESHOLD_CENTS,
  STORE_MONTH_THRESHOLD_PERCENT,
} from './dashboard-model.ts'
import { REFERENCE_TOLERANCE_USD } from './excel-reference.ts'
import type { BridgeKey } from './reconciliation-types.ts'

/**
 * Recording conventions as a document. The original text comes from
 * “Báo cáo đối soát doanh thu” (eDA_Sale, We Analyze), sections IV, V and IX.
 * Session edits change this document only; engine constants are never read
 * from it. Structure (sections, blocks, table columns, bridge mappings) is
 * fixed so imported files stay comparable with the original.
 */
export const CONVENTION_SCHEMA = 'reconcile.convention-document'
export const CONVENTION_SCHEMA_VERSION = 1

export interface ParagraphBlock {
  id: string
  kind: 'paragraph'
  text: string
}
export interface CalloutBlock {
  id: string
  kind: 'callout'
  label: string
  text: string
  tone: 'rule' | 'warning'
}
export interface FormulaBlock {
  id: string
  kind: 'formula'
  expression: string
  note: string
}
export interface ListBlock {
  id: string
  kind: 'list'
  ordered: boolean
  items: string[]
}
export interface TableColumn {
  key: string
  label: string
  /** Render cells as identifiers (monospace). */
  mono?: boolean
  width?: string
}
export interface TableRow {
  id: string
  cells: Record<string, string>
}
export interface TableBlock {
  id: string
  kind: 'table'
  caption: string
  columns: TableColumn[]
  rows: TableRow[]
  source: string
}
export type AppConventionKey =
  | 'variance-sign'
  | 'store-month-basis'
  | 'materiality-amount'
  | 'materiality-percent'
  | 'rounding'
  | 'bridge-tolerance'
  | 'fx-basis'
export interface ParameterItem {
  id: string
  label: string
  rule: string
  value: number | null
  unit: string
  /** Fixed link to the constant the application really uses. */
  appKey?: AppConventionKey
}
export interface ParametersBlock {
  id: string
  kind: 'parameters'
  caption: string
  items: ParameterItem[]
  source: string
}
export type ExcelBridgeCode =
  | 'sales'
  | 'finance'
  | 'DISCOUNT'
  | 'DUP_POS'
  | 'CANCEL'
  | 'WEB_TIMING'
  | 'POS_TIMING'
  | 'INTERFACE'
  | 'RETURN'
  | 'SHIP'
  | 'FX'
  | 'ROUND'
  | 'UNEXPLAINED'
export type RawBridgeBucket = BridgeKey | 'Unexplained'
export interface BridgeStep {
  id: string
  label: string
  category: string
  note: string
  /** Fixed mappings; not editable. Added rows have none. */
  excelCode?: ExcelBridgeCode
  rawBucket?: RawBridgeBucket | null
}
export interface BridgeBlock {
  id: string
  kind: 'bridge'
  caption: string
  steps: BridgeStep[]
  source: string
}
export type ConventionBlock =
  | ParagraphBlock
  | CalloutBlock
  | FormulaBlock
  | ListBlock
  | TableBlock
  | ParametersBlock
  | BridgeBlock
export interface ConventionSection {
  id: string
  level: 1 | 2
  title: string
  /** live: current workbook/run facts; revisions: document history. */
  content: 'text' | 'live' | 'revisions'
  blocks: ConventionBlock[]
}
export interface ConventionRevision {
  version: string
  date: string
  author: string
  note: string
  origin: 'original' | 'session'
}
export interface ConventionDocument {
  schema: typeof CONVENTION_SCHEMA
  schemaVersion: typeof CONVENTION_SCHEMA_VERSION
  version: string
  title: string
  subtitle: string
  basis: string
  sections: ConventionSection[]
  revisions: ConventionRevision[]
}

const row = (id: string, cells: Record<string, string>): TableRow => ({
  id,
  cells,
})
const paragraph = (id: string, text: string): ParagraphBlock => ({
  id,
  kind: 'paragraph',
  text,
})

export const ORIGINAL_CONVENTION_DOCUMENT: ConventionDocument = {
  schema: CONVENTION_SCHEMA,
  schemaVersion: CONVENTION_SCHEMA_VERSION,
  version: '1.0',
  title: 'Quy ước ghi nhận và đối soát doanh thu',
  subtitle:
    'Mô hình dữ liệu, thời điểm ghi nhận, ngưỡng kiểm tra và cầu nối Sales Flash – Finance GL · FY2025',
  basis: 'Báo cáo đối soát doanh thu — eDA_Sale, We Analyze (mục IV, V và IX)',
  sections: [
    {
      id: 'scope',
      level: 1,
      title: 'Mục đích và phạm vi',
      content: 'text',
      blocks: [
        paragraph(
          'scope-intro',
          'Tài liệu thống nhất cách đọc, ghi nhận và so sánh doanh thu giữa các hệ thống trước khi đối soát. Phạm vi chính là năm tài chính 2025, từ ngày 01/01/2025 đến ngày 31/12/2025; bảng Calendar và các bảng tỷ giá bao phủ từ tháng 12/2024 đến tháng 01/2026 để xác định giao dịch phát sinh và được ghi nhận ở các kỳ kế toán khác nhau.',
        ),
        paragraph(
          'scope-authority',
          'Finance GL là nguồn chuẩn kế toán đã khóa sổ; Sales Flash là nguồn doanh số nhanh dùng để tính chênh lệch. Trước khi nối hoặc đối chiếu, cần xác định ý nghĩa của một dòng, khóa duy nhất và thời điểm ghi nhận ở từng nguồn.',
        ),
        {
          id: 'scope-sources',
          kind: 'table',
          caption: 'Nguồn dữ liệu và vai trò trong đối soát',
          columns: [
            { key: 'source', label: 'Nguồn', width: '22%' },
            { key: 'group', label: 'Nhóm', width: '14%' },
            { key: 'role', label: 'Vai trò trong đối soát' },
          ],
          rows: [
            row('pos', {
              source: 'POS Sales',
              group: 'Nghiệp vụ',
              role: 'Ghi nhận bán hàng tại cửa hàng: hóa đơn, sản phẩm, số lượng, giá bán và chiết khấu.',
            }),
            row('web', {
              source: 'WEB Orders',
              group: 'Nghiệp vụ',
              role: 'Ghi nhận bán hàng trực tuyến: trạng thái đơn, giá trị giao dịch và các thời điểm đặt, giao, trả hàng.',
            }),
            row('gl', {
              source: 'Finance GL',
              group: 'Nghiệp vụ',
              role: 'Doanh thu và các khoản điều chỉnh đã hạch toán; nguồn chuẩn để đối chiếu doanh thu kế toán.',
            }),
            row('flash', {
              source: 'Sales Flash',
              group: 'Nghiệp vụ',
              role: 'Doanh số nhanh theo tháng, kênh bán hàng và thị trường; cơ sở so sánh với Finance GL.',
            }),
            row('store', {
              source: '`Store_Master`',
              group: 'Tham chiếu',
              role: 'Định danh cửa hàng, quốc gia, loại tiền tệ; ánh xạ mã cửa hàng POS sang mã cửa hàng Finance.',
            }),
            row('calendar', {
              source: 'Calendar',
              group: 'Tham chiếu',
              role: 'Lịch, kỳ báo cáo và ngày làm việc; hỗ trợ xác định thời điểm ghi nhận giao dịch.',
            }),
            row('fx-daily', {
              source: '`FX_Daily`',
              group: 'Tham chiếu',
              role: 'Tỷ giá theo ngày và loại tiền tệ; quy đổi giá trị giao dịch sang USD theo tỷ giá ngày.',
            }),
            row('fx-month', {
              source: '`FX_Month_End`',
              group: 'Tham chiếu',
              role: 'Tỷ giá cuối tháng theo từng loại tiền tệ; chuẩn hóa và đối chiếu doanh thu trên Finance GL.',
            }),
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 1 và Bảng 2.',
        },
      ],
    },
    {
      id: 'structure',
      level: 1,
      title: 'Cấu trúc dữ liệu và khóa định danh',
      content: 'text',
      blocks: [
        paragraph(
          'structure-intro',
          'Các bảng giao dịch giữ thông tin phát sinh theo đơn hoặc theo dòng; Finance GL giữ kết quả ghi nhận kế toán; Sales Flash là bảng tổng hợp phục vụ theo dõi nhanh, không chứa hóa đơn hoặc mã đơn. Các bảng tham chiếu được nối vào để chuẩn hóa định danh, thời gian và tỷ giá.',
        ),
        {
          id: 'structure-grain',
          kind: 'table',
          caption: 'Mức chi tiết và khóa định danh của từng bảng',
          columns: [
            { key: 'table', label: 'Bảng', mono: true, width: '18%' },
            { key: 'type', label: 'Loại', width: '20%' },
            { key: 'grain', label: 'Một dòng biểu diễn' },
            { key: 'key', label: 'Khóa định danh', width: '28%' },
          ],
          rows: [
            row('gl', {
              table: 'Finance_GL',
              type: 'Sổ kế toán / sự kiện',
              grain: 'Một bút toán doanh thu hoặc điều chỉnh',
              key: '`journal_id`',
            }),
            row('pos', {
              table: 'POS_Sales',
              type: 'Giao dịch chi tiết',
              grain: 'Một dòng hàng trên hóa đơn POS',
              key: '`receipt_no` + `line_no` (sau khử trùng)',
            }),
            row('web', {
              table: 'WEB_Orders',
              type: 'Giao dịch đơn hàng',
              grain: 'Một đơn đặt hàng trực tuyến',
              key: '`web_order_id`',
            }),
            row('flash', {
              table: 'Sales_Flash',
              type: 'Tổng hợp định kỳ',
              grain: 'Một tháng × kênh × thị trường',
              key: 'Tháng + Kênh + Thị trường (trừ dòng tổng)',
            }),
            row('store', {
              table: 'Store_Master',
              type: 'Tham chiếu',
              grain: 'Một mã cửa hàng POS / giai đoạn điểm bán',
              key: '`pos_store_id`; mã NX không duy nhất',
            }),
            row('calendar', {
              table: 'Calendar',
              type: 'Tham chiếu thời gian',
              grain: 'Một ngày dương lịch',
              key: '`date`',
            }),
            row('fx-daily', {
              table: 'Fx_daily',
              type: 'Tham chiếu tỷ giá',
              grain: 'Một ngày × đồng tiền',
              key: '`rate_date` + `currency`',
            }),
            row('fx-month', {
              table: 'Fx_month_end',
              type: 'Tham chiếu tỷ giá',
              grain: 'Một tháng × đồng tiền',
              key: '`period` + `currency`',
            }),
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 3 và Bảng 16.',
        },
        {
          id: 'structure-joins',
          kind: 'table',
          caption: 'Khóa nối và điều kiện đối soát giữa các bảng',
          columns: [
            { key: 'from', label: 'Nguồn / cột', width: '24%' },
            { key: 'to', label: 'Đích / cột', width: '24%' },
            { key: 'relation', label: 'Quan hệ / cách dùng', width: '22%' },
            { key: 'note', label: 'Lưu ý bắt buộc' },
          ],
          rows: [
            row('pos-store', {
              from: '`POS.store_id`',
              to: '`Store_Master.pos_store_id`',
              relation: 'Nhiều POS : một mã POS trong Master',
              note: 'Đồng nhất kiểu dữ liệu số/chuỗi; lấy `finance_store_code` sau khi nối.',
            }),
            row('pos-fx', {
              from: '`POS.business_date` + `currency`',
              to: '`Fx_daily.rate_date` + `currency`',
              relation: 'Nhiều dòng POS : một tỷ giá ngày',
              note: 'Quy đổi ở ngày bán, sau đó gộp theo mã NX / ngày / currency.',
            }),
            row('web-fx', {
              from: '`WEB.order_date` + `currency`',
              to: '`Fx_daily.rate_date` + `currency`',
              relation: 'Nhiều đơn : một tỷ giá ngày',
              note: 'Dùng cho cơ sở ngày đặt và bước giải thích chênh lệch với Flash.',
            }),
            row('web-calendar', {
              from: '`WEB.delivery_date` / `return_date`',
              to: '`Calendar.date`',
              relation: 'Nhiều đơn : một ngày, theo từng vai trò',
              note: 'Không thay lẫn ngày giao / ngày trả khi xác định kỳ kế toán.',
            }),
            row('gl-fx', {
              from: '`GL.period` + `currency`',
              to: '`Fx_month_end.period` + `currency`',
              relation: 'Nhiều bút toán : một tỷ giá tháng',
              note: 'Kiểm tra tỷ giá cuối tháng; GL đã có `amount_usd`.',
            }),
            row('pos-gl', {
              from: 'POS tổng hợp theo mã NX × ngày × currency',
              to: 'GL `POS_DAILY` theo NX × `posting_date` × currency',
              relation: 'Đối soát hai bảng đã tổng hợp cùng grain',
              note: 'Xét dịch ngày ghi sổ và `POS_CATCHUP`; không nối từng dòng POS với `journal_id`.',
            }),
            row('web-gl', {
              from: 'WEB tổng theo `delivery_date` × currency',
              to: 'GL `WEB_DELIVERY` theo `posting_date` × currency',
              relation: 'So doanh thu giao online',
              note: 'Tách `WEB_RETURN` theo `return_date`, không gộp lẫn vào doanh thu giao.',
            }),
            row('flash-gl', {
              from: 'Flash theo tháng × kênh × thị trường',
              to: 'GL tổng hợp theo kỳ × kênh / thị trường',
              relation: 'So ở cấp độ tổng hợp sau chuẩn hóa',
              note: 'Cần ánh xạ Cửa hàng/Online và Eurozone; không nối trực tiếp từng dòng GL.',
            }),
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 17.',
        },
        {
          id: 'structure-order',
          kind: 'list',
          ordered: false,
          items: [
            'Cửa hàng: `POS_Sales` → bỏ trùng theo khóa logic → nối `Store_Master` bằng `store_id` → quy đổi tiền theo `Fx_daily` → gộp theo `finance_store_code`, ngày bán và tiền tệ → so với GL theo ngày hạch toán tương ứng.',
            'Online: `WEB_Orders` → xác định trạng thái (Delivered, Cancelled, Returned) → tách ngày đặt, ngày giao và ngày trả → quy đổi và tổng hợp theo từng loại sự kiện → so với bút toán `WEB_DELIVERY` và `WEB_RETURN` của GL.',
          ],
        },
        {
          id: 'structure-join-trap',
          kind: 'callout',
          label: 'Lỗi nối bảng dễ mắc',
          tone: 'warning',
          text: 'Một `finance_store_code` có thể thuộc nhiều `pos_store_id` khác nhau. Nếu lấy bảng GL (mã NX) nối trực tiếp với `Store_Master` rồi SUM, một bút toán có thể bị nhân 2–3 lần. Nối POS theo `pos_store_id`, kiểm soát phạm vi ngày hoạt động và so GL ở bảng tổng hợp mã NX đã bảo đảm duy nhất.',
        },
      ],
    },
    {
      id: 'recognition',
      level: 1,
      title: 'Quy ước ghi nhận',
      content: 'text',
      blocks: [
        paragraph(
          'recognition-intro',
          'Các quy ước dưới đây quyết định cách dữ liệu được đọc và so sánh; chúng không phải dữ liệu tự có trong từng cột nguồn.',
        ),
      ],
    },
    {
      id: 'recognition-timing',
      level: 2,
      title: 'Thời điểm ghi nhận và nguồn chuẩn',
      content: 'text',
      blocks: [
        {
          id: 'timing-table',
          kind: 'table',
          caption: 'Thời điểm ghi nhận của từng nguồn dữ liệu',
          columns: [
            { key: 'source', label: 'Nguồn', width: '26%' },
            { key: 'date', label: 'Ngày xác định kỳ', width: '24%' },
            { key: 'meaning', label: 'Ý nghĩa khi so sánh' },
          ],
          rows: [
            row('gl', {
              source: 'Finance GL',
              date: '`posting_date` / `period`',
              meaning: 'Kỳ kế toán đã khóa sổ; nguồn số chuẩn theo nhóm.',
            }),
            row('pos', {
              source: 'POS Sales',
              date: '`business_date`',
              meaning: 'Ngày bán ở điểm bán; có thể khác ngày hạch toán GL.',
            }),
            row('web-flash', {
              source: 'WEB Orders – Flash',
              date: '`order_date`',
              meaning: 'Ngày khách đặt đơn, dù giao ở kỳ sau.',
            }),
            row('web-revenue', {
              source: 'WEB Orders – doanh thu',
              date: '`delivery_date`',
              meaning: 'Ngày giao: mốc đối soát với `WEB_DELIVERY`.',
            }),
            row('web-return', {
              source: 'WEB Orders – hàng trả',
              date: '`return_date`',
              meaning: 'Ngày nhận trả: mốc đối soát với `WEB_RETURN`.',
            }),
            row('flash', {
              source: 'Sales Flash',
              date: 'Tháng',
              meaning:
                'Tổng doanh số nhanh tháng theo nguồn đơn hàng / giao dịch.',
            }),
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 18.',
        },
        paragraph(
          'timing-note',
          'GL được chọn làm chuẩn do đã khóa sổ và có chứng từ. Vì khác ngày ghi nhận, chênh lệch tháng giữa GL và Flash có thể phát sinh mà không phải lỗi dữ liệu. Ví dụ đơn đặt cuối tháng 12/2025 và giao trong 01/2026 thuộc Flash năm 2025 nhưng không trở thành doanh thu GL năm 2025.',
        ),
      ],
    },
    {
      id: 'recognition-sign',
      level: 2,
      title: 'Dấu doanh thu và loại bút toán',
      content: 'text',
      blocks: [
        {
          id: 'sign-formula',
          kind: 'formula',
          expression: 'revenue_usd = − amount_usd',
          note: 'Áp dụng cho mọi bút toán Finance GL',
        },
        {
          id: 'sign-rule',
          kind: 'callout',
          label: 'Dấu doanh thu',
          tone: 'rule',
          text: 'Finance GL ghi doanh thu thông thường bằng số âm; hàng trả bằng số dương. Tạo chỉ tiêu `revenue_usd` = −`amount_usd` cho tất cả các bút toán, không loại tài khoản 5213 hoặc dòng UNALLOCATED.',
        },
        {
          id: 'journal-types',
          kind: 'table',
          caption: 'Phân loại bút toán trong Finance GL',
          columns: [
            { key: 'type', label: '`journal_type`', mono: true, width: '24%' },
            { key: 'meaning', label: 'Cách hiểu khi đối soát' },
          ],
          rows: [
            row('pos-daily', {
              type: 'POS_DAILY',
              meaning: 'Doanh thu cửa hàng theo ngày hạch toán.',
            }),
            row('web-delivery', {
              type: 'WEB_DELIVERY',
              meaning: 'Doanh thu online theo ngày giao hàng.',
            }),
            row('web-return', {
              type: 'WEB_RETURN',
              meaning: 'Ghi giảm doanh thu khi nhận trả hàng.',
            }),
            row('manual', {
              type: 'MANUAL',
              meaning:
                'Điều chỉnh bằng tay; phân loại bằng diễn giải và `source_ref`.',
            }),
            row('pos-catchup', {
              type: 'POS_CATCHUP',
              meaning:
                'Bút toán bổ sung doanh thu POS còn thiếu; tháng bán và tháng hạch toán có thể khác nhau.',
            }),
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 5.',
        },
      ],
    },
    {
      id: 'recognition-net',
      level: 2,
      title: 'Giá trị thuần và trạng thái đơn hàng',
      content: 'text',
      blocks: [
        {
          id: 'net-formula',
          kind: 'formula',
          expression: 'net = line_amount − discount_amount',
          note: 'Giá trị sau chiết khấu của một dòng POS',
        },
        paragraph(
          'net-pos',
          'Một dòng POS là một mặt hàng của hóa đơn, không phải một hóa đơn đầy đủ. Tổng hóa đơn phải cộng theo dòng sau khi xử lý bản ghi trùng; trước khi so với GL còn phải chuẩn hóa mã cửa hàng, ngày và tỷ giá.',
        ),
        paragraph(
          'net-web',
          'Đơn Cancelled vẫn có số tiền trong tệp đơn hàng, nhưng không được tự động coi là doanh thu GL. Đơn Returned đã giao có thể tạo ghi nhận doanh thu ở ngày giao và bút toán giảm doanh thu ở ngày trả, tức cùng một đơn có tác động tới nhiều kỳ. Không nối từng `web_order_id` trực tiếp sang `journal_id` vì GL đã được tổng hợp thành bút toán theo ngày và tiền tệ.',
        ),
      ],
    },
    {
      id: 'recognition-fx',
      level: 2,
      title: 'Quy đổi tỷ giá',
      content: 'text',
      blocks: [
        {
          id: 'fx-formula',
          kind: 'formula',
          expression: 'USD = amount_local ÷ usd_to_ccy',
          note: '`usd_to_ccy` là số đơn vị nguyên tệ đổi được 1 USD',
        },
        {
          id: 'fx-rule',
          kind: 'callout',
          label: 'Quy tắc tỷ giá',
          tone: 'rule',
          text: '`FX_Daily` dùng cho việc quy đổi theo ngày giao dịch; `FX_Month_End` dùng để đối chiếu số USD ghi nhận theo tỷ giá cuối tháng trong GL. Không chia `amount_usd` của GL thêm một lần nữa.',
        },
        paragraph(
          'fx-returns',
          'Với hàng trả, khoản điều chỉnh trong cầu nối dùng tỷ giá của ngày đặt hàng. Số GL ghi theo tỷ giá cuối tháng khác với cách tính đó; phần khác nhau đi vào khoản tỷ giá. Cần phân biệt với tỷ giá ngày nhận hàng trả.',
        ),
      ],
    },
    {
      id: 'thresholds',
      level: 1,
      title: 'Công thức đối soát và ngưỡng kiểm tra',
      content: 'text',
      blocks: [
        paragraph(
          'thresholds-intro',
          'Bảng dưới đây ghi quy ước tính chênh lệch và các ngưỡng kiểm tra đã thống nhất. Cột “Ứng dụng đang dùng” đọc trực tiếp hằng số trong chương trình để người đọc thấy ngay chỗ nào chương trình đang áp dụng khác tài liệu; sửa tài liệu không làm thay đổi kết quả tính.',
        ),
        {
          id: 'thresholds-table',
          kind: 'parameters',
          caption: 'Quy ước tính chênh lệch và ngưỡng kiểm tra',
          items: [
            {
              id: 'absolute-variance',
              label: 'Chênh lệch tuyệt đối',
              rule: 'Chênh lệch = GL − Flash (USD). Âm nghĩa là GL thấp hơn Flash.',
              value: null,
              unit: '',
              appKey: 'variance-sign',
            },
            {
              id: 'kpi-percent',
              label: '% KPI so với Flash',
              rule: 'Chênh lệch ÷ Flash × 100%; giữ nguyên dấu của chênh lệch.',
              value: null,
              unit: '',
            },
            {
              id: 'store-month-percent',
              label: '% kiểm tra cửa hàng–tháng',
              rule: 'Chênh lệch ÷ |GL| × 100%; chỉ áp dụng ở mức cửa hàng × tháng.',
              value: null,
              unit: '',
              appKey: 'store-month-basis',
            },
            {
              id: 'materiality-amount',
              label: 'Ngưỡng vượt — số tiền',
              rule: 'Đánh dấu khi |Chênh lệch| lớn hơn giá trị này, đồng thời thỏa điều kiện phần trăm, sau chuẩn hóa.',
              value: 200,
              unit: 'USD',
              appKey: 'materiality-amount',
            },
            {
              id: 'materiality-percent',
              label: 'Ngưỡng vượt — phần trăm',
              rule: 'Đánh dấu khi |Chênh lệch| ÷ |GL| lớn hơn giá trị này, đồng thời thỏa điều kiện số tiền.',
              value: 1,
              unit: '%',
              appKey: 'materiality-percent',
            },
            {
              id: 'rounding',
              label: 'Sai số làm tròn',
              rule: 'Chấp nhận sai số làm tròn tối đa giá trị này mỗi tháng.',
              value: 5,
              unit: 'USD/tháng',
              appKey: 'rounding',
            },
            {
              id: 'bridge-check',
              label: 'Kiểm tra bảng cầu nối',
              rule: 'Dòng kiểm tra lý tưởng bằng 0; chấp nhận sai lệch tối đa giá trị này.',
              value: 1,
              unit: 'USD',
              appKey: 'bridge-tolerance',
            },
            {
              id: 'fx-basis',
              label: 'Quy đổi tỷ giá',
              rule: 'Các khoản trước dòng FX dùng tỷ giá ngày đặt/ngày bán; GL dùng tỷ giá cuối tháng.',
              value: null,
              unit: '',
              appKey: 'fx-basis',
            },
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 19.',
        },
        paragraph(
          'thresholds-example',
          'Ví dụ kiểm tra cả năm từ hai tệp nguồn: Flash = 31.124.401,00 USD; GL (đổi dấu) = 28.698.496,23 USD; chênh lệch GL − Flash = −2.425.904,77 USD, tương ứng −7,79% so với Flash. Tỷ lệ này là tỷ lệ KPI, không thay cho ngưỡng kiểm tra cửa hàng–tháng.',
        ),
        {
          id: 'conclusion-levels',
          kind: 'list',
          ordered: true,
          items: [
            'Hợp lệ cấu trúc — đủ sheet, cột, khóa và kiểu dữ liệu cần thiết.',
            'Khớp số học — tổng các thành phần bằng số chuẩn trong sai số đã nêu.',
            'Nguyên nhân — mỗi khoản chênh lệch có loại và quy tắc giải thích.',
            'Bằng chứng — chứng từ liên quan đã được rà soát.',
            'Quyết định — người phụ trách kết luận và đóng hồ sơ.',
          ],
        },
        {
          id: 'conclusion-warning',
          kind: 'callout',
          label: 'Năm cấp kết luận',
          tone: 'warning',
          text: 'Mỗi cấp chỉ được kết luận khi cấp trước đã đạt. Khớp số học không xác nhận đủ bằng chứng kế toán, và một ngoại lệ không tự trở thành hồ sơ đã giải quyết.',
        },
      ],
    },
    {
      id: 'bridge',
      level: 1,
      title: 'Cầu nối doanh thu Sales Flash – Finance GL',
      content: 'text',
      blocks: [
        paragraph(
          'bridge-intro',
          'Để giải thích chênh lệch, phải đưa dữ liệu về chung cách tính rồi mới đánh giá phần dư. Trình tự dưới đây giữ nguyên thứ tự nhóm đã thống nhất; mỗi khoản mang dấu tác động từ Sales Flash về Finance GL.',
        ),
        {
          id: 'bridge-steps',
          kind: 'bridge',
          caption: 'Trình tự khoản mục cầu nối doanh thu',
          steps: [
            {
              id: 'flash',
              label: 'Doanh số Sales Flash',
              category: 'Điểm bắt đầu',
              note: 'Doanh số nhanh theo ngày đặt, làm tròn đến USD.',
              excelCode: 'sales',
              rawBucket: 'Flash_Sales',
            },
            {
              id: 'discount',
              label: 'Chiết khấu',
              category: 'Quy tắc ghi nhận',
              note: 'Giảm giá dòng/đơn, quy đổi USD.',
              excelCode: 'DISCOUNT',
              rawBucket: 'Discounts',
            },
            {
              id: 'pos-duplicate',
              label: 'Dòng POS bị trùng',
              category: 'Lỗi dữ liệu',
              note: 'Giá trị sau giảm giá của bản xuất lặp.',
              excelCode: 'DUP_POS',
              rawBucket: 'Data_Errors',
            },
            {
              id: 'web-cancel',
              label: 'Đơn online bị hủy',
              category: 'Quy tắc ghi nhận',
              note: 'Đơn Cancelled không trở thành doanh thu GL.',
              excelCode: 'CANCEL',
              rawBucket: 'Cancellations',
            },
            {
              id: 'web-timing',
              label: 'Lệch thời điểm online',
              category: 'Quy tắc ghi nhận',
              note: 'Flash theo ngày đặt; GL theo ngày giao.',
              excelCode: 'WEB_TIMING',
              rawBucket: 'Timing_Differences',
            },
            {
              id: 'store-timing',
              label: 'Lệch ngày ghi sổ cửa hàng',
              category: 'Quy tắc ghi nhận',
              note: 'Ngày bán khác ngày hạch toán; tổng năm có thể tự bù trừ.',
              excelCode: 'POS_TIMING',
              rawBucket: 'Timing_Differences',
            },
            {
              id: 'interface',
              label: 'Lỗi chuyển dữ liệu POS → GL',
              category: 'Lỗi dữ liệu',
              note: 'Doanh thu POS thiếu trên GL, bổ sung bằng `POS_CATCHUP`.',
              excelCode: 'INTERFACE',
              rawBucket: 'Data_Errors',
            },
            {
              id: 'returns',
              label: 'Hàng trả',
              category: 'Quy tắc ghi nhận',
              note: 'Theo tỷ giá ngày đặt hàng.',
              excelCode: 'RETURN',
              rawBucket: 'Returns',
            },
            {
              id: 'shipping',
              label: 'Phí vận chuyển',
              category: 'Bút toán tay',
              note: 'Bút toán tay MJ-SHIP.',
              excelCode: 'SHIP',
              rawBucket: null,
            },
            {
              id: 'fx',
              label: 'Tỷ giá',
              category: 'Tỷ giá',
              note: 'Chênh giữa tỷ giá ngày và tỷ giá cuối kỳ.',
              excelCode: 'FX',
              rawBucket: null,
            },
            {
              id: 'rounding',
              label: 'Làm tròn',
              category: 'Sai số',
              note: 'Sai số chấp nhận được.',
              excelCode: 'ROUND',
              rawBucket: null,
            },
            {
              id: 'unexplained',
              label: 'Chưa giải thích',
              category: 'Cần giải thích',
              note: 'Không nhập chung với phí vận chuyển hay làm tròn.',
              excelCode: 'UNEXPLAINED',
              rawBucket: 'Unexplained',
            },
            {
              id: 'finance',
              label: 'Doanh thu Finance GL',
              category: 'Số chuẩn',
              note: 'Số chuẩn sau đổi dấu.',
              excelCode: 'finance',
              rawBucket: 'GL_Finance',
            },
          ],
          source: 'Báo cáo đối soát doanh thu, Bảng 20.',
        },
        paragraph(
          'bridge-channel',
          'Ở bảng cầu nối toàn công ty, bút toán chuyển doanh thu giữa cửa hàng và online (ví dụ MJ-RCL-2506) có tác động tổng bằng 0 nên không cần dòng riêng; ở bảng cầu nối theo kênh phải tách riêng khoản chuyển kênh. Khoản chưa có căn cứ giải thích (ví dụ ADJ-0925) không được mặc định là phí vận chuyển hay sai số làm tròn.',
        ),
      ],
    },
    {
      id: 'application',
      level: 1,
      title: 'Áp dụng trong ứng dụng',
      content: 'live',
      blocks: [],
    },
    {
      id: 'revisions',
      level: 1,
      title: 'Lịch sử sửa đổi',
      content: 'revisions',
      blocks: [],
    },
  ],
  revisions: [
    {
      version: '1.0',
      date: '2026-11-15',
      author: 'reconcile.',
      note: 'Bản gốc soạn từ Báo cáo đối soát doanh thu (eDA_Sale, We Analyze), mục IV, V và IX.',
      origin: 'original',
    },
  ],
}

/* ------------------------------------------------------------------ */
/* Numbering and comparison                                           */
/* ------------------------------------------------------------------ */

export function sectionNumbers(
  document: ConventionDocument,
): Map<string, string> {
  const numbers = new Map<string, string>()
  let major = 0
  let minor = 0
  for (const section of document.sections) {
    if (section.level === 1) {
      major++
      minor = 0
      numbers.set(section.id, `${major}.`)
    } else {
      minor++
      numbers.set(section.id, `${major}.${minor}`)
    }
  }
  return numbers
}

/** “Bảng N.” in reading order, like the source report. */
export function tableNumbers(
  document: ConventionDocument,
): Map<string, number> {
  const numbers = new Map<string, number>()
  let next = 0
  for (const section of document.sections)
    for (const block of section.blocks)
      if (
        block.kind === 'table' ||
        block.kind === 'parameters' ||
        block.kind === 'bridge'
      )
        numbers.set(block.id, ++next)
  return numbers
}

const blockIndex = (document: ConventionDocument) =>
  new Map(
    document.sections.flatMap((section) =>
      section.blocks.map((block) => [block.id, JSON.stringify(block)] as const),
    ),
  )

/** Blocks whose content differs from the baseline, including added blocks. */
export function changedBlockIds(
  baseline: ConventionDocument,
  current: ConventionDocument,
): Set<string> {
  const before = blockIndex(baseline)
  const changed = new Set<string>()
  for (const [id, value] of blockIndex(current))
    if (before.get(id) !== value) changed.add(id)
  return changed
}

export function sameContent(a: ConventionDocument, b: ConventionDocument) {
  return JSON.stringify(a.sections) === JSON.stringify(b.sections)
}

export function isOriginalContent(document: ConventionDocument) {
  return sameContent(document, ORIGINAL_CONVENTION_DOCUMENT)
}

export function nextVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version)
  if (!match) return '1.1'
  return `${match[1]}.${Number(match[2]) + 1}`
}

export function findBlock(document: ConventionDocument, blockId: string) {
  for (const section of document.sections)
    for (const block of section.blocks) if (block.id === blockId) return block
  return undefined
}

export function replaceBlock(
  document: ConventionDocument,
  sectionId: string,
  block: ConventionBlock,
): ConventionDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            blocks: section.blocks.map((item) =>
              item.id === block.id ? block : item,
            ),
          }
        : section,
    ),
  }
}

export const CUSTOM_BLOCK_PREFIX = 'custom-'
export function addParagraph(
  document: ConventionDocument,
  sectionId: string,
  id: string,
): ConventionDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId && section.content === 'text'
        ? { ...section, blocks: [...section.blocks, paragraph(id, '')] }
        : section,
    ),
  }
}
export function removeBlock(
  document: ConventionDocument,
  sectionId: string,
  blockId: string,
): ConventionDocument {
  if (!blockId.startsWith(CUSTOM_BLOCK_PREFIX)) return document
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            blocks: section.blocks.filter((block) => block.id !== blockId),
          }
        : section,
    ),
  }
}

/* ------------------------------------------------------------------ */
/* What the application really uses                                   */
/* ------------------------------------------------------------------ */

export type ComparisonStatus =
  'match' | 'stricter' | 'partial' | 'differs' | 'not-applied'
export const COMPARISON_LABELS: Record<ComparisonStatus, string> = {
  match: 'Khớp',
  stricter: 'Chặt hơn tài liệu',
  partial: 'Khác một phần',
  differs: 'Khác tài liệu',
  'not-applied': 'Chưa áp dụng',
}
export interface AppComparison {
  text: string
  status: ComparisonStatus
}

const usdText = (value: number) =>
  `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} USD`

/** Engine values read from exported constants; never copied by hand. */
export const APP_CONVENTION_VALUES = {
  storeMonthAmountUSD: STORE_MONTH_THRESHOLD_CENTS / 100,
  storeMonthPercent: STORE_MONTH_THRESHOLD_PERCENT,
  exceptionLogAmountUSD: DEFAULT_EXCEPTION_THRESHOLD_CENTS / 100,
  excelBridgeToleranceUSD: REFERENCE_TOLERANCE_USD,
} as const

export function compareWithApplication(
  item: ParameterItem,
): AppComparison | null {
  const app = APP_CONVENTION_VALUES
  switch (item.appKey) {
    case 'variance-sign':
      return {
        text: 'Tổng quan: GL − Flash. Nhật ký ngoại lệ: nguồn − GL. Excel tham chiếu: Flash − Finance.',
        status: 'partial',
      }
    case 'store-month-basis':
      return {
        text: 'Tổng quan: |Δ| ÷ |GL| theo cửa hàng × tháng; GL bằng 0 được tách thành trạng thái riêng.',
        status: 'match',
      }
    case 'materiality-amount': {
      const both =
        item.value === app.storeMonthAmountUSD &&
        item.value === app.exceptionLogAmountUSD
      return {
        text: `Tổng quan: > ${usdText(app.storeMonthAmountUSD)}. Nhật ký ngoại lệ: bộ lọc mặc định > ${usdText(app.exceptionLogAmountUSD)}.`,
        status: both ? 'match' : 'differs',
      }
    }
    case 'materiality-percent':
      return {
        text: `Tổng quan: > ${app.storeMonthPercent.toLocaleString('vi-VN')} % |GL|. Nhật ký ngoại lệ: không xét điều kiện phần trăm.`,
        status: item.value === app.storeMonthPercent ? 'partial' : 'differs',
      }
    case 'rounding':
      return {
        text: 'Raw: chưa có khoản làm tròn riêng, phần dư nằm trong Chưa giải thích. Excel tham chiếu: giữ dòng Làm tròn của workbook.',
        status: 'not-applied',
      }
    case 'bridge-tolerance': {
      const tolerance = app.excelBridgeToleranceUSD
      return {
        text: `Excel tham chiếu: |chênh lệch| ≤ ${usdText(tolerance)}. Raw: Chưa giải thích = GL − phần đã giải thích, không dùng ngưỡng.`,
        status:
          item.value === null
            ? 'differs'
            : tolerance === item.value
              ? 'match'
              : tolerance < item.value
                ? 'stricter'
                : 'differs',
      }
    }
    case 'fx-basis':
      return {
        text: 'Raw: POS quy đổi bằng FX Daily/Month End đã cấu hình; WEB, GL và Flash dùng trường USD có sẵn. Excel tham chiếu: số đã là USD, không quy đổi thêm.',
        status: 'partial',
      }
    default:
      return null
  }
}

export const RAW_BUCKET_LABELS: Record<RawBridgeBucket, string> = {
  Flash_Sales: 'Doanh số Flash',
  Discounts: 'Chiết khấu',
  Cancellations: 'Đơn hủy',
  Timing_Differences: 'Lệch thời điểm',
  Returns: 'Hàng trả',
  Data_Errors: 'Lỗi dữ liệu',
  GL_Finance: 'Doanh thu GL',
  Unexplained: 'Chưa giải thích',
}

/* ------------------------------------------------------------------ */
/* JSON import / export                                               */
/* ------------------------------------------------------------------ */

export function serializeConventionDocument(
  document: ConventionDocument,
): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

const MAX_TEXT = 4000
const MAX_ROWS = 200
type Result =
  { ok: true; document: ConventionDocument } | { ok: false; error: string }
class ImportError extends Error {}
const fail = (message: string): never => {
  throw new ImportError(message)
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, where: string, allowEmpty = true): string => {
  if (typeof value !== 'string') fail(`${where}: cần là chuỗi văn bản.`)
  const result = value as string
  if (result.length > MAX_TEXT) fail(`${where}: nội dung quá dài.`)
  if (!allowEmpty && !result.trim()) fail(`${where}: không được để trống.`)
  return result
}
const list = (value: unknown, where: string, max = MAX_ROWS): unknown[] => {
  if (!Array.isArray(value)) fail(`${where}: cần là danh sách.`)
  const result = value as unknown[]
  if (result.length > max) fail(`${where}: quá nhiều dòng.`)
  return result
}
const EXCEL_CODES = new Set<string>([
  'sales',
  'finance',
  'DISCOUNT',
  'DUP_POS',
  'CANCEL',
  'WEB_TIMING',
  'POS_TIMING',
  'INTERFACE',
  'RETURN',
  'SHIP',
  'FX',
  'ROUND',
  'UNEXPLAINED',
])
const RAW_BUCKETS = new Set<string>(Object.keys(RAW_BUCKET_LABELS))

function readBlock(
  value: unknown,
  original: ConventionBlock | undefined,
  where: string,
): ConventionBlock {
  if (!isRecord(value)) return fail(`${where}: khối không hợp lệ.`)
  const id = text(value.id, `${where} · id`, false)
  if (!original) {
    if (!id.startsWith(CUSTOM_BLOCK_PREFIX) || value.kind !== 'paragraph')
      fail(`${where}: khối “${id}” không có trong cấu trúc tài liệu.`)
    return paragraph(id, text(value.text, `${where} · ${id}`))
  }
  if (value.kind !== original.kind)
    fail(`${where}: khối “${id}” phải có loại “${original.kind}”.`)
  const at = `${where} · ${id}`
  switch (original.kind) {
    case 'paragraph':
      return paragraph(id, text(value.text, at))
    case 'callout':
      return {
        id,
        kind: 'callout',
        label: text(value.label, at),
        text: text(value.text, at),
        tone: original.tone,
      }
    case 'formula':
      return {
        id,
        kind: 'formula',
        expression: text(value.expression, at, false),
        note: text(value.note, at),
      }
    case 'list':
      return {
        id,
        kind: 'list',
        ordered: original.ordered,
        items: list(value.items, at).map((item) => text(item, at)),
      }
    case 'table': {
      const keys = original.columns.map((column) => column.key)
      const columns = list(value.columns, at)
      if (
        columns.length !== keys.length ||
        columns.some(
          (column, index) => !isRecord(column) || column.key !== keys[index],
        )
      )
        fail(`${at}: cột của bảng phải giữ nguyên.`)
      return {
        id,
        kind: 'table',
        caption: text(value.caption, at),
        source: text(value.source, at),
        columns: original.columns.map((column, index) => ({
          ...column,
          label: text((columns[index] as Record<string, unknown>).label, at),
        })),
        rows: list(value.rows, at).map((item, index) => {
          if (!isRecord(item) || !isRecord(item.cells))
            return fail(`${at}: dòng ${index + 1} không hợp lệ.`)
          const cells = item.cells
          return {
            id: text(item.id, at, false),
            cells: Object.fromEntries(
              keys.map((key) => [key, text(cells[key] ?? '', at)]),
            ),
          }
        }),
      }
    }
    case 'parameters': {
      const originals = new Map(original.items.map((item) => [item.id, item]))
      return {
        id,
        kind: 'parameters',
        caption: text(value.caption, at),
        source: text(value.source, at),
        items: list(value.items, at).map((item, index) => {
          if (!isRecord(item))
            return fail(`${at}: tham số ${index + 1} không hợp lệ.`)
          const itemId = text(item.id, at, false)
          const raw = item.value
          if (
            raw !== null &&
            (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0)
          )
            fail(
              `${at} · ${itemId}: giá trị phải là số không âm hoặc để trống.`,
            )
          return {
            id: itemId,
            label: text(item.label, at),
            rule: text(item.rule, at),
            value: raw as number | null,
            unit: text(item.unit, at),
            ...(originals.get(itemId)?.appKey
              ? { appKey: originals.get(itemId)!.appKey }
              : {}),
          }
        }),
      }
    }
    case 'bridge': {
      const originals = new Map(original.steps.map((step) => [step.id, step]))
      return {
        id,
        kind: 'bridge',
        caption: text(value.caption, at),
        source: text(value.source, at),
        steps: list(value.steps, at).map((step, index) => {
          if (!isRecord(step))
            return fail(`${at}: khoản ${index + 1} không hợp lệ.`)
          const stepId = text(step.id, at, false)
          const known = originals.get(stepId)
          if (
            step.excelCode !== undefined &&
            !EXCEL_CODES.has(String(step.excelCode))
          )
            fail(`${at} · ${stepId}: mã Excel không hợp lệ.`)
          if (
            step.rawBucket !== undefined &&
            step.rawBucket !== null &&
            !RAW_BUCKETS.has(String(step.rawBucket))
          )
            fail(`${at} · ${stepId}: nhóm Raw không hợp lệ.`)
          return {
            id: stepId,
            label: text(step.label, at),
            category: text(step.category, at),
            note: text(step.note, at),
            // Mappings follow the original definition when the step is known.
            ...(known
              ? { excelCode: known.excelCode, rawBucket: known.rawBucket }
              : {}),
          }
        }),
      }
    }
  }
}

export function parseConventionDocument(input: unknown): Result {
  try {
    let value = input
    if (typeof input === 'string') {
      try {
        value = JSON.parse(input)
      } catch {
        fail('File không phải JSON hợp lệ.')
      }
    }
    if (!isRecord(value)) fail('File không chứa tài liệu quy ước.')
    const data = value as Record<string, unknown>
    if (data.schema !== CONVENTION_SCHEMA)
      fail('File không phải tài liệu quy ước của reconcile.')
    if (data.schemaVersion !== CONVENTION_SCHEMA_VERSION)
      fail(`Phiên bản cấu trúc ${String(data.schemaVersion)} chưa được hỗ trợ.`)
    const version = text(data.version, 'Phiên bản', false)
    if (!/^\d+\.\d+$/.test(version))
      fail('Phiên bản tài liệu phải có dạng số, ví dụ 1.2.')
    const original = ORIGINAL_CONVENTION_DOCUMENT
    const sections = list(data.sections, 'Danh sách mục', 50)
    if (
      sections.length !== original.sections.length ||
      sections.some(
        (section, index) =>
          !isRecord(section) || section.id !== original.sections[index].id,
      )
    )
      fail('Các mục của tài liệu phải giữ nguyên cấu trúc gốc.')
    const parsedSections = original.sections.map((base, index) => {
      const section = sections[index] as Record<string, unknown>
      const originalBlocks = new Map(
        base.blocks.map((block) => [block.id, block]),
      )
      const blocks =
        base.content === 'text'
          ? list(section.blocks, `Mục ${base.title}`, 60).map((block) =>
              readBlock(
                block,
                isRecord(block)
                  ? originalBlocks.get(String(block.id))
                  : undefined,
                `Mục ${base.title}`,
              ),
            )
          : []
      const ids = new Set(blocks.map((block) => block.id))
      if (ids.size !== blocks.length)
        fail(`Mục ${base.title}: mã khối bị trùng.`)
      for (const id of originalBlocks.keys())
        if (!ids.has(id)) fail(`Mục ${base.title}: thiếu khối “${id}”.`)
      return {
        ...base,
        title: text(section.title, `Mục ${base.title}`, false),
        blocks,
      }
    })
    const revisions = list(data.revisions, 'Lịch sử sửa đổi').map(
      (revision, index) => {
        if (!isRecord(revision))
          return fail(`Lịch sử sửa đổi: dòng ${index + 1} không hợp lệ.`)
        return {
          version: text(revision.version, 'Lịch sử sửa đổi', false),
          date: text(revision.date, 'Lịch sử sửa đổi', false),
          author: text(revision.author, 'Lịch sử sửa đổi'),
          note: text(revision.note, 'Lịch sử sửa đổi'),
          origin:
            revision.origin === 'original'
              ? ('original' as const)
              : ('session' as const),
        }
      },
    )
    if (!revisions.length) fail('Lịch sử sửa đổi không được để trống.')
    return {
      ok: true,
      document: {
        schema: CONVENTION_SCHEMA,
        schemaVersion: CONVENTION_SCHEMA_VERSION,
        version,
        title: text(data.title, 'Tiêu đề', false),
        subtitle: text(data.subtitle, 'Phụ đề'),
        basis: text(data.basis, 'Cơ sở'),
        sections: parsedSections,
        revisions,
      },
    }
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message }
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                  */
/* ------------------------------------------------------------------ */

export interface ConventionState {
  document: ConventionDocument
  /** Edit mode keeps its draft here so tab or page changes do not lose it. */
  draft: ConventionDocument | null
  /** Version last written to a file; the bundled original counts as saved. */
  exportedVersion: string | null
}
export const initialConventionState = (): ConventionState => ({
  document: ORIGINAL_CONVENTION_DOCUMENT,
  draft: null,
  exportedVersion: ORIGINAL_CONVENTION_DOCUMENT.version,
})
export const hasUnexportedConventions = (state: ConventionState) =>
  state.document.version !== state.exportedVersion
export const hasUnsavedDraft = (state: ConventionState) =>
  !!state.draft && !sameContent(state.draft, state.document)

/** Session-only: nothing here is written to storage. */
export function createConventionController(
  get: () => ConventionState,
  publish: (state: ConventionState) => void,
) {
  const patch = (update: Partial<ConventionState>) =>
    publish({ ...get(), ...update })
  return {
    beginConventionEdit() {
      if (!get().draft) patch({ draft: get().document })
    },
    updateConventionDraft(draft: ConventionDocument) {
      patch({ draft })
    },
    discardConventionDraft() {
      patch({ draft: null })
    },
    /** Commits the draft as the next minor version with a history entry. */
    saveConventionDocument({
      note,
      author,
      date,
    }: {
      note: string
      author: string
      date: string
    }) {
      const { draft, document: current } = get()
      if (!draft || sameContent(draft, current)) {
        patch({ draft: null })
        return current
      }
      const version = nextVersion(current.version)
      const document: ConventionDocument = {
        ...draft,
        version,
        revisions: [
          ...current.revisions,
          {
            version,
            date,
            author: author.trim(),
            note: note.trim(),
            origin: 'session',
          },
        ],
      }
      patch({ document, draft: null })
      return document
    },
    importConventionDocument(document: ConventionDocument) {
      publish({ document, draft: null, exportedVersion: document.version })
    },
    markConventionExported() {
      patch({ exportedVersion: get().document.version })
    },
    resetConventionDocument() {
      publish(initialConventionState())
    },
  }
}
