import { VI } from './locale/vi.ts'
import { METADATA_VI } from './locale/metadata-vi.ts'
import { COMMON_VI } from './locale/common-vi.ts'
import { isModuleLoadError, MODULE_LOAD_MESSAGE } from './module-load-error.ts'

/** Presentation only: interpolation values (file/sheet/column names) are never translated. */
export function vi(text: string): string {
  const key = text.replace(/\s+/g, ' ').trim()
  return VI[key] ?? COMMON_VI[key] ?? METADATA_VI[key] ?? text
}
export function vt(parts: TemplateStringsArray, ...values: unknown[]): string {
  const key = parts
    .map((part, i) => part + (i < values.length ? `{${i}}` : ''))
    .join('')
  const format = vi(key)
  return format.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(values[Number(index)] ?? ''),
  )
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const messagePatterns = Object.entries({ ...VI, ...COMMON_VI })
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => ({
    expression: new RegExp(
      '^' +
        key
          .split(/\{\d+\}/)
          .map(escape)
          .join('([\\s\\S]*?)') +
        '$',
    ),
    value,
  }))
export function viMessage(message: string): string {
  if (message.includes('\n'))
    return message.split('\n').map(viMessage).join('\n')
  const translated = vi(message)
  if (translated !== message) return translated
  for (const { expression, value } of messagePatterns) {
    const match = expression.exec(message)
    if (match)
      return value.replace(
        /\{(\d+)\}/g,
        (_, i: string) => match[Number(i) + 1] ?? '',
      )
  }
  // Only the engine-generated suffix is translated; uploaded file names stay intact.
  const sourceNote = /^(POS|WEB|GL|Flash) \((.*)\): ([\s\S]+)$/.exec(message)
  if (sourceNote)
    return `${sourceNote[1]} (${sourceNote[2]}): ${viMessage(sourceNote[3])}`
  return message
}
export function isVietnameseMessage(message: string): boolean {
  return [
    ...Object.values(VI),
    ...Object.values(COMMON_VI),
    ...Object.values(METADATA_VI),
  ].includes(message)
}
export function explainError(message: string): string {
  const translated = viMessage(message)
  if (translated !== message || isVietnameseMessage(message)) return translated
  // A missing app file is fixed by a reload, never by changing the user's data
  // (its URL may contain “xlsx” or “duckdb”, which the rules below would blame).
  if (isModuleLoadError(message)) return MODULE_LOAD_MESSAGE
  // POS diagnostics carry a specific reason code. Broad English word matches
  // must never turn an amount/FX/key failure into a date-only instruction.
  const posCode = /\[?(POS_[A-Z_]+)\]?/.exec(message)?.[1]
  if (posCode || /^POS\b/i.test(message)) {
    if (
      /FX.*DUPLICATE|DUPLICATE.*FX/.test(posCode ?? '') ||
      /duplicate.*FX|FX.*duplicate/i.test(message)
    )
      return 'Khóa FX bị trùng. Kiểm tra đúng ngày/kỳ cùng currency trong bảng tỷ giá; xem mẫu khóa và nguồn bên dưới.'
    if (
      /FX.*MISSING|MISSING.*FX/.test(posCode ?? '') ||
      /missing.*FX|FX.*missing|missing.*rate/i.test(message)
    )
      return 'Thiếu tỷ giá FX cho POS. Xem currency và khóa ngày/kỳ cần tra trong chẩn đoán; xác nhận workbook, sheet và khóa FX.'
    if (/FX|RATE/.test(posCode ?? ''))
      return 'Tỷ giá FX của POS chưa hợp lệ. Cần usd_to_ccy lớn hơn 0, duy nhất theo khóa ngày/kỳ cùng currency.'
    if (/STORE/.test(posCode ?? ''))
      return 'Khóa cửa hàng hoặc Store lookup của POS chưa hợp lệ. Xem mã nguồn và kết quả ánh xạ trong các bản ghi mẫu.'
    if (/RECEIPT|LINE/.test(posCode ?? ''))
      return 'Khóa receipt_no hoặc line_no của POS chưa hợp lệ. Xem trường, giá trị gốc và giá trị chuẩn hóa trong chẩn đoán.'
    if (/DATE|TIMESTAMP|EXPORTED/.test(posCode ?? ''))
      return 'Ngày hoặc timestamp POS không parse được. Xem tên trường, giá trị gốc, tệp và dòng nguồn trong chẩn đoán.'
    if (/LOCAL|AMOUNT/.test(posCode ?? ''))
      return 'Số tiền POS chưa hợp lệ. Kiểm tra tiền nguyên tệ, discount và net theo đúng cơ sở tiền tệ trong chẩn đoán.'
    if (/USD/.test(posCode ?? ''))
      return 'Giá trị USD POS chưa được tạo hợp lệ sau quy đổi. Kiểm tra net được map, currency, khóa FX và tỷ giá trong chẩn đoán.'
    return 'Dữ liệu POS chưa vượt qua kiểm tra pipeline. Xem số dòng lỗi duy nhất, nhóm khóa lỗi và từng nguyên nhân cụ thể: khóa, ngày/timestamp, cửa hàng, tiền nguyên tệ, FX và USD.'
  }
  if (/^Use valid ISO dates.*reporting period\.$/.test(message))
    return 'Ngày bắt đầu hoặc kết thúc kỳ báo cáo không hợp lệ. Dùng định dạng YYYY-MM-DD và một khoảng trọn tháng dương lịch.'
  if (message === 'The period end must be on or after its start.')
    return 'Ngày kết thúc kỳ báo cáo phải bằng hoặc sau ngày bắt đầu.'
  if (
    message ===
    'Use complete calendar months: Flash is supplied at month-end grain.'
  )
    return 'Kỳ báo cáo cần trọn tháng dương lịch vì Flash được cung cấp theo ngày cuối tháng.'
  if (/^WEB has invalid keys, dates, status, or USD amounts\./.test(message))
    return 'Nguồn WEB có khóa, ngày, trạng thái hoặc số tiền USD chưa hợp lệ. Kiểm tra nguyên nhân và bản ghi nguồn; đây không phải kết luận kỳ báo cáo đã chọn sai.'
  if (
    /^Flash requires a calendar month_end_date and non-negative revenue_usd\./.test(
      message,
    )
  )
    return 'Nguồn Flash có ngày cuối tháng hoặc doanh thu chưa hợp lệ. Kiểm tra month_end_date và revenue_usd của bản ghi nguồn.'
  if (/\[GL_VALIDATION\]|^GL requires /.test(message))
    return 'Nguồn GL còn lỗi dữ liệu chặn tính toán. Xem mã lỗi, trường và giá trị nguồn trong chẩn đoán GL.'
  if (/duplicate|multiply|fanout/i.test(message))
    return 'Khóa tham chiếu bị trùng hoặc phép nối có nguy cơ nhân bản dòng. Hãy kiểm tra khóa nối đã chọn.'
  if (/header|worksheet|sheet/i.test(message))
    return 'Không đọc được trang tính hoặc dòng tiêu đề đã chọn. Hãy kiểm tra tên trang tính, dòng tiêu đề và các cột.'
  if (/mapping|map |column|field/i.test(message))
    return 'Ánh xạ trường chưa đầy đủ hoặc cột đã chọn không còn tồn tại. Hãy kiểm tra lại ánh xạ của từng tệp.'
  if (/rate|currency/i.test(message))
    return 'Khóa tiền tệ hoặc tỷ giá chưa hợp lệ. Hãy kiểm tra khóa ngày/kỳ cùng tiền tệ và giá trị tỷ giá.'
  if (/file|workbook|CSV|XLSX|UTF-8|Excel/i.test(message))
    return 'Không thể đọc tệp dữ liệu. Hãy kiểm tra định dạng CSV UTF-8 hoặc XLSX, nội dung tệp và dung lượng cho phép.'
  if (/DuckDB|worker|engine|memory|WASM|fetch/i.test(message))
    return 'Engine dữ liệu cục bộ chưa hoạt động. Hãy thử khởi động lại và kiểm tra chẩn đoán kỹ thuật bên dưới.'
  return 'Không thể hoàn tất xử lý dữ liệu. Hãy kiểm tra tệp, cấu hình và thông tin chẩn đoán bên dưới, rồi thử lại.'
}
export const TERMS: Record<string, string> = {
  GL: 'GL (General Ledger – Sổ cái)',
  POS: 'POS (Point of Sale – Hệ thống bán hàng tại điểm bán)',
  WEB: 'WEB – Kênh bán hàng trực tuyến',
  FX: 'FX (Foreign Exchange – Tỷ giá hối đoái)',
  KPI: 'KPI (Key Performance Indicator – Chỉ số đánh giá)',
  Dim: 'Dim (Dimension – Bảng tham chiếu)',
  Flash: 'Sales Flash – Báo cáo nhanh doanh thu',
}
export function displayValue(field: string, value: string): string {
  if (field === 'order_status')
    return (
      (
        {
          delivered: 'Đã giao',
          cancelled: 'Đã hủy',
          canceled: 'Đã hủy',
          returned: 'Đã trả hàng',
        } as Record<string, string>
      )[value.toLowerCase()] ?? value
    )
  if (field === 'event_type')
    return (
      (
        {
          POS_SALE: 'Bán hàng POS',
          WEB_DELIVERY: 'Giao hàng WEB',
          WEB_RETURN: 'Trả hàng WEB',
          sale: 'Bán hàng',
          delivery: 'Giao hàng',
          return: 'Trả hàng',
          journal: 'Bút toán',
        } as Record<string, string>
      )[value] ?? vi(value)
    )
  return value
}
